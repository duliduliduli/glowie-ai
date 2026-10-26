import { stripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/billing";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  let event;
  try {
    event = stripe().webhooks.constructEvent(await req.text(), sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    return Response.json({ result: await handleStripeEvent(event) });
  } catch (e) {
    console.error("[stripe] webhook failed", event.type, event.id, e);
    // 500 makes Stripe retry; every write is idempotent.
    return new Response("Webhook handler failed", { status: 500 });
  }
}
