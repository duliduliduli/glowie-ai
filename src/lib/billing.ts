import "server-only";
import type Stripe from "stripe";
import { db } from "./db";
import { clawback, getBalance, grant } from "./ledger";
import { stripe } from "./stripe";
import {
  getPack,
  NEW_ACCOUNT_DAYS,
  NEW_ACCOUNT_FIRST_PURCHASE_MAX_CENTS,
  NEW_ACCOUNT_WEEK_MAX_CENTS,
  REFERRAL_CREDITS,
} from "./config";

/** Returns an error message if this user may not buy this pack right now, else null. */
export async function purchaseBlockReason(userId: string, usdCents: number) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.frozenAt || user.purchasesBlocked) return "Purchases are disabled on this account. Contact support.";
  const ageDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;
  if (ageDays >= NEW_ACCOUNT_DAYS) return null;
  const paid = await db.ledgerEntry.aggregate({ where: { userId, type: "purchase" }, _sum: { usdCents: true }, _count: true });
  const spent = paid._sum.usdCents ?? 0;
  if (paid._count === 0 && usdCents > NEW_ACCOUNT_FIRST_PURCHASE_MAX_CENTS) return "New accounts can buy up to $20 on their first purchase.";
  if (spent + usdCents > NEW_ACCOUNT_WEEK_MAX_CENTS) return "New accounts can buy up to $50 in their first week.";
  return null;
}

type PurchaseMeta = { userId?: string; packId?: string };

/** Credits a paid pack exactly once per PaymentIntent, then pays out the referral on the first purchase. */
export async function creditPurchase(meta: PurchaseMeta, paymentIntentId: string, amountCents: number) {
  const pack = meta.packId ? getPack(meta.packId) : undefined;
  if (!meta.userId || !pack) return false;
  // Never credit more than what was actually paid for.
  if (amountCents < pack.usdCents) throw new Error(`Paid ${amountCents} for pack ${pack.id}`);
  const userId = meta.userId;

  return db.$transaction(async (tx) => {
    const created = await grant(userId, "purchase", pack.credits, `purchase:${paymentIntentId}`, { usdCents: amountCents, note: pack.name }, tx);
    if (!created) return false;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const purchases = await tx.ledgerEntry.count({ where: { userId, type: "purchase" } });
    if (purchases === 1 && user.referredById) {
      await grant(userId, "referral", REFERRAL_CREDITS, `referral:${userId}:referee`, { note: "Welcome referral bonus" }, tx);
      await grant(user.referredById, "referral", REFERRAL_CREDITS, `referral:${userId}:referrer`, { note: "Friend made a purchase" }, tx);
    }
    return true;
  });
}

const purchaseFor = (paymentIntentId: string) => db.ledgerEntry.findUnique({ where: { idempotencyKey: `purchase:${paymentIntentId}` } });

const id = (x: string | { id: string } | null | undefined) => (typeof x === "string" ? x : x?.id);

/** Applies a verified Stripe event. Idempotent: replays are skipped, and every ledger write has its own unique key. */
export async function handleStripeEvent(event: Stripe.Event) {
  if (await db.stripeEvent.findUnique({ where: { id: event.id } })) return "duplicate";

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      if (s.payment_status === "paid" && s.metadata?.userId) {
        const pi = id(s.payment_intent);
        if (pi) await creditPurchase(s.metadata, pi, s.amount_total ?? 0);
        const customer = id(s.customer);
        if (customer) await db.user.updateMany({ where: { id: s.metadata.userId, stripeCustomerId: null }, data: { stripeCustomerId: customer } });
      }
      break;
    }
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      await creditPurchase(pi.metadata, pi.id, pi.amount_received);
      break;
    }
    case "charge.dispute.created": {
      const pi = id(event.data.object.payment_intent);
      const entry = pi && (await purchaseFor(pi));
      if (entry) {
        await db.user.update({ where: { id: entry.userId }, data: { frozenAt: new Date(), purchasesBlocked: true, autoTopUpPackId: null } });
        await clawback(entry.userId, "admin_adjust", Number.MAX_SAFE_INTEGER, `dispute:${event.data.object.id}`, "Chargeback: unused credits removed");
      }
      break;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const pi = id(charge.payment_intent);
      const entry = pi && (await purchaseFor(pi));
      if (entry && entry.usdCents) {
        const share = Math.min(1, charge.amount_refunded / entry.usdCents);
        await clawback(entry.userId, "refund", Math.ceil(entry.amount * share), `refund:${charge.id}:${charge.amount_refunded}`, "Payment refunded");
      }
      break;
    }
  }

  await db.stripeEvent.createMany({ data: [{ id: event.id, type: event.type }], skipDuplicates: true });
  return "processed";
}

/** Stripe Checkout for a credit pack. Apple Pay / Google Pay appear automatically when enabled in the Stripe Dashboard. */
export async function createCheckout(userId: string, packId: string, appUrl: string) {
  const pack = getPack(packId);
  if (!pack) throw new Error("Unknown pack");
  const blocked = await purchaseBlockReason(userId, pack.usdCents);
  if (blocked) return { error: blocked };
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const metadata = { userId, packId: pack.id };
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: { currency: "usd", unit_amount: pack.usdCents, product_data: { name: `Glowie ${pack.name}: ${pack.credits} credits` } },
      },
    ],
    ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_creation: "always" as const, customer_email: user.email || undefined }),
    // Saved card enables optional auto top-up.
    payment_intent_data: { metadata, setup_future_usage: "off_session" },
    metadata,
    client_reference_id: userId,
    success_url: `${appUrl}/credits?paid=1`,
    cancel_url: `${appUrl}/credits`,
  });
  return { url: session.url! };
}

/** Charges the saved card for the chosen pack when the balance drops below the user's threshold. Credited by the webhook. */
export async function maybeAutoTopUp(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  const pack = user.autoTopUpPackId ? getPack(user.autoTopUpPackId) : undefined;
  if (!pack || !user.stripeCustomerId || user.autoTopUpBelow == null) return;
  const { available } = await getBalance(userId);
  if (available >= user.autoTopUpBelow) return;
  if (await purchaseBlockReason(userId, pack.usdCents)) return;
  // One attempt per 10 minutes, claimed atomically so parallel requests can't double-charge.
  const claimed = await db.user.updateMany({
    where: { id: userId, OR: [{ lastAutoTopUpAt: null }, { lastAutoTopUpAt: { lt: new Date(Date.now() - 10 * 60_000) } }] },
    data: { lastAutoTopUpAt: new Date() },
  });
  if (!claimed.count) return;
  const methods = await stripe().paymentMethods.list({ customer: user.stripeCustomerId, type: "card", limit: 1 });
  if (!methods.data[0]) return;
  try {
    await stripe().paymentIntents.create({
      amount: pack.usdCents,
      currency: "usd",
      customer: user.stripeCustomerId,
      payment_method: methods.data[0].id,
      off_session: true,
      confirm: true,
      metadata: { userId, packId: pack.id, auto: "1" },
    });
  } catch (e) {
    // Card declined or needs authentication: turn auto top-up off rather than retrying a failing card.
    console.warn("[auto-topup] failed", e);
    await db.user.update({ where: { id: userId }, data: { autoTopUpPackId: null } });
  }
}
