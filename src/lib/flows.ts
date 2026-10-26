import "server-only";
import sharp from "sharp";
import { db } from "./db";
import { dataUrl, deleteImages, putImage, signedUrl } from "./storage";
import {
  analysisMessages,
  AnalysisSchema,
  coachScore,
  EventSchema,
  eventMessages,
  hairStageMessages,
  LookSchema,
  LooksSchema,
  looksMessages,
  parseWith,
  photoCheckMessages,
  PhotoCheckSchema,
  previewMessages,
  roastMessages,
  RoastSchema,
  runAi,
  type Analysis,
  type Look,
  type Quiz,
} from "./ai";
import { assertUnderSpendCap, GuardError, rateLimit } from "./guards";
import { maybeAutoTopUp } from "./billing";
import { creditsForCost, getBalance, InsufficientCreditsError, release, reserve, settle } from "./ledger";
import { estimateCredits, generateVideo, type AiResult } from "./openrouter";
import { giveBackFreePreview, takeFreePreview } from "./trial";
import { forecast } from "./weather";
import { EVENT_VIBE, SELFIE_MIN_SCORE, VIDEO } from "./config";
import type { PhotoKind, Prisma } from "@/generated/prisma/client";

/** Background jobs that haven't finished in 10 minutes are treated as dead (the function was killed). */
export const stale = () => new Date(Date.now() - 10 * 60_000);

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Validates, safety-checks and coaches a user photo before any credits are spent.
 * Unsafe or low-quality photos are never stored; the coach's tips come back with the error.
 */
export async function uploadPhoto(userId: string, file: File, kind: Extract<PhotoKind, "selfie" | "fullbody" | "outfit">, fromCamera: boolean) {
  if (!TYPES.includes(file.type)) throw new GuardError("Please upload a JPG, PNG or WebP photo.", 400);
  if (file.size > MAX_BYTES) throw new GuardError("That photo is over 10 MB. Try a smaller one.", 400);
  // Re-encoding strips EXIF (including GPS location) and keeps model input small.
  const bytes = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer()
    .catch(() => {
      throw new GuardError("We couldn't read that image. Try a JPG.", 400);
    });
  const url = `data:image/jpeg;base64,${bytes.toString("base64")}`;

  // Full-body and outfit photos must match the user's latest selfie so people can't style someone else.
  const reference =
    kind === "selfie" ? null : await db.photo.findFirst({ where: { userId, kind: "selfie", deletedAt: null }, orderBy: { createdAt: "desc" } });
  if (kind !== "selfie" && !reference) throw new GuardError("Take a selfie first so we know it's you.", 400);

  const { result: c } = await runAi(
    // Photo checks are free (fractions of a cent); callers gate who may upload.
    { userId, role: "moderation", reason: "Photo check", free: true },
    photoCheckMessages(url, reference ? await dataUrl(reference.blobPath) : undefined),
    parseWith(PhotoCheckSchema),
  );
  if (!c.realPhoto) throw new GuardError("We need a real photo of you (no screenshots, drawings or AI images).", 422);
  if (c.faceCount !== 1) throw new GuardError("Make sure only you are in the photo.", 422);
  if (!c.clearlyAdult) throw new GuardError("Glowie is for adults 18+. Try a clearer, well-lit photo.", 422);
  if (c.nudityOrSexual) throw new GuardError("That photo can't be used. Please wear everyday clothing.", 422);
  if (reference && c.samePersonAsReference === false) throw new GuardError("This doesn't look like the person in your selfie.", 422);

  const coach = { score: coachScore(c), tips: c.tips, lighting: c.lighting, angle: c.angle, sharpness: c.sharpness, faceVisible: c.faceVisible };
  if (kind === "selfie" && coach.score < SELFIE_MIN_SCORE) {
    throw new GuardError("Let's get a better photo first so your previews come out right.", 422, { code: "retake", coach });
  }

  const blobPath = await putImage(`u/${userId}/${kind}.jpg`, bytes, "image/jpeg");
  const photo = await db.photo.create({ data: { userId, kind, fromCamera, blobPath } });
  return { photo, coach };
}

/** Worst-case credits for a session: text steps, plus each auto preview (skipped, not failed, if credits run out). */
export async function sessionCreditEstimate(vibe: string, previews: boolean) {
  const [analysis, looks, image] = await Promise.all([estimateCredits("analysis"), estimateCredits("looks"), estimateCredits("image")]);
  const count = previews ? (vibe === EVENT_VIBE ? 1 : 3) : 0;
  return { text: analysis + looks, analysis, looks, image, previews: count, total: analysis + looks + count * image };
}

