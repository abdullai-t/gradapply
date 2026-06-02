import type { PlanTier } from "@prisma/client";

import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { canExportWithoutWatermark } from "@/lib/export-watermark";
import { prisma } from "@/lib/prisma";

import type { BillingStatus } from "@/features/billing/api";

function subscriptionActive(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

/** Shared by `/api/billing/status` and main layout shell hydration. */
export async function buildBillingStatusForUser(
  userId: string,
): Promise<BillingStatus | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      planTier: true,
      aiUsageUsed: true,
      aiCreditsBalance: true,
      aiUsageMonth: true,
      freeEmailGenUsed: true,
      freeSopPreviewUsed: true,
      accessMode: true,
      accessReadOnlySince: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      paystackCustomerId: true,
      paystackSubscriptionCode: true,
    },
  });
  if (!user) return null;

  const now = new Date();
  const isExpired =
    user.planTier !== "FREE" &&
    user.currentPeriodEnd != null &&
    user.currentPeriodEnd.getTime() < now.getTime() &&
    user.subscriptionStatus !== "active" &&
    user.subscriptionStatus !== "trialing";
  if (isExpired && user.accessMode !== "READ_ONLY") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        accessMode: "READ_ONLY",
        accessReadOnlySince: user.accessReadOnlySince ?? now,
      },
    });
    user.accessMode = "READ_ONLY";
  }

  const cfg = await getBillingAdminConfig();
  const paystackEnabled = Boolean(cfg.paystackSecretKey);
  const billingEnabled = paystackEnabled;
  const canCheckoutPlus = paystackEnabled && cfg.displayPricePlusGhs > 0;
  const canCheckoutPro = paystackEnabled && cfg.displayPriceProGhs > 0;
  const canCheckoutCredits = paystackEnabled && cfg.creditUnitPriceGhs > 0;
  const canCheckoutCvReview =
    paystackEnabled && cfg.paystackAmountCvDeepReviewMinor > 0;
  const canCheckoutSopCritique =
    paystackEnabled && cfg.paystackAmountSopDetailedCritiqueMinor > 0;
  const checkoutConfigured =
    canCheckoutPlus ||
    canCheckoutPro ||
    canCheckoutCredits ||
    canCheckoutCvReview ||
    canCheckoutSopCritique;
  const allowance = cfg.allowance[user.planTier as PlanTier];

  const hasSubscription =
    Boolean(user.paystackSubscriptionCode) ||
    (user.planTier !== "FREE" && subscriptionActive(user.subscriptionStatus));

  return {
    billingEnabled,
    checkoutConfigured,
    paystackEnabled,
    canCheckoutPlus,
    canCheckoutPro,
    canCheckoutCredits,
    canCheckoutCvReview,
    canCheckoutSopCritique,
    planTier: user.planTier,
    monthlyCredits: allowance,
    monthlyAllowance: allowance,
    periodAllowance: allowance,
    aiUsageUsed: user.aiUsageUsed,
    aiUsageMonth: user.aiUsageMonth,
    purchasedCredits: user.aiCreditsBalance,
    aiCreditsBalance: user.aiCreditsBalance,
    freeEmailGenerationsRemaining:
      user.planTier === "FREE" ? Math.max(0, 1 - user.freeEmailGenUsed) : null,
    freeSopPreviewRemaining:
      user.planTier === "FREE" ? Math.max(0, 1 - user.freeSopPreviewUsed) : null,
    accessMode: user.accessMode,
    canExportWithoutWatermark: canExportWithoutWatermark(user.planTier),
    displayPriceProGhs: cfg.displayPriceProGhs,
    displayPricePlusGhs: cfg.displayPricePlusGhs,
    displayPriceCreditsPackGhs: cfg.displayPriceCreditsPackGhs,
    creditUnitPriceGhs: cfg.creditUnitPriceGhs,
    displayPriceProRenewalGhs: cfg.displayPriceProRenewalGhs,
    displayPricePlusRenewalGhs: cfg.displayPricePlusRenewalGhs,
    creditsPackSize: cfg.creditsPackSize,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
    hasSubscription,
    hasPaystackCustomer: Boolean(user.paystackCustomerId),
  };
}
