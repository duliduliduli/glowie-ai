import "server-only";
import { createHash } from "node:crypto";
import { db } from "./db";
import { GuardError } from "./guards";
import { PARTY_VOTER_FREE_PREVIEWS, TRIAL_FREE_PREVIEWS } from "./config";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

/**
 * Free trial (1 analysis + 1 preview), once per account, device and verified phone number.
 * Coming from a Glowup Party link adds the voter's free preview. All-or-nothing in one transaction.
 */
export async function claimTrial(userId: string, deviceId: string, verifiedPhone: string, partyToken?: string | null) {
  const party = partyToken ? await db.party.findUnique({ where: { token: partyToken } }) : null;
  const bonus = party && !party.revokedAt && party.userId !== userId ? PARTY_VOTER_FREE_PREVIEWS : 0;
  const phone = verifiedPhone.replace(/[^\d+]/g, "");
  await db.$transaction(async (tx) => {
    const used = await tx.user.updateMany({
      where: { id: userId, trialUsedAt: null },
      data: { trialUsedAt: new Date(), freePreviews: { increment: TRIAL_FREE_PREVIEWS + bonus } },
    });
    const keys = await tx.trialClaim.createMany({
      data: [`device:${hash(deviceId)}`, `phone:${hash(phone)}`].map((key) => ({ key, userId })),
      skipDuplicates: true,
    });
    if (!used.count || keys.count !== 2) throw new GuardError("Your free trial has already been used on this account, device or phone number.", 409);
  });
}

/** Atomically spends one free preview. Returns false if none are left. */
export async function takeFreePreview(userId: string) {
  const r = await db.user.updateMany({ where: { id: userId, freePreviews: { gt: 0 } }, data: { freePreviews: { decrement: 1 } } });
  return r.count === 1;
}

export async function giveBackFreePreview(userId: string) {
  await db.user.update({ where: { id: userId }, data: { freePreviews: { increment: 1 } } });
}
