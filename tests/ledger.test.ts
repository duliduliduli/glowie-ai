import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import {
  AccountFrozenError,
  clawback,
  creditsForCost,
  getBalance,
  grant,
  InsufficientCreditsError,
  release,
  releaseStaleHolds,
  reserve,
  settle,
  withHold,
} from "@/lib/ledger";
import { handleStripeEvent, purchaseBlockReason } from "@/lib/billing";

// Unique per run so the test DB never needs wiping.
const RUN = Date.now().toString(36);
let n = 0;
async function newUser(credits = 0, extra: { referredById?: string; createdAt?: Date } = {}) {
  n++;
  const u = await db.user.create({ data: { clerkId: `clerk_${n}_${Date.now()}`, email: `u${n}@x.test`, referralCode: `R${n}${Date.now()}`, ...extra } });
  if (credits) await grant(u.id, "admin_adjust", credits, `seed:${u.id}`);
  return u;
}

const event = (type: string, object: object, id = `evt_${Math.random()}`) => ({ id, type, data: { object } }) as unknown as Stripe.Event;
const paidSession = (userId: string, pi: string, packId = "starter", amount = 499) =>
  ({ id: `cs_${pi}`, payment_status: "paid", payment_intent: pi, amount_total: amount, customer: `cus_${userId}`, metadata: { userId, packId } });

describe("reserve / settle / release", () => {
  it("holds credits, settles actual cost, and returns the rest", async () => {
    const u = await newUser(10);
    const hold = await reserve(u.id, 4, "analysis");
    expect(await getBalance(u.id)).toEqual({ total: 10, held: 4, available: 6 });
    expect(await settle(hold, 3)).toBe(3);
    expect(await getBalance(u.id)).toEqual({ total: 7, held: 0, available: 7 });
  });

  it("never charges more than the hold", async () => {
    const u = await newUser(10);
    const hold = await reserve(u.id, 2, "image");
    expect(await settle(hold, 99)).toBe(2);
    expect((await getBalance(u.id)).total).toBe(8);
  });

  it("settle and release are idempotent", async () => {
    const u = await newUser(10);
    const hold = await reserve(u.id, 2, "image");
    await settle(hold, 2);
    expect(await settle(hold, 2)).toBe(0);
    await release(hold);
    expect((await getBalance(u.id)).total).toBe(8);
  });

  it("release refunds the hold in full", async () => {
    const u = await newUser(5);
    const hold = await reserve(u.id, 5, "image");
    await release(hold);
    expect(await getBalance(u.id)).toEqual({ total: 5, held: 0, available: 5 });
  });

  it("rejects when the balance is insufficient", async () => {
    const u = await newUser(1);
    await expect(reserve(u.id, 2, "image")).rejects.toBeInstanceOf(InsufficientCreditsError);
    const empty = await newUser(0);
    await expect(reserve(empty.id, 1, "analysis")).rejects.toBeInstanceOf(InsufficientCreditsError);
  });

  it("rejects frozen accounts", async () => {
    const u = await newUser(10);
    await db.user.update({ where: { id: u.id }, data: { frozenAt: new Date() } });
    await expect(reserve(u.id, 1, "analysis")).rejects.toBeInstanceOf(AccountFrozenError);
  });

  it("concurrent reserves can never overdraw", async () => {
    const u = await newUser(10);
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => reserve(u.id, 3, "race")));
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(3);
    const holds = ok.map((r) => (r as PromiseFulfilledResult<string>).value);
    await Promise.all(holds.map((h) => settle(h, 3)));
    expect(await getBalance(u.id)).toEqual({ total: 1, held: 0, available: 1 });
  });

  it("releases stale holds", async () => {
    const u = await newUser(5);
    const hold = await reserve(u.id, 5, "crash");
    await db.creditHold.update({ where: { id: hold }, data: { createdAt: new Date(Date.now() - 60 * 60_000) } });
    expect(await releaseStaleHolds()).toBeGreaterThanOrEqual(1);
    expect((await getBalance(u.id)).available).toBe(5);
  });
});

describe("withHold", () => {
  it("charges cost x3 in credits on success", async () => {
    const u = await newUser(10);
    const { charged } = await withHold(u.id, 2, "image", async () => ({ result: "ok", costUsd: 0.039 }));
    expect(charged).toBe(2); // 0.039 * 3 / 0.10 = 1.17 -> 2
    expect((await getBalance(u.id)).total).toBe(8);
  });

  it("never charges for a failed generation", async () => {
    const u = await newUser(10);
    await expect(withHold(u.id, 2, "image", async () => { throw new Error("provider down"); })).rejects.toThrow("provider down");
    expect(await getBalance(u.id)).toEqual({ total: 10, held: 0, available: 10 });
  });

  it("creditsForCost rounds up and is 0 for free calls", () => {
    expect(creditsForCost(0)).toBe(0);
    expect(creditsForCost(0.01)).toBe(1);
    expect(creditsForCost(0.1)).toBe(3);
  });
});

