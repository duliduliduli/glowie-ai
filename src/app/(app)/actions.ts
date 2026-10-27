"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createCheckout } from "@/lib/billing";
import { deletePhotos, processSession, stale } from "@/lib/flows";
import { rateLimit } from "@/lib/guards";
import { deleteImages } from "@/lib/storage";
import { stripe } from "@/lib/stripe";
import { getPack } from "@/lib/config";
import { createParty, shareLink } from "@/lib/sharing";
import { GuardError } from "@/lib/guards";

const origin = async () => {
  const h = await headers();
  return process.env.NEXT_PUBLIC_APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
};

/** Public link for a stylist handoff card or a roast card. */
export async function shareCard(kind: "stylist" | "roast", refId: string) {
  const user = await requireUser();
  const token = await shareLink(user.id, kind, refId);
  return `${await origin()}/c/${token}`;
}

export async function stopSharing(kind: "stylist" | "roast", refId: string) {
  const user = await requireUser();
  await db.shareLink.updateMany({ where: { kind, refId, userId: user.id }, data: { revokedAt: new Date() } });
}

/** Glowup Party link for two previewed looks. */
export async function startParty(lookAId: string, lookBId: string) {
  const user = await requireUser();
  try {
    return { url: `${await origin()}/p/${await createParty(user.id, lookAId, lookBId)}` };
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
}

export async function endParty(partyId: string) {
  const user = await requireUser();
  await db.party.updateMany({ where: { id: partyId, userId: user.id }, data: { revokedAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function confirmAge(formData: FormData) {
  const user = await requireUser({ allowUnconfirmedAge: true });
  if (formData.get("adult") !== "on") return;
  await db.user.update({ where: { id: user.id }, data: { ageConfirmedAt: new Date() } });
  redirect("/home");
}

export async function toggleFavorite(lookId: string) {
  const user = await requireUser();
  const look = await db.look.findFirst({ where: { id: lookId, session: { userId: user.id } } });
  if (!look) return;
  await db.look.update({ where: { id: lookId }, data: { favorite: !look.favorite } });
  revalidatePath("/lookbook");
  return !look.favorite;
}

export async function retrySession(sessionId: string) {
  const user = await requireUser();
  try {
    await rateLimit("ai", user.id);
  } catch (e) {
    if (e instanceof GuardError) return { error: e.message };
    throw e;
  }
  // Failed, or stuck because the function that was running it was killed.
  const r = await db.styleSession.updateMany({
    where: { id: sessionId, userId: user.id, OR: [{ status: "failed" }, { status: { in: ["analyzing", "pending"] }, updatedAt: { lt: stale() } }] },
    data: { status: "analyzing" },
  });
  if (r.count) after(() => processSession(sessionId));
  revalidatePath(`/session/${sessionId}`);
  return {};
}

export async function buyPack(packId: string) {
  const user = await requireUser();
  await rateLimit("checkout", user.id);
  // redirect() below throws by design, so only the Stripe call is guarded.
  const result = await createCheckout(user.id, packId, await origin()).catch((e) => {
    console.error("[checkout] failed", e);
    return { error: "We couldn't open checkout. You weren't charged. Please try again." };
  });
  if ("error" in result) return { error: result.error };
  redirect(result.url);
}

const AutoTopUp = z.object({ packId: z.string().nullable(), below: z.number().int().min(1).max(200) });

export async function setAutoTopUp(input: { packId: string | null; below: number }) {
  const user = await requireUser();
  const { packId, below } = AutoTopUp.parse(input);
  if (packId && !getPack(packId)) return;
  await db.user.update({ where: { id: user.id }, data: { autoTopUpPackId: packId, autoTopUpBelow: below } });
  revalidatePath("/credits");
}

export async function setDeleteImmediately(on: boolean) {
  const user = await requireUser();
  await db.user.update({ where: { id: user.id }, data: { deleteOriginalsImmediately: on } });
  revalidatePath("/settings");
}

export async function deleteAllPhotos() {
  const user = await requireUser();
  const n = await deletePhotos({ userId: user.id });
  // Public links and parties point at those photos, and roast cards are nothing without theirs.
  await Promise.all([
    db.shareLink.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }),
    db.party.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } }),
    db.roast.deleteMany({ where: { userId: user.id } }),
    // The previews, hair stages and videos those looks pointed at are gone too.
    db.look.updateMany({ where: { session: { userId: user.id } }, data: { previewId: null, videoId: null, videoStatus: null, hairStatus: null, hairStages: Prisma.DbNull } }),
  ]);
  revalidatePath("/", "layout");
  return n;
}

/** Permanently removes every photo, all data, and the Clerk login. */
export async function deleteAccount(confirmation: string) {
  const user = await requireUser();
  if (confirmation !== "DELETE") return { error: 'Type "DELETE" to confirm.' };
  const photos = await db.photo.findMany({ where: { userId: user.id }, select: { blobPath: true } });
  await deleteImages(photos.map((p) => p.blobPath));
  await db.trialClaim.updateMany({ where: { userId: user.id }, data: { userId: "deleted" } }); // keep device hash so the free trial can't be re-farmed
  await db.user.delete({ where: { id: user.id } });
  // Best effort: Stripe keeps the payment records it must keep, but the customer profile goes.
  if (user.stripeCustomerId && process.env.STRIPE_SECRET_KEY) await stripe().customers.del(user.stripeCustomerId).catch((e) => console.warn("[delete] stripe customer", e));
  await (await clerkClient()).users.deleteUser(user.clerkId);
  redirect("/");
}
