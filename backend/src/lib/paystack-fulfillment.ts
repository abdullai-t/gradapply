// @ts-nocheck
import type { PlanTier } from "@/types/enums";

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
    const creditsFromMeta = Number.parseInt(
      typeof meta.creditsAmount === "string"
        ? meta.creditsAmount
        : String(meta.creditsAmount ?? ""),
      10,
    );
    await prisma.paystackEventLog.create({ data: { reference } });
    await grantCreditsPackToUser(
      userIdMeta,
      Number.isFinite(creditsFromMeta) ? creditsFromMeta : undefined,
    );
    await prisma.billingPayment.create({
      data: {
        userId: userIdMeta,
        provider: "PAYSTACK",
        providerReference: reference,
        kind: "CREDITS_PACK",
        amountMinor:
          typeof tx.amount === "number" ? Math.round(tx.amount) : null,
        currency: tx.currency ?? null,
        paidAt: tx.paidAt ? new Date(tx.paidAt) : new Date(),
      },
    });
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

  const isAddonService =
    checkoutKind === "cv_deep_review" || checkoutKind === "sop_detailed_critique";
  if (isAddonService && userIdMeta) {
    await prisma.paystackEventLog.create({ data: { reference } });
    await prisma.billingPayment.create({
      data: {
        userId: userIdMeta,
        provider: "PAYSTACK",
        providerReference: reference,
        kind:
          checkoutKind === "cv_deep_review"
            ? "CV_DEEP_REVIEW"
            : "SOP_DETAILED_CRITIQUE",
        amountMinor:
          typeof tx.amount === "number" ? Math.round(tx.amount) : null,
        currency: tx.currency ?? null,
        paidAt: tx.paidAt ? new Date(tx.paidAt) : new Date(),
      },
    });
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

  const isPlanPurchase = checkoutKind === "plan_purchase";
  if (isPlanPurchase && userIdMeta) {
    const tierFromMeta =
      tierRaw === "plus" ? ("PLUS" as const) : tierRaw === "pro" ? ("PRO" as const) : null;
    if (!tierFromMeta) return { duplicate: false, applied: false };
    const now = tx.paidAt ? new Date(tx.paidAt) : new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 6);

    await prisma.paystackEventLog.create({ data: { reference } });
    await prisma.user.update({
      where: { id: userIdMeta },
      data: {
        planTier: tierFromMeta,
        subscriptionStatus: "active",
        currentPeriodEnd: periodEnd,
        ...(tx.customer?.id != null
          ? { paystackCustomerId: String(tx.customer.id) }
          : {}),
        accessMode: "FULL",
        accessReadOnlySince: null,
      },
    });
    await prisma.billingPayment.create({
      data: {
        userId: userIdMeta,
        provider: "PAYSTACK",
        providerReference: reference,
        kind: "PLAN_PURCHASE",
        tier: tierFromMeta,
        amountMinor:
          typeof tx.amount === "number" ? Math.round(tx.amount) : null,
        currency: tx.currency ?? null,
        paidAt: now,
      },
    });
    return { duplicate: false, applied: true, kind: "subscription" };
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
          accessMode: "FULL",
          accessReadOnlySince: null,
        },
      });
      await prisma.billingPayment.create({
        data: {
          userId: user.id,
          provider: "PAYSTACK",
          providerReference: reference,
          kind: "PLAN_PURCHASE",
          tier,
          amountMinor:
            typeof tx.amount === "number" ? Math.round(tx.amount) : null,
          currency: tx.currency ?? null,
          paidAt: tx.paidAt ? new Date(tx.paidAt) : new Date(),
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
      accessMode: "FULL",
      accessReadOnlySince: null,
    },
  });
}
