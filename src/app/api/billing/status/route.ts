import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  billingEnabled,
  checkoutReadyForTier,
  monthlyAiAllowanceForTier,
  paystackEnabled,
  stripeCheckoutConfigured,
  stripeEnabled,
} from "@/lib/billing-config";
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

  const allowance = monthlyAiAllowanceForTier(user.planTier);

  const checkoutConfigured =
    stripeCheckoutConfigured() ||
    checkoutReadyForTier("plus") ||
    checkoutReadyForTier("pro") ||
    checkoutReadyForTier("credits");

  return NextResponse.json({
    billingEnabled: billingEnabled(),
    checkoutConfigured,
    stripeEnabled: stripeEnabled(),
    paystackEnabled: paystackEnabled(),
    canCheckoutPlus: checkoutReadyForTier("plus"),
    canCheckoutPro: checkoutReadyForTier("pro"),
    canCheckoutCredits: checkoutReadyForTier("credits"),
    planTier: user.planTier,
    monthlyAllowance: allowance,
    aiUsageUsed: user.aiUsageUsed,
    aiCreditsBalance: user.aiCreditsBalance,
    subscriptionStatus: user.subscriptionStatus,
    currentPeriodEnd: user.currentPeriodEnd?.toISOString() ?? null,
    hasStripeCustomer: Boolean(user.stripeCustomerId),
    hasSubscription: Boolean(user.stripeSubscriptionId),
    hasPaystackCustomer: Boolean(user.paystackCustomerId),
  });
}
