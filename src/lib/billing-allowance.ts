import { NextResponse } from "next/server";

import { billingEnabled, monthlyAiAllowanceForTier } from "@/lib/billing-config";
import { prisma } from "@/lib/prisma";

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
  if (!billingEnabled()) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      planTier: true,
      aiCreditsBalance: true,
      aiUsageUsed: true,
    },
  });
  if (!user) throw new Error("User not found");

  const allowance = monthlyAiAllowanceForTier(user.planTier);
  if (user.aiCreditsBalance > 0) return;
  if (user.aiUsageUsed < allowance) return;

  throw new AiBudgetExceededError();
}

/**
 * Consumes one AI credit: bonus pool first, then monthly allowance counter.
 * Call only after a successful LLM operation. No-op when billing is disabled.
 */
export async function finalizeAiConsumption(userId: string): Promise<void> {
  if (!billingEnabled()) return;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: {
        aiCreditsBalance: true,
        aiUsageUsed: true,
        planTier: true,
      },
    });
    if (!user) return;

    if (user.aiCreditsBalance > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { aiCreditsBalance: { decrement: 1 } },
      });
      return;
    }

    const allowance = monthlyAiAllowanceForTier(user.planTier);
    if (user.aiUsageUsed >= allowance) {
      return;
    }

    await tx.user.update({
      where: { id: userId },
      data: { aiUsageUsed: { increment: 1 } },
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
): Promise<NextResponse | null> {
  try {
    await assertAiBudgetWithinLimit(userId);
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
