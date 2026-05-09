export function stripeEnabled() {
    return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}
export function paystackEnabled() {
    return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
}
/** AI quotas apply when either provider is configured. */
export function billingEnabled() {
    return stripeEnabled() || paystackEnabled();
}
function envNum(key, fallback) {
    const v = process.env[key]?.trim();
    if (!v)
        return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}
/** Monthly AI actions included per tier (before bonus credits). */
export function monthlyAiAllowanceForTier(tier) {
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
export function creditsPackSize() {
    return envNum("CREDITS_PACK_SIZE", envNum("STRIPE_CREDITS_PACK_SIZE", envNum("PAYSTACK_CREDITS_PACK_SIZE", 50)));
}
export function paystackPlanCodePlus() {
    return process.env.PAYSTACK_PLAN_CODE_PLUS?.trim();
}
export function paystackPlanCodePro() {
    return process.env.PAYSTACK_PLAN_CODE_PRO?.trim();
}
/**
 * Credit-pack charge amount in smallest currency unit (pesewas/kobo).
 * Example: 50 GHS = 5000 pesewas.
 */
export function paystackAmountCreditsMinor() {
    return envNum("PAYSTACK_AMOUNT_CREDITS_MINOR", 5000);
}
export function paystackCreditsReady() {
    return paystackEnabled() && paystackAmountCreditsMinor() > 0;
}
export function paystackSubscriptionReady() {
    return (paystackEnabled() &&
        Boolean(paystackPlanCodePlus()) &&
        Boolean(paystackPlanCodePro()));
}
export function tierForPaystackPlanCode(planCode) {
    if (!planCode?.trim())
        return null;
    const plus = paystackPlanCodePlus();
    const pro = paystackPlanCodePro();
    if (plus && planCode === plus)
        return "PLUS";
    if (pro && planCode === pro)
        return "PRO";
    return null;
}
export function stripeCheckoutConfigured() {
    return (Boolean(stripePricePlus()) &&
        Boolean(stripePricePro()) &&
        Boolean(stripePriceCreditsPack()));
}
/** Whether Stripe can start checkout for this product (secret key + price ID). */
export function stripeCheckoutReadyForTier(tier) {
    if (!stripeEnabled())
        return false;
    if (tier === "credits")
        return Boolean(stripePriceCreditsPack());
    if (tier === "plus")
        return Boolean(stripePricePlus());
    return Boolean(stripePricePro());
}
/** Whether Paystack can start checkout for this product (secret key + plan code / amount). */
export function paystackCheckoutReadyForTier(tier) {
    if (!paystackEnabled())
        return false;
    if (tier === "credits")
        return paystackAmountCreditsMinor() > 0;
    if (tier === "plus")
        return Boolean(paystackPlanCodePlus());
    return Boolean(paystackPlanCodePro());
}
export function checkoutReadyForTier(tier) {
    return (stripeCheckoutReadyForTier(tier) || paystackCheckoutReadyForTier(tier));
}
export function stripePricePlus() {
    return process.env.STRIPE_PRICE_PLUS_MONTHLY?.trim();
}
export function stripePricePro() {
    return process.env.STRIPE_PRICE_PRO_MONTHLY?.trim();
}
export function stripePriceCreditsPack() {
    return process.env.STRIPE_PRICE_CREDITS_PACK?.trim();
}
export function tierForStripePriceId(priceId) {
    const plus = stripePricePlus();
    const pro = stripePricePro();
    if (plus && priceId === plus)
        return "PLUS";
    if (pro && priceId === pro)
        return "PRO";
    return null;
}