/** Analysis, looks (or event plan), then auto previews. Runs after the response; the results page polls status. */
export async function processSession(sessionId: string) {
  const s = await db.styleSession.findUniqueOrThrow({ where: { id: sessionId }, include: { looks: { select: { id: true } } } });
  const selfie = await db.photo.findUniqueOrThrow({ where: { id: s.selfieId } });
  const free = s.free;
  try {
    let analysis = s.analysis as Analysis | null;
    if (!analysis) {
      ({ result: analysis } = await runAi(
        { userId: s.userId, role: "analysis", reason: "Analysis", free },
        analysisMessages(await dataUrl(selfie.blobPath)),
        parseWith(AnalysisSchema),
      ));
      await db.styleSession.update({ where: { id: sessionId }, data: { analysis } });
    }
    if (!s.looks.length) {
      if (s.vibe === EVENT_VIBE) {
        const event = (s.extra as { event: { description: string; date: string; location: string; budgetUsd: number } }).event;
        const weather = await forecast(event.location, event.date).catch(() => null);
        const weatherText = weather ? (weather.summary ? `${weather.summary} in ${weather.place}` : `${weather.place}: ${"note" in weather ? weather.note : ""}`) : "unknown";
        const { result } = await runAi(
          { userId: s.userId, role: "looks", reason: "Event look", free },
          eventMessages(analysis, event, weatherText),
          parseWith(EventSchema),
        );
        const { look, ...plan } = result;
        await db.styleSession.update({ where: { id: sessionId }, data: { extra: { event, weather, ...plan } } });
        await db.look.create({ data: { sessionId, index: 0, data: look } });
      } else {
        const { result } = await runAi(
          { userId: s.userId, role: "looks", reason: "3 looks", free },
          looksMessages(analysis, s.vibe, s.quiz as Quiz, s.customPrompt),
          parseWith(LooksSchema),
        );
        await db.look.createMany({ data: result.looks.map((data, index) => ({ sessionId, index, data })) });
      }
    }
    await db.styleSession.update({ where: { id: sessionId }, data: { status: selfie.fromCamera ? "previewing" : "ready" } });
  } catch (e) {
    console.error("[session] failed", sessionId, e);
    await db.styleSession.update({ where: { id: sessionId }, data: { status: "failed" } });
    return;
  }

  // Auto previews: free ones first, then paid while the balance covers them. Never fails the session.
  if (selfie.fromCamera) {
    const looks = await db.look.findMany({ where: { sessionId, previewId: null }, orderBy: { index: "asc" } });
    const image = await estimateCredits("image");
    for (const look of looks) {
      const user = await db.user.findUniqueOrThrow({ where: { id: s.userId } });
      if (user.freePreviews < 1 && (await getBalance(s.userId)).available < image) break;
      await makePreview(s.userId, look.id).catch((e) => console.warn("[session] preview skipped", look.id, e));
    }
    await db.styleSession.update({ where: { id: sessionId }, data: { status: "ready" } });
  }
  const user = await db.user.findUniqueOrThrow({ where: { id: s.userId } });
  if (user.deleteOriginalsImmediately) await deletePhotos({ userId: s.userId, kind: { in: ["selfie", "fullbody", "outfit"] } });
  await maybeAutoTopUp(s.userId).catch((e) => console.warn("[auto-topup]", e));
}

async function lookFor(userId: string, lookId: string) {
  const look = await db.look.findFirst({ where: { id: lookId, session: { userId } }, include: { session: true } });
  if (!look) throw new GuardError("Look not found", 404);
  const selfie = await db.photo.findUniqueOrThrow({ where: { id: look.session.selfieId } });
  if (!selfie.fromCamera) throw new GuardError("Previews need a live camera selfie to confirm it's you.", 403);
  return { look, data: LookSchema.parse(look.data) };
}

async function basePhoto(id: string) {
  const base = await db.photo.findFirst({ where: { id, deletedAt: null } });
  if (!base) throw new GuardError("Your original photo was deleted. Start a new session to preview looks.", 410);
  return base;
}

const toImage = (r: AiResult) => {
  const m = r.images[0].match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) throw new Error("Unexpected image format");
  return { type: m[1], bytes: Buffer.from(m[2], "base64") };
};

async function saveGenerated(userId: string, image: { type: string; bytes: Buffer }) {
  const blobPath = await putImage(`u/${userId}/gen.${image.type.split("/")[1]}`, image.bytes, image.type);
  return db.photo.create({ data: { userId, kind: "generated", blobPath } });
}

/** One image edit of the user's own photo. Uses a free preview if the user has one, else credits. */
async function editImage(userId: string, reason: string, messages: Parameters<typeof runAi>[1]) {
  const free = await takeFreePreview(userId);
  try {
    return await runAi({ userId, role: "image", reason, free }, messages, toImage, false);
  } catch (e) {
    if (free) await giveBackFreePreview(userId);
    throw e;
  }
}

/** Generates (or regenerates) the preview image for one look. */
export async function makePreview(userId: string, lookId: string) {
  const { look, data } = await lookFor(userId, lookId);
  const base = await basePhoto(look.session.fullBodyId ?? look.session.selfieId);
  const { result, charged } = await editImage(userId, "Preview image", previewMessages(await dataUrl(base.blobPath), data, base.kind === "fullbody"));
  const photo = await saveGenerated(userId, result);
  await db.look.update({ where: { id: lookId }, data: { previewId: photo.id } });
  return { photoId: photo.id, charged };
}

