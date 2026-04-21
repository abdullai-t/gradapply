import type { PlanTier } from "@prisma/client";

import { grantCreditsPackToUser } from "@/lib/billing-stripe-sync";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import {
  paystackVerifyTransaction,
  type PaystackSubscriptionData,
} from "@/lib/paystack-api";
import { prisma } from "@/lib/prisma";

/**
 * Fulfill a completed Paystack transaction once (callback + webhook share this).
 * Credits path uses transaction metadata; subscription path uses customer + plan code.
 */
export async function processPaystackReference(reference: string): Promise<{
  duplicate: boolean;
  applied: boolean;
  kind?: "credits" | "subscription";
}> {
  const dup = await prisma.paystackEventLog.findUnique({
    where: { reference },
  });
  if (dup) return { duplicate: true, applied: false };

  const cfg = await getBillingAdminConfig();
  const tx = await paystackVerifyTransaction(reference, cfg.paystackSecretKey);
  if (!tx?.status || tx.status !== "success")
    return { duplicate: false, applied: false };

  const meta = (tx.metadata ?? {}) as Record<string, unknown>;
  const userIdMeta =
    typeof meta.userId === "string" ? meta.userId.trim() : null;

  const checkoutKind =
    typeof meta.checkoutKind === "string" ? meta.checkoutKind : "";
  const tierRaw =
    typeof meta.tier === "string" ? meta.tier.toLowerCase() : "";

  const isCredits =
    checkoutKind === "credits_pack" ||
    tierRaw === "credits" ||
    tierRaw === "credit";

  if (isCredits && userIdMeta) {
    await prisma.paystackEventLog.create({ data: { reference } });
    await grantCreditsPackToUser(userIdMeta);
    if (tx.customer?.id != null) {
      await prisma.user.update({
        where: { id: userIdMeta },
        data: {
          paystackCustomerId: String(tx.customer.id),
        },
      });
    }
    return { duplicate: false, applied: true, kind: "credits" };
  }

  const cid = tx.customer?.id;
  const planCode =
    typeof tx.plan?.plan_code === "string" ? tx.plan.plan_code : undefined;
  const tier =
    planCode && cfg.paystackPlanCodePlus && planCode === cfg.paystackPlanCodePlus
      ? ("PLUS" as const)
      : planCode &&
          cfg.paystackPlanCodePro &&
          planCode === cfg.paystackPlanCodePro
        ? ("PRO" as const)
        : null;

  if (tier && cid != null) {
    const user = await prisma.user.findFirst({
      where: { paystackCustomerId: String(cid) },
    });
    if (user) {
      await prisma.paystackEventLog.create({ data: { reference } });
      await prisma.user.update({
        where: { id: user.id },
        data: {
          planTier: tier,
          subscriptionStatus: "active",
          paystackCustomerId: String(cid),
        },
      });
      return { duplicate: false, applied: true, kind: "subscription" };
    }
  }

  return { duplicate: false, applied: false };
}

export async function upsertPaystackSubscriptionUser(opts: {
  userId: string;
  customerId: number;
  tier: PlanTier;
  sub: PaystackSubscriptionData;
}): Promise<void> {
  const next =
    opts.sub.next_payment_date != null &&
    opts.sub.next_payment_date !== ""
      ? new Date(opts.sub.next_payment_date)
      : null;

  await prisma.user.update({
    where: { id: opts.userId },
    data: {
      paystackCustomerId: String(opts.customerId),
      planTier: opts.tier,
      subscriptionStatus: opts.sub.status ?? "active",
      paystackSubscriptionCode: opts.sub.subscription_code ?? null,
      currentPeriodEnd: next,
    },
  });
}
