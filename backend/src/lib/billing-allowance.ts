// @ts-nocheck
import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { User } from "@gradapply/db";

type UsageSlice = {
  planTier: string;
  aiCreditsBalance?: number | null;
  aiUsageUsed?: number | null;
  aiUsageMonth?: string | null;
  freeEmailGenUsed?: number | null;
  freeSopPreviewUsed?: number | null;
};

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
  await User.updateMany(
    {
      _id: userId,
      planTier: "FREE",
      $or: [{ aiUsageMonth: null }, { aiUsageMonth: { $ne: token } }],
    },
    {
      $set: { aiUsageUsed: 0, aiUsageMonth: token },
      $inc: { aiCreditsBalance: cfg.freeMonthlyCreditsGrant },
    },
  );
  await User.updateMany(
    {
      _id: userId,
      planTier: { $ne: "FREE" },
      $or: [{ aiUsageMonth: null }, { aiUsageMonth: { $ne: token } }],
    },
    { $set: { aiUsageUsed: 0, aiUsageMonth: token } },
  );
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

  const user = (await User.findById(userId)
    .select({ planTier: 1, aiCreditsBalance: 1, aiUsageUsed: 1, aiUsageMonth: 1 })
    .lean()) as UsageSlice | null;
  if (!user) throw new Error("User not found");

  const cost = resolveCost(action);
  const allowance = cfg.allowance[user.planTier as keyof typeof cfg.allowance];
  if ((user.aiCreditsBalance ?? 0) >= cost) return;
  if ((user.aiUsageUsed ?? 0) + cost <= allowance) return;

  throw new AiBudgetExceededError();
}

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

  await maybeResetMonthlyUsage(userId);

  const user = (await User.findById(userId)
    .select({
      aiCreditsBalance: 1,
      aiUsageUsed: 1,
      planTier: 1,
      aiUsageMonth: 1,
    })
    .lean()) as UsageSlice | null;
  if (!user) return;

  if ((user.aiCreditsBalance ?? 0) >= cost) {
    await User.findByIdAndUpdate(userId, {
      $inc: { aiCreditsBalance: -cost },
    });
    return;
  }

  const allowance = cfg.allowance[user.planTier as keyof typeof cfg.allowance];
  if ((user.aiUsageUsed ?? 0) + cost > allowance) {
    return;
  }

  await User.findByIdAndUpdate(userId, {
    $inc: { aiUsageUsed: cost },
    $set: { aiUsageMonth: token },
  });
}

export function isAiBudgetError(e: unknown): e is AiBudgetExceededError {
  return e instanceof AiBudgetExceededError;
}

export async function billingPrecheckResponse(
  userId: string,
  action: AiActionCostKey = "generic",
): Promise<Response | null> {
  try {
    await assertAiBudgetWithinLimitForAction(userId, action);
    return null;
  } catch (e) {
    if (isAiBudgetError(e)) {
      return Response.json(
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
  const user = (await User.findById(userId)
    .select({ planTier: 1, freeEmailGenUsed: 1 })
    .lean()) as UsageSlice | null;
  if (!user) return false;
  if (user.planTier !== "FREE") return true;
  return (user.freeEmailGenUsed ?? 0) < 1;
}

export async function canUseFreeLifetimeSopPreview(
  userId: string,
): Promise<boolean> {
  const user = (await User.findById(userId)
    .select({ planTier: 1, freeSopPreviewUsed: 1 })
    .lean()) as UsageSlice | null;
  if (!user) return false;
  if (user.planTier !== "FREE") return true;
  return (user.freeSopPreviewUsed ?? 0) < 1;
}

export async function markFreeLifetimeEmailGenerationUsed(
  userId: string,
): Promise<void> {
  await User.updateMany(
    { _id: userId, planTier: "FREE", freeEmailGenUsed: { $lt: 1 } },
    { $inc: { freeEmailGenUsed: 1 } },
  );
}

export async function markFreeLifetimeSopPreviewUsed(
  userId: string,
): Promise<void> {
  await User.updateMany(
    { _id: userId, planTier: "FREE", freeSopPreviewUsed: { $lt: 1 } },
    { $inc: { freeSopPreviewUsed: 1 } },
  );
}
