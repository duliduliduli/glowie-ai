import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { apiUser, verifiedPhone } from "@/lib/auth";
import { db } from "@/lib/db";
import { handle } from "@/lib/http";
import { processSession, sessionCreditEstimate } from "@/lib/flows";
import { assertSafePrompt, GuardError } from "@/lib/guards";
import { getBalance, InsufficientCreditsError } from "@/lib/ledger";
import { claimTrial } from "@/lib/trial";
import { verifyTurnstile } from "@/lib/turnstile";
import { EVENT_VIBE, VIBES } from "@/lib/config";

export const maxDuration = 300;

const Body = z.object({
  selfieId: z.string(),
  fullBodyId: z.string().nullish(),
  vibe: z.enum([EVENT_VIBE, ...VIBES.map((v) => v.id)]),
  customPrompt: z.string().max(300).nullish(),
  quiz: z.object({
    occasion: z.string().max(60).optional(),
    budget: z.string().max(30).optional(),
    highlight: z.array(z.string().max(40)).max(5).optional(),
  }),
  event: z
    .object({
      description: z.string().min(3).max(300),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      location: z.string().min(2).max(100),
      budgetUsd: z.number().int().min(0).max(10000),
    })
    .nullish(),
  useTrial: z.boolean().optional(),
  turnstileToken: z.string().nullish(),
});

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
    if (body.vibe === EVENT_VIBE) {
      if (!body.event) throw new GuardError("Tell us about the event.", 400);
      assertSafePrompt(body.event.description);
    }
    const photos = await db.photo.findMany({ where: { userId: user.id, deletedAt: null, id: { in: [body.selfieId, body.fullBodyId].filter(Boolean) as string[] } } });
    const selfie = photos.find((p) => p.id === body.selfieId && p.kind === "selfie");
    if (!selfie) throw new GuardError("Selfie not found", 400);
    if (body.fullBodyId && !photos.some((p) => p.id === body.fullBodyId && p.kind === "fullbody")) throw new GuardError("Photo not found", 400);

    if (body.useTrial) {
      const h = await headers();
      const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      if (!(await verifyTurnstile(body.turnstileToken ?? null, ip))) throw new GuardError("Please complete the human check.", 400);
      const phone = await verifiedPhone(user.clerkId);
      if (!phone) throw new GuardError("Verify your phone number to unlock your free trial.", 403, { code: "phone_required" });
      const jar = await cookies();
      const did = jar.get("did")?.value;
      if (!did) throw new GuardError("Please enable cookies to use your free trial.", 400);
      await claimTrial(user.id, did, phone, jar.get("party")?.value);
    } else {
      // Fail fast on the text steps; previews are skipped (not failed) if credits run out mid-session.
      const { text } = await sessionCreditEstimate(body.vibe, selfie.fromCamera);
      const { available } = await getBalance(user.id);
      if (available < text) throw new InsufficientCreditsError(text, available);
    }

    const session = await db.styleSession.create({
      data: {
        userId: user.id,
        selfieId: body.selfieId,
        fullBodyId: body.fullBodyId ?? null,
        vibe: body.vibe,
        customPrompt: body.vibe === "custom" ? body.customPrompt : null,
        quiz: body.quiz,
        extra: body.vibe === EVENT_VIBE ? { event: body.event } : undefined,
        status: "analyzing",
        free: !!body.useTrial,
      },
    });
    after(() => processSession(session.id));
    return { id: session.id };
  });
}
