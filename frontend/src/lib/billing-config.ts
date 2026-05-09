import type { PlanTier } from "@/types/enums";

export function stripeEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function paystackEnabled(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
}

/** AI quotas apply when either provider is configured. */
export function billingEnabled(): boolean {
  return stripeEnabled() || paystackEnabled();
}

function envNum(key: string, fallback: number): number {
  const v = process.env[key]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Monthly AI actions included per tier (before bonus credits). */
export function monthlyAiAllowanceForTier(tier: PlanTier): number {
  switch (tier) {
    case "PLUS":
      return 200;
    case "PRO":
      return 80;
    case "FREE":
    default:
      return 0;
  }
}

/** Credits added when a credit-pack checkout succeeds (Stripe or Paystack). */
export function creditsPackSize(): number {
  return envNum(
    "CREDITS_PACK_SIZE",
    envNum("STRIPE_CREDITS_PACK_SIZE", envNum("PAYSTACK_CREDITS_PACK_SIZE", 50)),
  );
}

export function paystackPlanCodePlus(): string | undefined {
  return process.env.PAYSTACK_PLAN_CODE_PLUS?.trim();
}

export function paystackPlanCodePro(): string | undefined {
  return process.env.PAYSTACK_PLAN_CODE_PRO?.trim();
}

/**
 * Credit-pack charge amount in smallest currency unit (pesewas/kobo).
 * Example: 50 GHS = 5000 pesewas.
 */
export function paystackAmountCreditsMinor(): number {
  return envNum("PAYSTACK_AMOUNT_CREDITS_MINOR", 5000);
}

export function paystackCreditsReady(): boolean {
  return paystackEnabled() && paystackAmountCreditsMinor() > 0;
}

export function paystackSubscriptionReady(): boolean {
  return (
    paystackEnabled() &&
    Boolean(paystackPlanCodePlus()) &&
    Boolean(paystackPlanCodePro())
  );
}

export function tierForPaystackPlanCode(
  planCode: string | undefined,
): PlanTier | null {
  if (!planCode?.trim()) return null;
  const plus = paystackPlanCodePlus();
  const pro = paystackPlanCodePro();
  if (plus && planCode === plus) return "PLUS";
  if (pro && planCode === pro) return "PRO";
  return null;
}

export function stripeCheckoutConfigured(): boolean {
  return (
    Boolean(stripePricePlus()) &&
    Boolean(stripePricePro()) &&
    Boolean(stripePriceCreditsPack())
  );
}

/** Whether Stripe can start checkout for this product (secret key + price ID). */
export function stripeCheckoutReadyForTier(
  tier: "plus" | "pro" | "credits",
): boolean {
  if (!stripeEnabled()) return false;
  if (tier === "credits") return Boolean(stripePriceCreditsPack());
  if (tier === "plus") return Boolean(stripePricePlus());
  return Boolean(stripePricePro());
}

/** Whether Paystack can start checkout for this product (secret key + plan code / amount). */
export function paystackCheckoutReadyForTier(
  tier: "plus" | "pro" | "credits",
): boolean {
  if (!paystackEnabled()) return false;
  if (tier === "credits") return paystackAmountCreditsMinor() > 0;
  if (tier === "plus") return Boolean(paystackPlanCodePlus());
  return Boolean(paystackPlanCodePro());
}

export function checkoutReadyForTier(
  tier: "plus" | "pro" | "credits",
): boolean {
  return (
    stripeCheckoutReadyForTier(tier) || paystackCheckoutReadyForTier(tier)
  );
}

export function stripePricePlus(): string | undefined {
  return process.env.STRIPE_PRICE_PLUS_MONTHLY?.trim();
}

export function stripePricePro(): string | undefined {
  return process.env.STRIPE_PRICE_PRO_MONTHLY?.trim();
}

export function stripePriceCreditsPack(): string | undefined {
  return process.env.STRIPE_PRICE_CREDITS_PACK?.trim();
}

export function tierForStripePriceId(priceId: string): PlanTier | null {
  const plus = stripePricePlus();
  const pro = stripePricePro();
  if (plus && priceId === plus) return "PLUS";
  if (pro && priceId === pro) return "PRO";
  return null;
}
