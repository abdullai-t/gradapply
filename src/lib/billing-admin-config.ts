import { PlanTier } from "@prisma/client";

import { BILLING_SETTING_KEYS, getAppSettingValue } from "@/lib/app-settings";

function parseNum(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export type BillingAdminConfig = {
  paystackSecretKey?: string;
  paystackCurrency: string;
  paystackPlanCodePlus?: string;
  paystackPlanCodePro?: string;
  paystackPlanCodeProRenewal?: string;
  paystackPlanCodePlusRenewal?: string;
  paystackAmountCreditsMinor: number;
  displayPriceProGhs: number;
  displayPricePlusGhs: number;
  displayPriceCreditsPackGhs: number;
  creditUnitPriceGhs: number;
  displayPriceProRenewalGhs: number;
  displayPricePlusRenewalGhs: number;
  paystackAmountCvDeepReviewMinor: number;
  paystackAmountSopDetailedCritiqueMinor: number;
  allowance: Record<PlanTier, number>;
  freeSignupCredits: number;
  freeMonthlyCreditsGrant: number;
  creditsPackSize: number;
};

export async function getBillingAdminConfig(): Promise<BillingAdminConfig> {
  const [
    paystackSecretKey,
    paystackCurrency,
    paystackPlanCodePlus,
    paystackPlanCodePro,
    paystackAmountCreditsMinor,
    displayPriceProGhs,
    displayPricePlusGhs,
    displayPriceCreditsPackGhs,
    creditUnitPriceGhs,
    displayPriceProRenewalGhs,
    displayPricePlusRenewalGhs,
    paystackPlanCodeProRenewal,
    paystackPlanCodePlusRenewal,
    paystackAmountCvDeepReviewMinor,
    paystackAmountSopDetailedCritiqueMinor,
    freeSignupCredits,
    freeMonthlyCreditsGrant,
    creditsPackSize,
  ] = await Promise.all([
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
      BILLING_SETTING_KEYS.displayPriceProGhs,
      process.env.BILLING_DISPLAY_PRO_GHS?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.displayPricePlusGhs,
      process.env.BILLING_DISPLAY_PLUS_GHS?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.displayPriceCreditsPackGhs,
      process.env.BILLING_DISPLAY_CREDITS_PACK_GHS?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.creditUnitPriceGhs,
      process.env.BILLING_CREDIT_UNIT_PRICE_GHS?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.displayPriceProRenewalGhs,
      process.env.BILLING_DISPLAY_PRO_RENEWAL_GHS?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.displayPricePlusRenewalGhs,
      process.env.BILLING_DISPLAY_PLUS_RENEWAL_GHS?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.paystackPlanCodeProRenewal,
      process.env.PAYSTACK_PLAN_CODE_PRO_RENEWAL?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.paystackPlanCodePlusRenewal,
      process.env.PAYSTACK_PLAN_CODE_PLUS_RENEWAL?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.paystackAmountCvDeepReviewMinor,
      process.env.PAYSTACK_AMOUNT_CV_DEEP_REVIEW_MINOR?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.paystackAmountSopDetailedCritiqueMinor,
      process.env.PAYSTACK_AMOUNT_SOP_DETAILED_CRITIQUE_MINOR?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.freeSignupCredits,
      process.env.BILLING_FREE_SIGNUP_CREDITS?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.freeMonthlyCreditsGrant,
      process.env.BILLING_FREE_MONTHLY_CREDITS_GRANT?.trim(),
    ),
    getAppSettingValue(
      BILLING_SETTING_KEYS.creditsPackSize,
      process.env.CREDITS_PACK_SIZE?.trim() ??
        process.env.PAYSTACK_CREDITS_PACK_SIZE?.trim(),
    ),
  ]);

  return {
    paystackSecretKey: paystackSecretKey?.trim() || undefined,
    paystackCurrency: (paystackCurrency?.trim().toUpperCase() || "GHS"),
    paystackPlanCodePlus: paystackPlanCodePlus?.trim() || undefined,
    paystackPlanCodePro: paystackPlanCodePro?.trim() || undefined,
    paystackPlanCodeProRenewal:
      paystackPlanCodeProRenewal?.trim() || undefined,
    paystackPlanCodePlusRenewal:
      paystackPlanCodePlusRenewal?.trim() || undefined,
    paystackAmountCreditsMinor: parseNum(paystackAmountCreditsMinor, 5000),
    displayPriceProGhs: parseNum(displayPriceProGhs, 18),
    displayPricePlusGhs: parseNum(displayPricePlusGhs, 35),
    displayPriceCreditsPackGhs: parseNum(displayPriceCreditsPackGhs, 5),
    creditUnitPriceGhs: parseNum(creditUnitPriceGhs, 1),
    displayPriceProRenewalGhs: parseNum(displayPriceProRenewalGhs, 15),
    displayPricePlusRenewalGhs: parseNum(displayPricePlusRenewalGhs, 30),
    paystackAmountCvDeepReviewMinor: parseNum(
      paystackAmountCvDeepReviewMinor,
      3000,
    ),
    paystackAmountSopDetailedCritiqueMinor: parseNum(
      paystackAmountSopDetailedCritiqueMinor,
      5000,
    ),
    allowance: {
      FREE: 0,
      PLUS: 200,
      PRO: 80,
    },
    freeSignupCredits: parseNum(freeSignupCredits, 20),
    freeMonthlyCreditsGrant: parseNum(freeMonthlyCreditsGrant, 10),
    creditsPackSize: parseNum(creditsPackSize, 50),
  };
}
