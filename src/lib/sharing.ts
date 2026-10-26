import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { GuardError } from "./guards";

const token = () => randomBytes(12).toString("base64url");

/** Public, revocable link for a stylist card or roast card. Re-sharing the same item reuses (and re-enables) its link. */
export async function shareLink(userId: string, kind: "stylist" | "roast", refId: string) {
  const owned =
    kind === "stylist"
      ? await db.look.findFirst({ where: { id: refId, session: { userId } } })
      : await db.roast.findFirst({ where: { id: refId, userId } });
  if (!owned) throw new GuardError("Not found", 404);
  const link = await db.shareLink.upsert({
    where: { kind_refId: { kind, refId } },
    create: { token: token(), userId, kind, refId },
    update: { revokedAt: null },
  });
  return link.token;
}

export async function getShareLink(t: string) {
  const link = await db.shareLink.findUnique({ where: { token: t } });
  return link && !link.revokedAt ? link : null;
}

/** Glowup Party: two of the user's previewed looks, voted on by friends via link. */
export async function createParty(userId: string, lookAId: string, lookBId: string) {
  if (lookAId === lookBId) throw new GuardError("Pick two different looks", 400);
  const looks = await db.look.findMany({ where: { id: { in: [lookAId, lookBId] }, session: { userId }, previewId: { not: null } } });
  if (looks.length !== 2) throw new GuardError("Both looks need a preview first", 400);
  const party = await db.party.create({ data: { token: token(), userId, lookAId, lookBId } });
  return party.token;
}

export async function getParty(t: string) {
  const party = await db.party.findUnique({ where: { token: t }, include: { votes: { select: { choice: true } } } });
  if (!party || party.revokedAt) return null;
  const looks = await db.look.findMany({ where: { id: { in: [party.lookAId, party.lookBId] } } });
  const a = looks.find((l) => l.id === party.lookAId);
  const b = looks.find((l) => l.id === party.lookBId);
  if (!a?.previewId || !b?.previewId) return null;
  const tally = [0, 1].map((c) => party.votes.filter((v) => v.choice === c).length);
  return { party, looks: [a, b] as const, tally };
}

/** One vote per device per party. Returns false if this device already voted. */
export async function castVote(partyId: string, choice: 0 | 1, voterHash: string) {
  const r = await db.partyVote.createMany({ data: [{ partyId, choice, voterHash }], skipDuplicates: true });
  return r.count === 1;
}
