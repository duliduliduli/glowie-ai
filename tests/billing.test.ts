import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

let n = 0;
vi.mock("@/lib/stripe", () => ({
  stripe: () => ({ checkout: { sessions: { create: async () => ({ id: `cs_mock_${++n}_${Math.random().toString(36).slice(2)}`, url: "https://checkout.test" }) } } }),
}));

const { db } = await import("@/lib/db");
const { createCheckout, handleStripeEvent } = await import("@/lib/billing");

const RUN = Date.now().toString(36);
let k = 0;
const newUser = (createdAt?: Date) => db.user.create({ data: { clerkId: `bill_${RUN}_${++k}`, email: `b${k}@x.test`, referralCode: `B${RUN}${k}`, ...(createdAt ? { createdAt } : {}) } });

describe("new-account caps with parallel checkouts", () => {
  it("5 simultaneous $19.99 checkouts: only what fits under $50 gets a session", async () => {
    const u = await newUser();
    const rs = await Promise.all(Array.from({ length: 5 }, () => createCheckout(u.id, "pro", "http://x")));
    expect(rs.filter((r) => "url" in r)).toHaveLength(2); // 2 x 19.99 = 39.98; a third would reach 59.97
    expect(rs.filter((r) => "error" in r)).toHaveLength(3);
    expect(await db.pendingCheckout.count({ where: { userId: u.id } })).toBe(2);
  });

  it("an expired checkout frees its share of the cap", async () => {
    const u = await newUser();
    const a = (await createCheckout(u.id, "pro", "http://x")) as { url: string };
    await createCheckout(u.id, "pro", "http://x");
    expect(await createCheckout(u.id, "pro", "http://x")).toHaveProperty("error");
    const open = await db.pendingCheckout.findFirstOrThrow({ where: { userId: u.id } });
    await handleStripeEvent({ id: `evt_exp_${RUN}`, type: "checkout.session.expired", data: { object: { id: open.id } } } as unknown as Stripe.Event);
    expect(await createCheckout(u.id, "pro", "http://x")).toHaveProperty("url");
    expect(a.url).toBeTruthy();
  });

  it("a paid checkout moves from pending to purchases without double counting", async () => {
    const u = await newUser();
    await createCheckout(u.id, "starter", "http://x");
    const open = await db.pendingCheckout.findFirstOrThrow({ where: { userId: u.id } });
    await handleStripeEvent({
      id: `evt_paid_${RUN}`,
      type: "checkout.session.completed",
      data: { object: { id: open.id, payment_status: "paid", payment_intent: `pi_${RUN}`, amount_total: 299, customer: `cus_${RUN}`, metadata: { userId: u.id, packId: "starter" } } },
    } as unknown as Stripe.Event);
    expect(await db.pendingCheckout.count({ where: { userId: u.id } })).toBe(0);
    expect(await db.ledgerEntry.count({ where: { userId: u.id, type: "purchase" } })).toBe(1);
  });

  it("a checkout that fails at Stripe leaves no phantom pending row", async () => {
    const u = await newUser();
    vi.doMock("@/lib/stripe", () => ({ stripe: () => ({ checkout: { sessions: { create: async () => { throw new Error("stripe down"); } } } }) }));
    vi.resetModules();
    const fresh = await import("@/lib/billing");
    await expect(fresh.createCheckout(u.id, "starter", "http://x")).rejects.toThrow("stripe down");
    expect(await db.pendingCheckout.count({ where: { userId: u.id } })).toBe(0);
  });

  it("accounts older than a week are not capped", async () => {
    const u = await newUser(new Date(Date.now() - 8 * 86_400_000));
    const rs = await Promise.all(Array.from({ length: 4 }, () => createCheckout(u.id, "pro", "http://x")));
    expect(rs.every((r) => "url" in r)).toBe(true);
  });
});