describe("Stripe webhook", () => {
  it("credits a purchase once even if both events arrive and are replayed", async () => {
    const u = await newUser();
    const s = paidSession(u.id, `pi_once_${RUN}`);
    const e1 = event("checkout.session.completed", s, `evt_once_1_${RUN}`);
    expect(await handleStripeEvent(e1)).toBe("processed");
    expect(await handleStripeEvent(e1)).toBe("duplicate");
    await handleStripeEvent(event("payment_intent.succeeded", { id: `pi_once_${RUN}`, amount_received: 499, metadata: { userId: u.id, packId: "starter" } }));
    expect((await getBalance(u.id)).total).toBe(50);
    expect((await db.user.findUnique({ where: { id: u.id } }))?.stripeCustomerId).toBe(`cus_${u.id}`);
  });

  it("concurrent duplicate deliveries credit once", async () => {
    const u = await newUser();
    const s = paidSession(u.id, `pi_race_${RUN}`, "pro", 1999);
    await Promise.all([1, 2, 3].map((i) => handleStripeEvent(event("checkout.session.completed", s, `evt_race_${i}_${RUN}`))));
    expect((await getBalance(u.id)).total).toBe(240);
  });

  it("ignores unpaid sessions and underpaid amounts", async () => {
    const u = await newUser();
    await handleStripeEvent(event("checkout.session.completed", { ...paidSession(u.id, `pi_unpaid_${RUN}`), payment_status: "unpaid" }));
    await expect(handleStripeEvent(event("checkout.session.completed", paidSession(u.id, `pi_cheap_${RUN}`, "pro", 100)))).rejects.toThrow();
    expect((await getBalance(u.id)).total).toBe(0);
  });

  it("pays referral bonus to both sides only on the first purchase", async () => {
    const referrer = await newUser();
    const u = await newUser(0, { referredById: referrer.id });
    await handleStripeEvent(event("checkout.session.completed", paidSession(u.id, `pi_ref1_${RUN}`)));
    await handleStripeEvent(event("checkout.session.completed", paidSession(u.id, `pi_ref2_${RUN}`)));
    expect((await getBalance(u.id)).total).toBe(50 + 50 + 20);
    expect((await getBalance(referrer.id)).total).toBe(20);
  });

  it("dispute freezes the account and claws back unused credits", async () => {
    const u = await newUser();
    await handleStripeEvent(event("checkout.session.completed", paidSession(u.id, `pi_dispute_${RUN}`, "popular", 999)));
    const hold = await reserve(u.id, 10, "in-flight");
    await handleStripeEvent(event("charge.dispute.created", { id: `dp_1_${RUN}`, payment_intent: `pi_dispute_${RUN}` }));
    const user = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(user.frozenAt).not.toBeNull();
    expect(user.purchasesBlocked).toBe(true);
    expect(await getBalance(u.id)).toEqual({ total: 10, held: 10, available: 0 });
    await settle(hold, 10);
    expect((await getBalance(u.id)).total).toBe(0);
    expect(await purchaseBlockReason(u.id, 499)).toMatch(/disabled/);
  });

  it("refund removes the refunded share of credits, never below zero", async () => {
    const u = await newUser();
    await handleStripeEvent(event("checkout.session.completed", paidSession(u.id, `pi_refund_${RUN}`)));
    await withHold(u.id, 45, "spend", async () => ({ result: null, costUsd: 1.5 })); // 45 credits used
    await handleStripeEvent(event("charge.refunded", { id: `ch_1_${RUN}`, payment_intent: `pi_refund_${RUN}`, amount_refunded: 499 }));
    expect((await getBalance(u.id)).total).toBe(0);
  });
});

describe("purchase limits", () => {
  it("caps new accounts at $20 first purchase and $50 in the first week", async () => {
    const u = await newUser();
    expect(await purchaseBlockReason(u.id, 2500)).toMatch(/\$20/);
    expect(await purchaseBlockReason(u.id, 1999)).toBeNull();
    for (const pi of ["a", "b"]) await handleStripeEvent(event("checkout.session.completed", paidSession(u.id, `pi_lim_${pi}_${RUN}`, "pro", 1999)));
    expect(await purchaseBlockReason(u.id, 1999)).toMatch(/\$50/);
    const old = await newUser(0, { createdAt: new Date(Date.now() - 8 * 86_400_000) });
    expect(await purchaseBlockReason(old.id, 1999)).toBeNull();
  });

  it("clawback is idempotent", async () => {
    const u = await newUser(10);
    expect(await clawback(u.id, "refund", 4, `cb:1_${RUN}`, "x")).toBe(4);
    expect(await clawback(u.id, "refund", 4, `cb:1_${RUN}`, "x")).toBe(0);
    expect((await getBalance(u.id)).total).toBe(6);
  });
});
