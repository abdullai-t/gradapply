import { PlanTier } from "@prisma/client";

import { BILLING_SETTING_KEYS, getAppSettingValue } from "@/lib/app-settings";

function parseNum(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export type BillingAdminConfig = {
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  stripePricePlus?: string;
  stripePricePro?: string;
  stripePriceCreditsPack?: string;
  paystackSecretKey?: string;
  paystackCurrency: string;
  paystackPlanCodePlus?: string;
  paystackPlanCodePro?: string;
  paystackAmountCreditsMinor: number;
  allowance: Record<PlanTier, number>;
  creditsPackSize: number;
};

export async function getBillingAdminConfig(): Promise<BillingAdminConfig> {
  const [
    stripeSecretKey,
    stripeWebhookSecret,
    stripePricePlus,
    stripePricePro,
    stripePriceCreditsPack,
    paystackSecretKey,
    paystackCurrency,
    paystackPlanCodePlus,
    paystackPlanCodePro,
    paystackAmountCreditsMinor,
    allowanceFree,
    allowancePlus,
    allowancePro,
    creditsPackSize,
  ] = await Promise.all([
    getAppSettingValue(
      BILLING_SETTING_KEYS.stripeSecretKey,
      process.env.STRIPE_SECRET_KEY?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.stripeWebhookSecret,
      process.env.STRIPE_WEBHOOK_SECRET?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.stripePricePlus,
      process.env.STRIPE_PRICE_PLUS_MONTHLY?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.stripePricePro,
      process.env.STRIPE_PRICE_PRO_MONTHLY?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.stripePriceCreditsPack,
      process.env.STRIPE_PRICE_CREDITS_PACK?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.paystackSecretKey,
      process.env.PAYSTACK_SECRET_KEY?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.paystackCurrency,
      process.env.PAYSTACK_CURRENCY?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.paystackPlanCodePlus,
      process.env.PAYSTACK_PLAN_CODE_PLUS?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.paystackPlanCodePro,
      process.env.PAYSTACK_PLAN_CODE_PRO?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.paystackAmountCreditsMinor,
      process.env.PAYSTACK_AMOUNT_CREDITS_MINOR?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.allowanceFree,
      process.env.BILLING_FREE_MONTHLY_AI?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.allowancePlus,
      process.env.BILLING_PLUS_MONTHLY_AI?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.allowancePro,
      process.env.BILLING_PRO_MONTHLY_AI?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.creditsPackSize,
      process.env.CREDITS_PACK_SIZE?.trim() ??
        process.env.STRIPE_CREDITS_PACK_SIZE?.trim() ??
        process.env.PAYSTACK_CREDITS_PACK_SIZE?.trim(),
    ),
  ]);

  return {
    stripeSecretKey: stripeSecretKey?.trim() || undefined,
    stripeWebhookSecret: stripeWebhookSecret?.trim() || undefined,
    stripePricePlus: stripePricePlus?.trim() || undefined,
    stripePricePro: stripePricePro?.trim() || undefined,
    stripePriceCreditsPack: stripePriceCreditsPack?.trim() || undefined,
    paystackSecretKey: paystackSecretKey?.trim() || undefined,
    paystackCurrency: (paystackCurrency?.trim().toUpperCase() || "GHS"),
    paystackPlanCodePlus: paystackPlanCodePlus?.trim() || undefined,
    paystackPlanCodePro: paystackPlanCodePro?.trim() || undefined,
    paystackAmountCreditsMinor: parseNum(paystackAmountCreditsMinor, 5000),
    allowance: {
      FREE: parseNum(allowanceFree, 35),
      PLUS: parseNum(allowancePlus, 200),
      PRO: parseNum(allowancePro, 600),
    },
    creditsPackSize: parseNum(creditsPackSize, 50),
  };
}