const STAGES = [
  ["week1", "Week 1"],
  ["month3", "Month 3"],
  ["month6", "Month 6"],
] as const;

/** Hair regret simulator: the look's hair at week 1, month 3 and month 6. Background job; the page polls hairStatus. */
export async function startHairTryOn(userId: string, lookId: string) {
  const { look, data } = await lookFor(userId, lookId);
  const base = await basePhoto(look.session.selfieId);
  const [image, user, { available }] = await Promise.all([estimateCredits("image"), db.user.findUniqueOrThrow({ where: { id: userId } }), getBalance(userId)]);
  const needed = Math.max(0, STAGES.length - user.freePreviews) * image;
  if (available < needed) throw new InsufficientCreditsError(needed, available);
  const claimed = await db.look.updateMany({ where: { id: lookId, OR: [{ hairStatus: null }, { NOT: { hairStatus: "generating" } }, { updatedAt: { lt: stale() } }] }, data: { hairStatus: "generating" } });
  if (!claimed.count) throw new GuardError("Already working on it", 409);
  return async () => {
    try {
      const src = await dataUrl(base.blobPath);
      const stages = [];
      for (const [key, label] of STAGES) {
        const { result } = await editImage(userId, `Hair try-on ${label}`, hairStageMessages(src, data, key));
        stages.push({ label, photoId: (await saveGenerated(userId, result)).id });
        await db.look.update({ where: { id: lookId }, data: { hairStages: stages } });
      }
      await db.look.update({ where: { id: lookId }, data: { hairStatus: "ready" } });
    } catch (e) {
      console.error("[hair] failed", lookId, e);
      await db.look.update({ where: { id: lookId }, data: { hairStatus: "failed" } });
    }
  };
}

/** Premium: 3-second animated video of the look preview. Credits are held now; the job runs in the background. */
export async function startVideo(userId: string, lookId: string, appUrl: string) {
  const { look, data } = await lookFor(userId, lookId);
  if (!look.previewId) throw new GuardError("Generate the preview first.", 400);
  await assertUnderSpendCap();
  await rateLimit("ai", userId);
  const holdId = await reserve(userId, VIDEO.credits, "Look video");
  const claimed = await db.look.updateMany({ where: { id: lookId, OR: [{ videoStatus: null }, { NOT: { videoStatus: "generating" } }, { updatedAt: { lt: stale() } }] }, data: { videoStatus: "generating" } });
  if (!claimed.count) {
    await release(holdId);
    throw new GuardError("Already working on it", 409);
  }
  // The video provider fetches the first frame itself, so it gets a public signed URL that expires in 15 minutes.
  const frame = `${appUrl}${signedUrl(look.previewId, 900)}`;
  return async () => {
    try {
      const v = await generateVideo(frame, `Subtle, natural motion: the person turns slightly toward the camera and smiles, hair moving gently. ${data.title}. Keep their face and identity exactly the same. No text.`);
      const blobPath = await putImage(`u/${userId}/video.mp4`, v.bytes, "video/mp4");
      const video = await db.photo.create({ data: { userId, kind: "video", blobPath } });
      await db.look.update({ where: { id: lookId }, data: { videoId: video.id, videoStatus: "ready" } });
      const credits = await settle(holdId, creditsForCost(v.costUsd));
      await db.aiCall.create({ data: { userId, role: "video", model: v.model, status: "ok", costUsd: v.costUsd, credits } });
    } catch (e) {
      console.error("[video] failed", lookId, e);
      await release(holdId);
      await db.aiCall.create({ data: { userId, role: "video", status: "failed", error: String(e).slice(0, 500) } });
      await db.look.update({ where: { id: lookId }, data: { videoStatus: "failed" } });
    }
  };
}

/** Roast my fit: honest score + quick fixes for an outfit photo. */
export async function roastFit(userId: string, photoId: string) {
  const photo = await db.photo.findFirst({ where: { id: photoId, userId, kind: "outfit", deletedAt: null } });
  if (!photo) throw new GuardError("Photo not found", 404);
  const { result, charged } = await runAi({ userId, role: "roast", reason: "Roast my fit" }, roastMessages(await dataUrl(photo.blobPath)), parseWith(RoastSchema));
  const roast = await db.roast.create({ data: { userId, photoId, result } });
  return { id: roast.id, charged };
}

/** Deletes matching photo files and marks the rows deleted. */
export async function deletePhotos(where: Prisma.PhotoWhereInput) {
  const photos = await db.photo.findMany({ where: { ...where, deletedAt: null }, select: { id: true, blobPath: true } });
  await deleteImages(photos.map((p) => p.blobPath));
  await db.photo.updateMany({ where: { id: { in: photos.map((p) => p.id) } }, data: { deletedAt: new Date() } });
  return photos.length;
}

export type { Look };
