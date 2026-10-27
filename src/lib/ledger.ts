import "server-only";
import { db } from "./db";
import { Prisma, type LedgerType } from "@/generated/prisma/client";
import { CREDIT_USD, MARKUP } from "./config";

type Tx = Prisma.TransactionClient;

export class InsufficientCreditsError extends Error {
  constructor(public needed: number, public available: number) {
    super(`Needs ${needed} credits, ${available} available`);
  }
}
export class AccountFrozenError extends Error {
  constructor() {
    super("Account is frozen");
  }
}

/** Serialises every balance-changing operation for one user. */
async function lockUser(tx: Tx, userId: string) {
  const rows = await tx.$queryRaw<{ frozenAt: Date | null }[]>`SELECT "frozenAt" FROM "User" WHERE id = ${userId} FOR UPDATE`;
  if (!rows.length) throw new Error("User not found");
  return rows[0];
}

export async function getBalance(userId: string, tx: Tx = db) {
  const [ledger, held] = await Promise.all([
    tx.ledgerEntry.aggregate({ where: { userId }, _sum: { amount: true } }),
    tx.creditHold.aggregate({ where: { userId, status: "active" }, _sum: { amount: true } }),
  ]);
  const total = ledger._sum.amount ?? 0;
  const onHold = held._sum.amount ?? 0;
  return { total, held: onHold, available: total - onHold };
}

/** Holds older than this belong to a job the platform killed (functions stop at 5 minutes). */
export const STALE_HOLD_MINUTES = 15;

/** Runs `fn` in a transaction that holds this user's row lock (same lock the balance functions use). */
export const withUserLock = <T>(userId: string, fn: (tx: Tx) => Promise<T>) =>
  db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    return fn(tx);
  });

/** Holds `amount` credits. Throws if the available balance can't cover it. */
export async function reserve(userId: string, amount: number, reason: string) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("Hold amount must be a positive integer");
  return db.$transaction(async (tx) => {
    const user = await lockUser(tx, userId);
    if (user.frozenAt) throw new AccountFrozenError();
    // A crashed job must not block its owner until the daily sweep.
    await tx.creditHold.updateMany({
      where: { userId, status: "active", createdAt: { lt: new Date(Date.now() - STALE_HOLD_MINUTES * 60_000) } },
      data: { status: "released", closedAt: new Date() },
    });
    const { available } = await getBalance(userId, tx);
    if (available < amount) throw new InsufficientCreditsError(amount, available);
    const hold = await tx.creditHold.create({ data: { userId, amount, reason } });
    return hold.id;
  });
}

/** Charges min(actual, held) and closes the hold. Safe to call twice. Returns credits charged. */
export async function settle(holdId: string, actualCredits: number) {
  return db.$transaction(async (tx) => {
    const hold = await tx.creditHold.findUniqueOrThrow({ where: { id: holdId } });
    await lockUser(tx, hold.userId);
    const closed = await tx.creditHold.updateMany({
      where: { id: holdId, status: "active" },
      data: { status: "settled", closedAt: new Date() },
    });
    if (!closed.count) return 0;
    const charge = Math.max(0, Math.min(Math.ceil(actualCredits), hold.amount));
    if (charge > 0) {
      await tx.ledgerEntry.create({
        data: { userId: hold.userId, type: "usage", amount: -charge, idempotencyKey: `usage:${holdId}`, note: hold.reason },
      });
    }
    return charge;
  });
}

/** Returns the held credits without charging. Safe to call twice. */
export async function release(holdId: string) {
  await db.creditHold.updateMany({ where: { id: holdId, status: "active" }, data: { status: "released", closedAt: new Date() } });
}

/** Provider cost in USD -> credits to charge. */
export const creditsForCost = (usd: number) => (usd > 0 ? Math.ceil((usd * MARKUP) / CREDIT_USD - 1e-9) : 0);

/** Reserve, run, settle at actual cost; release on any failure so failed generations are never charged. */
export async function withHold<T>(
  userId: string,
  maxCredits: number,
  reason: string,
  fn: () => Promise<{ result: T; costUsd: number }>,
): Promise<{ result: T; charged: number }> {
  const holdId = await reserve(userId, maxCredits, reason);
  try {
    const { result, costUsd } = await fn();
    const charged = await settle(holdId, creditsForCost(costUsd));
    return { result, charged };
  } catch (e) {
    await release(holdId);
    throw e;
  }
}

/** Idempotent credit grant (purchase, referral, admin). Returns false if the key was already used. */
export async function grant(
  userId: string,
  type: LedgerType,
  amount: number,
  idempotencyKey: string,
  extra: { usdCents?: number; note?: string } = {},
  tx?: Tx,
) {
  const run = async (t: Tx) => {
    await lockUser(t, userId);
    const r = await t.ledgerEntry.createMany({
      data: [{ userId, type, amount, idempotencyKey, ...extra }],
      skipDuplicates: true,
    });
    return r.count === 1;
  };
  return tx ? run(tx) : db.$transaction(run);
}

/** Removes up to `max` unused credits (never pushes the balance below active holds). Returns credits removed. */
export async function clawback(userId: string, type: LedgerType, max: number, idempotencyKey: string, note: string) {
  return db.$transaction(async (tx) => {
    await lockUser(tx, userId);
    if (await tx.ledgerEntry.findUnique({ where: { idempotencyKey } })) return 0;
    const { available } = await getBalance(userId, tx);
    const amount = Math.min(max, available);
    if (amount <= 0) return 0;
    await tx.ledgerEntry.create({ data: { userId, type, amount: -amount, idempotencyKey, note } });
    return amount;
  });
}

/** Releases holds left behind by crashed requests. */
export async function releaseStaleHolds(olderThanMinutes = STALE_HOLD_MINUTES) {
  const r = await db.creditHold.updateMany({
    where: { status: "active", createdAt: { lt: new Date(Date.now() - olderThanMinutes * 60_000) } },
    data: { status: "released", closedAt: new Date() },
  });
  return r.count;
}
