import { NextResponse } from "next/server";

import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { prisma } from "@/lib/prisma";

export const AI_ACTION_COSTS = {
  cold_email: 1,
  sop_session: 5,
  grammar_check: 1,
  school_recommendation: 1,
  school_infer: 1,
  generic: 1,
} as const;

export type AiActionCostKey = keyof typeof AI_ACTION_COSTS;

export class AiBudgetExceededError extends Error {
  readonly status = 402 as const;
  readonly code = "AI_QUOTA_EXCEEDED" as const;

  constructor(
    message = "Monthly AI allowance exhausted. Upgrade your plan or purchase credits in Settings.",
  ) {
    super(message);
    this.name = "AiBudgetExceededError";
  }
}

/**
 * Throws {@link AiBudgetExceededError} when the user has no credits and no monthly allowance left.
 * No-op when Stripe billing is not configured.
 */
export async function assertAiBudgetWithinLimit(userId: string): Promise<void> {
  await assertAiBudgetWithinLimitForAction(userId, "generic");
}

function monthToken(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function currentBillingMonthToken(now = new Date()): string {
  return monthToken(now);
}

async function maybeResetMonthlyUsage(userId: string): Promise<void> {
  const cfg = await getBillingAdminConfig();
  const token = monthToken();
  await prisma.user.updateMany({
    where: {
      id: userId,
      planTier: "FREE",
      OR: [{ aiUsageMonth: null }, { aiUsageMonth: { not: token } }],
    },
    data: {
      aiUsageUsed: 0,
      aiUsageMonth: token,
      aiCreditsBalance: { increment: cfg.freeMonthlyCreditsGrant },
    },
  });
  await prisma.user.updateMany({
    where: {
      id: userId,
      planTier: { not: "FREE" },
      OR: [{ aiUsageMonth: null }, { aiUsageMonth: { not: token } }],
    },
    data: {
      aiUsageUsed: 0,
      aiUsageMonth: token,
    },
  });
}

function resolveCost(action: AiActionCostKey): number {
  return AI_ACTION_COSTS[action] ?? 1;
}

export async function assertAiBudgetWithinLimitForAction(
  userId: string,
  action: AiActionCostKey,
): Promise<void> {
  const cfg = await getBillingAdminConfig();
  if (!cfg.stripeSecretKey && !cfg.paystackSecretKey) return;
  await maybeResetMonthlyUsage(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      planTier: true,
      aiCreditsBalance: true,
      aiUsageUsed: true,
      aiUsageMonth: true,
    },
  });
  if (!user) throw new Error("User not found");

  const cost = resolveCost(action);
  const allowance = cfg.allowance[user.planTier];
  if (user.aiCreditsBalance >= cost) return;
  if (user.aiUsageUsed + cost <= allowance) return;

  throw new AiBudgetExceededError();
}

/**
 * Consumes one AI credit: bonus pool first, then monthly allowance counter.
 * Call only after a successful LLM operation. No-op when billing is disabled.
 */
export async function finalizeAiConsumption(userId: string): Promise<void> {
  await finalizeAiConsumptionForAction(userId, "generic");
}

export async function finalizeAiConsumptionForAction(
  userId: string,
  action: AiActionCostKey,
): Promise<void> {
  const cfg = await getBillingAdminConfig();
  if (!cfg.stripeSecretKey && !cfg.paystackSecretKey) return;
  const token = monthToken();
  const cost = resolveCost(action);

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: {
        id: userId,
        planTier: "FREE",
        OR: [{ aiUsageMonth: null }, { aiUsageMonth: { not: token } }],
      },
      data: {
        aiUsageUsed: 0,
        aiUsageMonth: token,
        aiCreditsBalance: { increment: cfg.freeMonthlyCreditsGrant },
      },
    });

    await tx.user.updateMany({
      where: {
        id: userId,
        planTier: { not: "FREE" },
        OR: [{ aiUsageMonth: null }, { aiUsageMonth: { not: token } }],
      },
      data: {
        aiUsageUsed: 0,
        aiUsageMonth: token,
      },
    });

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        aiCreditsBalance: true,
        aiUsageUsed: true,
        planTier: true,
        aiUsageMonth: true,
      },
    });
    if (!user) return;

    if (user.aiCreditsBalance >= cost) {
      await tx.user.update({
        where: { id: userId },
        data: { aiCreditsBalance: { decrement: cost } },
      });
      return;
    }

    const allowance = cfg.allowance[user.planTier];
    if (user.aiUsageUsed + cost > allowance) {
      return;
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        aiUsageUsed: { increment: cost },
        aiUsageMonth: token,
      },
    });
  });
}

export function isAiBudgetError(
  e: unknown,
): e is AiBudgetExceededError {
  return e instanceof AiBudgetExceededError;
}

/** Returns a 402 JSON response when quota is exhausted; otherwise null. */
export async function billingPrecheckResponse(
  userId: string,
  action: AiActionCostKey = "generic",
): Promise<NextResponse | null> {
  try {
    await assertAiBudgetWithinLimitForAction(userId, action);
    return null;
  } catch (e) {
    if (isAiBudgetError(e)) {
      return NextResponse.json(
        { error: e.message, code: e.code },
        { status: 402 },
      );
    }
    throw e;
  }
}

export async function canUseFreeLifetimeEmailGeneration(
  userId: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planTier: true, freeEmailGenUsed: true },
  });
  if (!user) return false;
  if (user.planTier !== "FREE") return true;
  return user.freeEmailGenUsed < 1;
}

export async function canUseFreeLifetimeSopPreview(
  userId: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planTier: true, freeSopPreviewUsed: true },
  });
  if (!user) return false;
  if (user.planTier !== "FREE") return true;
  return user.freeSopPreviewUsed < 1;
}

export async function markFreeLifetimeEmailGenerationUsed(
  userId: string,
): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, planTier: "FREE", freeEmailGenUsed: { lt: 1 } },
    data: { freeEmailGenUsed: { increment: 1 } },
  });
}

export async function markFreeLifetimeSopPreviewUsed(
  userId: string,
): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, planTier: "FREE", freeSopPreviewUsed: { lt: 1 } },
    data: { freeSopPreviewUsed: { increment: 1 } },
  });
}
