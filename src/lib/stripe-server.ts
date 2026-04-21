import Stripe from "stripe";

const stripeByKey = new Map<string, Stripe>();

export function getStripe(secretKey?: string): Stripe {
  const key = secretKey?.trim() || process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  const cached = stripeByKey.get(key);
  if (cached) {
    return cached;
  }
  const stripe = new Stripe(key);
  stripeByKey.set(key, stripe);
  return stripe;
}
