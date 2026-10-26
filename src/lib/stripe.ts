import "server-only";
import Stripe from "stripe";

let client: Stripe | undefined;
export const stripe = () => (client ??= new Stripe(process.env.STRIPE_SECRET_KEY!));
