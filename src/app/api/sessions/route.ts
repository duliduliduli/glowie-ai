import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { createHash } from "node:crypto";
import { z } from "zod";
import { apiUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";
import { processSession } from "@/lib/flows";
import { assertSafePrompt, GuardError } from "@/lib/guards";
import { getBalance, InsufficientCreditsError } from "@/lib/ledger";
import { estimateCredits } from "@/lib/openrouter";
import { verifyTurnstile } from "@/lib/turnstile";
import { VIBES } from "@/lib/config";

export const maxDuration = 300;

const Body = z.object({
  selfieId: z.string(),
  fullBodyId: z.string().nullish(),
  vibe: z.enum(VIBES.map((v) => v.id) as [string, ...string[]]),
  customPrompt: z.string().max(300).nullish(),
  quiz: z.object({
    occasion: z.string().max(60).optional(),
    budget: z.string().max(30).optional(),
    highlight: z.array(z.string().max(40)).max(5).optional(),
  }),
  useTrial: z.boolean().optional(),
  turnstileToken: z.string().nullish(),
});

/** One free analysis per account AND per device, behind Turnstile. Claimed atomically. */
async function claimTrial(userId: string, token: string | null | undefined) {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  if (!(await verifyTurnstile(token ?? null, ip))) throw new GuardError("Please complete the human check.", 400);
  const did = (await cookies()).get("did")?.value;
  if (!did) throw new GuardError("Please enable cookies to use your free analysis.", 400);
  const deviceHash = createHash("sha256").update(did).digest("hex");
  await db.$transaction(async (tx) => {
    const used = await tx.user.updateMany({ where: { id: userId, trialUsedAt: null }, data: { trialUsedAt: new Date() } });
    const device = await tx.trialClaim.createMany({ data: [{ deviceHash, userId }], skipDuplicates: true });
    if (!used.count || !device.count) throw new GuardError("Your free analysis has already been used on this account or device.", 409);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const user = await apiUser();
    if (!user) throw new GuardError("Sign in first", 401);
    if (user.frozenAt) throw new GuardError("Your account is on hold. Contact support.", 403);
    const body = Body.parse(await req.json());
    if (body.vibe === "custom") {
      if (!body.customPrompt?.trim()) throw new GuardError("Describe your custom vibe.", 400);
      assertSafePrompt(body.customPrompt);
    }
    const photos = await db.photo.findMany({ where: { userId: user.id, deletedAt: null, id: { in: [body.selfieId, body.fullBodyId].filter(Boolean) as string[] } } });
    if (!photos.some((p) => p.id === body.selfieId && p.kind === "selfie")) throw new GuardError("Selfie not found", 400);
    if (body.fullBodyId && !photos.some((p) => p.id === body.fullBodyId && p.kind === "fullbody")) throw new GuardError("Photo not found", 400);

    if (body.useTrial) await claimTrial(user.id, body.turnstileToken);
    else {
      // Fail fast with a clear message; the real holds happen per model call.
      const needed = (await estimateCredits("analysis")) + (await estimateCredits("looks"));
      const { available } = await getBalance(user.id);
      if (available < needed) throw new InsufficientCreditsError(needed, available);
    }

    const session = await db.styleSession.create({
      data: {
        userId: user.id,
        selfieId: body.selfieId,
        fullBodyId: body.fullBodyId ?? null,
        vibe: body.vibe,
        customPrompt: body.vibe === "custom" ? body.customPrompt : null,
        quiz: body.quiz,
        status: "analyzing",
        free: !!body.useTrial,
      },
    });
    after(() => processSession(session.id));
    return { id: session.id };
  });
}
