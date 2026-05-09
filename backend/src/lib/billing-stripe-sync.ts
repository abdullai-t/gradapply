// @ts-nocheck
import type Stripe from "stripe";

import type { PlanTier } from "@/types/enums";
import { tierForStripePriceId } from "@/lib/billing-config";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { prisma } from "@/lib/prisma";

function resolvePlanTier(
  priceId: string | null,
  status: Stripe.Subscription.Status,
): PlanTier {
  const mapped = priceId ? tierForStripePriceId(priceId) : null;
  if (mapped) return mapped;
  if (status === "active" || status === "trialing") return "PLUS";
  return "FREE";
}

export async function syncUserSubscriptionFromStripe(
  userId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const planTier = resolvePlanTier(priceId, subscription.status);

  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      planTier,
      accessMode:
        subscription.status === "active" || subscription.status === "trialing"
          ? "FULL"
          : "READ_ONLY",
      accessReadOnlySince:
        subscription.status === "active" || subscription.status === "trialing"
          ? null
          : new Date(),
    },
  });
}

export async function grantCreditsPackToUser(
  userId: string,
  amount?: number,
): Promise<void> {
  const cfg = await getBillingAdminConfig();
  const n =
    typeof amount === "number" && Number.isFinite(amount) && amount > 0
      ? Math.floor(amount)
      : cfg.creditsPackSize;
  await prisma.user.update({
    where: { id: userId },
    data: { aiCreditsBalance: { increment: n } },
  });
}

export async function resetMonthlyUsageForSubscription(
  stripeSubscriptionId: string,
): Promise<void> {
  await prisma.user.updateMany({
    where: { stripeSubscriptionId },
    data: { aiUsageUsed: 0 },
  });
}
