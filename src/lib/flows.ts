import "server-only";
import sharp from "sharp";
import { db } from "./db";
import { dataUrl, deleteImages, putImage } from "./storage";
import {
  analysisMessages,
  AnalysisSchema,
  LookSchema,
  LooksSchema,
  looksMessages,
  moderationMessages,
  ModerationSchema,
  parseWith,
  previewMessages,
  runAi,
  type Analysis,
  type Quiz,
} from "./ai";
import { GuardError } from "./guards";
import { maybeAutoTopUp } from "./billing";
import type { PhotoKind, Prisma } from "@/generated/prisma/client";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Validates, moderates and stores a user photo. Rejected photos are never stored. */
export async function uploadPhoto(userId: string, file: File, kind: Exclude<PhotoKind, "generated">, fromCamera: boolean) {
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

  // Full-body photos must match the user's latest selfie so people can't style someone else.
  const reference =
    kind === "fullbody"
      ? await db.photo.findFirst({ where: { userId, kind: "selfie", deletedAt: null }, orderBy: { createdAt: "desc" } })
      : null;
  if (kind === "fullbody" && !reference) throw new GuardError("Take a selfie first.", 400);

  const { result: m } = await runAi(
    // Photo checks are free (fractions of a cent); callers gate who may upload.
    { userId, role: "moderation", reason: "Photo check", free: true },
    moderationMessages(url, reference ? await dataUrl(reference.blobPath) : undefined),
    parseWith(ModerationSchema),
  );
  if (!m.realPhoto) throw new GuardError("We need a real photo of you (no screenshots, drawings or AI images).", 422);
  if (m.faceCount !== 1) throw new GuardError("Make sure only your face is in the photo.", 422);
  if (!m.clearlyAdult) throw new GuardError("Glowie is for adults 18+. Try a clearer, well-lit photo.", 422);
  if (m.nudityOrSexual) throw new GuardError("That photo can't be used. Please wear everyday clothing.", 422);
  if (reference && m.samePersonAsReference === false) throw new GuardError("This doesn't look like the person in your selfie.", 422);

  const blobPath = await putImage(`u/${userId}/${kind}.jpg`, bytes, "image/jpeg");
  return db.photo.create({ data: { userId, kind, fromCamera, blobPath } });
}

/** Analysis + 3 looks. Runs after the response; the results page polls status. */
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
      const { result } = await runAi(
        { userId: s.userId, role: "looks", reason: "3 looks", free },
        looksMessages(analysis, s.vibe, s.quiz as Quiz, s.customPrompt),
        parseWith(LooksSchema),
      );
      await db.look.createMany({ data: result.looks.map((data, index) => ({ sessionId, index, data })) });
    }
    await db.styleSession.update({ where: { id: sessionId }, data: { status: "ready" } });
    const user = await db.user.findUniqueOrThrow({ where: { id: s.userId } });
    if (user.deleteOriginalsImmediately) await deletePhotos({ userId: s.userId, kind: { in: ["selfie", "fullbody"] } });
  } catch (e) {
    console.error("[session] failed", sessionId, e);
    await db.styleSession.update({ where: { id: sessionId }, data: { status: "failed" } });
  } finally {
    if (!free) await maybeAutoTopUp(s.userId).catch((e) => console.warn("[auto-topup]", e));
  }
}

/** Generates (or regenerates) the preview image for one look by editing the user's own photo. */
export async function makePreview(userId: string, lookId: string) {
  const look = await db.look.findFirst({ where: { id: lookId, session: { userId } }, include: { session: true } });
  if (!look) throw new GuardError("Look not found", 404);
  const baseId = look.session.fullBodyId ?? look.session.selfieId;
  const base = await db.photo.findFirst({ where: { id: baseId, deletedAt: null } });
  if (!base) throw new GuardError("Your original photo was deleted. Start a new session to preview looks.", 410);
  const selfie = await db.photo.findUniqueOrThrow({ where: { id: look.session.selfieId } });
  if (!selfie.fromCamera) throw new GuardError("Previews need a live camera selfie to confirm it's you.", 403);

  const { result: image, charged } = await runAi(
    { userId, role: "image", reason: "Preview image" },
    previewMessages(await dataUrl(base.blobPath), LookSchema.parse(look.data), base.kind === "fullbody"),
    (r) => {
      const m = r.images[0].match(/^data:(image\/[a-z]+);base64,(.+)$/);
      if (!m) throw new Error("Unexpected image format");
      return { type: m[1], bytes: Buffer.from(m[2], "base64") };
    },
    false,
  );
  const blobPath = await putImage(`u/${userId}/preview.${image.type.split("/")[1]}`, image.bytes, image.type);
  const photo = await db.photo.create({ data: { userId, kind: "generated", blobPath } });
  await db.look.update({ where: { id: lookId }, data: { previewId: photo.id } });
  maybeAutoTopUp(userId).catch((e) => console.warn("[auto-topup]", e));
  return { photoId: photo.id, charged };
}

/** Deletes matching photo files and marks the rows deleted. */
export async function deletePhotos(where: Prisma.PhotoWhereInput) {
  const photos = await db.photo.findMany({ where: { ...where, deletedAt: null }, select: { id: true, blobPath: true } });
  await deleteImages(photos.map((p) => p.blobPath));
  await db.photo.updateMany({ where: { id: { in: photos.map((p) => p.id) } }, data: { deletedAt: new Date() } });
  return photos.length;
}
