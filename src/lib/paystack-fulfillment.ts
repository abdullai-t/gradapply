import { Prisma, type PlanTier } from "@prisma/client";
import { addMonths } from "date-fns";

import { getPostHogClient } from "@/lib/posthog-server";
import { resetPaidPlanPeriodAllowance } from "@/lib/billing-allowance";
import { grantCreditsPackToUser } from "@/lib/billing-credits";
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import {
  paystackVerifyTransaction,
  type PaystackSubscriptionData,
} from "@/lib/paystack-api";
import {
  notifyInBackground,
  sendCreditsPurchasedEmail,
  sendPlanSubscriptionEmail,
} from "@/lib/notifications/send";
import { prisma } from "@/lib/prisma";

function isPaystackReferenceDuplicate(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function loadBillingRecipient(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      aiCreditsBalance: true,
      currentPeriodEnd: true,
      profile: { select: { timezone: true } },
    },
  });
}

/** Insert dedupe row first; only the winner proceeds to fulfillment. */
async function claimPaystackReference(
  reference: string,
): Promise<"claimed" | "duplicate"> {
  try {
    await prisma.paystackEventLog.create({ data: { reference } });
    return "claimed";
  } catch (error) {
    if (isPaystackReferenceDuplicate(error)) return "duplicate";
    throw error;
  }
}

/**
 * Fulfill a completed Paystack transaction once (callback + webhook share this).
 * Credits path uses transaction metadata; subscription path uses customer + plan code.
 */
export async function processPaystackReference(reference: string): Promise<{
  duplicate: boolean;
  applied: boolean;
  kind?: "credits" | "subscription";
}> {
  const cfg = await getBillingAdminConfig();
  const tx = await paystackVerifyTransaction(reference, cfg.paystackSecretKey);
  if (!tx?.status || tx.status !== "success") {
    return { duplicate: false, applied: false };
  }

  const claim = await claimPaystackReference(reference);
  if (claim === "duplicate") return { duplicate: true, applied: false };

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
    const creditsAdded =
      Number.isFinite(creditsFromMeta) && creditsFromMeta > 0
        ? creditsFromMeta
        : cfg.creditsPackSize;

    await grantCreditsPackToUser(userIdMeta, creditsAdded);
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
    const recipient = await loadBillingRecipient(userIdMeta);
    if (recipient) {
      notifyInBackground("credits", () =>
        sendCreditsPurchasedEmail({
          user: recipient,
          paystackReference: reference,
          creditsAdded,
          balanceAfter: recipient.aiCreditsBalance,
        }),
      );
    }
    const posthogCredits = getPostHogClient();
    posthogCredits?.capture({
      distinctId: userIdMeta,
      event: "payment_completed",
      properties: { kind: "credits_pack", credits_added: creditsAdded, reference },
    });
    return { duplicate: false, applied: true, kind: "credits" };
  }

  const isAddonService =
    checkoutKind === "cv_deep_review" || checkoutKind === "sop_detailed_critique";
  if (isAddonService && userIdMeta) {
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
      tierRaw === "plus"
        ? ("PLUS" as const)
        : tierRaw === "pro"
          ? ("PRO" as const)
          : null;
    if (!tierFromMeta) return { duplicate: false, applied: false };
    const now = tx.paidAt ? new Date(tx.paidAt) : new Date();
    const periodEnd = addMonths(now, 6);

    await prisma.user.update({
      where: { id: userIdMeta },
      data: {
        planTier: tierFromMeta,
        subscriptionStatus: "active",
        currentPeriodEnd: periodEnd,
        aiUsageUsed: 0,
        ...(tx.customer?.id != null
          ? { paystackCustomerId: String(tx.customer.id) }
          : {}),
        accessMode: "FULL",
        accessReadOnlySince: null,
      },
    });
    await resetPaidPlanPeriodAllowance(userIdMeta, periodEnd);
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
    const recipient = await loadBillingRecipient(userIdMeta);
    if (recipient) {
      notifyInBackground("plan", () =>
        sendPlanSubscriptionEmail({
          user: recipient,
          tier: tierFromMeta,
          paystackReference: reference,
          periodEnd,
          timezone: recipient.profile?.timezone,
        }),
      );
    }
    const posthogPlan = getPostHogClient();
    posthogPlan?.capture({
      distinctId: userIdMeta,
      event: "payment_completed",
      properties: {
        kind: "plan_purchase",
        tier: tierFromMeta,
        renewal: meta.renewal === "1",
        reference,
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
      const recipient = await loadBillingRecipient(user.id);
      if (recipient) {
        notifyInBackground("plan", () =>
          sendPlanSubscriptionEmail({
            user: recipient,
            tier,
            paystackReference: reference,
            periodEnd: recipient.currentPeriodEnd,
            timezone: recipient.profile?.timezone,
          }),
        );
      }
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

  if (next) {
    await resetPaidPlanPeriodAllowance(opts.userId, next);
  }
}
