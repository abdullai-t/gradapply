import { NextResponse } from "next/server";
import type { PlanTier } from "@prisma/client";

import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { prisma } from "@/lib/prisma";

export const AI_ACTION_COSTS = {
  cold_email: 1,
  sop_session: 5,
  sop_review: 3,
  fit_score: 1,
  grammar_check: 1,
  school_recommendation: 1,
  school_infer: 1,
  generic: 1,
} as const;

export type AiActionCostKey = keyof typeof AI_ACTION_COSTS;

export class AiBudgetExceededError extends Error {
  readonly status = 402 as const;
  readonly code = "AI_QUOTA_EXCEEDED" as const;

  constructor(message: string) {
    super(message);
    this.name = "AiBudgetExceededError";
  }
}

function quotaExceededMessage(planTier: PlanTier): string {
  if (planTier === "FREE") {
    return "Your free signup credits are used up. Upgrade to Plus or Pro to continue.";
  }
  return "Plan allowance for this billing period is used up. Purchase credits in Settings to continue.";
}

/**
 * Throws {@link AiBudgetExceededError} when plan allowance and purchased credits are insufficient.
 * No-op when Paystack billing is not configured.
 */
export async function assertAiBudgetWithinLimit(userId: string): Promise<void> {
  await assertAiBudgetWithinLimitForAction(userId, "generic");
}

/** Stored in `aiUsageMonth` for paid users — keyed to subscription `currentPeriodEnd`. */
export function billingPeriodTokenFromEnd(periodEnd: Date | null): string | null {
  if (!periodEnd || Number.isNaN(periodEnd.getTime())) return null;
  return `period:${periodEnd.toISOString()}`;
}

type BillingCfg = Awaited<ReturnType<typeof getBillingAdminConfig>>;

type Tx = Pick<typeof prisma, "user">;

type UserBudgetRow = {
  planTier: PlanTier;
  aiCreditsBalance: number;
  aiUsageUsed: number;
  aiUsageMonth: string | null;
  currentPeriodEnd: Date | null;
};

const userBudgetSelect = {
  planTier: true,
  aiCreditsBalance: true,
  aiUsageUsed: true,
  aiUsageMonth: true,
  currentPeriodEnd: true,
} as const;

async function loadUserBudget(userId: string): Promise<UserBudgetRow | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: userBudgetSelect,
  });
}

async function loadUserBudgetTx(
  tx: Tx,
  userId: string,
): Promise<UserBudgetRow | null> {
  return tx.user.findUnique({
    where: { id: userId },
    select: userBudgetSelect,
  });
}

/** Paid: reset plan allowance when subscription billing period changes (not each calendar month). */
async function syncPaidBillingPeriod(
  tx: Tx,
  userId: string,
  periodEnd: Date | null,
): Promise<void> {
  const token = billingPeriodTokenFromEnd(periodEnd);
  if (!token) return;

  await tx.user.updateMany({
    where: {
      id: userId,
      planTier: { not: "FREE" },
      OR: [{ aiUsageMonth: null }, { aiUsageMonth: { not: token } }],
    },
    data: {
      aiUsageMonth: token,
      aiUsageUsed: 0,
    },
  });
}

/**
 * Call when a paid subscription period starts or renews (Paystack fulfillment).
 * Resets plan allowance for the new period; purchased credits are untouched.
 */
export async function resetPaidPlanPeriodAllowance(
  userId: string,
  periodEnd: Date,
): Promise<void> {
  const token = billingPeriodTokenFromEnd(periodEnd);
  if (!token) return;
  await prisma.user.update({
    where: { id: userId },
    data: {
      aiUsageUsed: 0,
      aiUsageMonth: token,
    },
  });
}

async function ensureBillingPeriodSynced(userId: string): Promise<void> {
  const user = await loadUserBudget(userId);
  if (!user || user.planTier === "FREE") return;

  await prisma.$transaction((tx) =>
    syncPaidBillingPeriod(tx, userId, user.currentPeriodEnd),
  );
}

function resolveCost(action: AiActionCostKey): number {
  return AI_ACTION_COSTS[action] ?? 1;
}

function hasPlanAllowance(
  user: UserBudgetRow,
  allowance: number,
  cost: number,
): boolean {
  if (user.planTier === "FREE") {
    return user.aiCreditsBalance >= cost;
  }
  return user.aiUsageUsed + cost <= allowance;
}

function hasPurchasedCredits(user: UserBudgetRow, cost: number): boolean {
  return user.aiCreditsBalance >= cost;
}

export async function assertAiBudgetWithinLimitForAction(
  userId: string,
  action: AiActionCostKey,
): Promise<void> {
  const cfg = await getBillingAdminConfig();
  if (!cfg.paystackSecretKey) return;

  await ensureBillingPeriodSynced(userId);

  const user = await loadUserBudget(userId);
  if (!user) throw new Error("User not found");

  const cost = resolveCost(action);
  const allowance = cfg.allowance[user.planTier];

  if (hasPlanAllowance(user, allowance, cost)) return;
  if (user.planTier !== "FREE" && hasPurchasedCredits(user, cost)) return;

  throw new AiBudgetExceededError(quotaExceededMessage(user.planTier));
}

/**
 * Consumes AI budget: plan allowance first (paid), then purchased credits.
 * FREE tier spends from the one-time signup credit balance only.
 */
export async function finalizeAiConsumption(userId: string): Promise<void> {
  await finalizeAiConsumptionForAction(userId, "generic");
}

export async function finalizeAiConsumptionForAction(
  userId: string,
  action: AiActionCostKey,
): Promise<void> {
  const cfg = await getBillingAdminConfig();
  if (!cfg.paystackSecretKey) return;
  const cost = resolveCost(action);

  await prisma.$transaction(async (tx) => {
    const user = await loadUserBudgetTx(tx, userId);
    if (!user) return;

    if (user.planTier !== "FREE") {
      await syncPaidBillingPeriod(tx, userId, user.currentPeriodEnd);
    }

    const fresh = await loadUserBudgetTx(tx, userId);
    if (!fresh) return;

    const allowance = cfg.allowance[fresh.planTier];

    if (fresh.planTier === "FREE") {
      if (fresh.aiCreditsBalance >= cost) {
        await tx.user.update({
          where: { id: userId },
          data: { aiCreditsBalance: { decrement: cost } },
        });
      }
      return;
    }

    if (fresh.aiUsageUsed + cost <= allowance) {
      await tx.user.update({
        where: { id: userId },
        data: { aiUsageUsed: { increment: cost } },
      });
      return;
    }

    if (fresh.aiCreditsBalance >= cost) {
      await tx.user.update({
        where: { id: userId },
        data: { aiCreditsBalance: { decrement: cost } },
      });
    }
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
