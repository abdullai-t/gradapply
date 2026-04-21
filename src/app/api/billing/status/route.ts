import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      planTier: true,
      aiUsageUsed: true,
      aiCreditsBalance: true,
      subscriptionStatus: true,
      currentPeriodEnd: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      paystackCustomerId: true,
    },
  });

  if (!user)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cfg = await getBillingAdminConfig();
  const stripeEnabled = Boolean(cfg.stripeSecretKey);
  const paystackEnabled = Boolean(cfg.paystackSecretKey);
  const billingEnabled = stripeEnabled || paystackEnabled;
  const canCheckoutPlus =
    (stripeEnabled && Boolean(cfg.stripePricePlus)) ||
    (paystackEnabled && Boolean(cfg.paystackPlanCodePlus));
  const canCheckoutPro =
    (stripeEnabled && Boolean(cfg.stripePricePro)) ||
    (paystackEnabled && Boolean(cfg.paystackPlanCodePro));
  const canCheckoutCredits =
    (stripeEnabled && Boolean(cfg.stripePriceCreditsPack)) ||
    (paystackEnabled && cfg.paystackAmountCreditsMinor > 0);
  const checkoutConfigured = canCheckoutPlus || canCheckoutPro || canCheckoutCredits;
  const allowance = cfg.allowance[user.planTier];
  const settingsEnabled = await isFeatureEnabled("user_settings_page", false);

  return NextResponse.json({
    billingEnabled,
    checkoutConfigured,
    stripeEnabled,
    paystackEnabled,
    canCheckoutPlus,
    canCheckoutPro,
    canCheckoutCredits,
    planTier: user.planTier,
    monthlyAllowance: allowance,
    aiUsageUsed: user.aiUsageUsed,
    aiCreditsBalance: user.aiCreditsBalance,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
    hasStripeCustomer: Boolean(user.stripeCustomerId),
    hasSubscription: Boolean(user.stripeSubscriptionId),
    hasPaystackCustomer: Boolean(user.paystackCustomerId),
    settingsEnabled,
  });
}
