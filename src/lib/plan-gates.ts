import { PlanTier } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { isPricingModelRolloutEnabled } from "@/lib/pricing-model-rollout";

export type LockedFeature = "assistant" | "connectors" | "documents";
export type AccountAccessMode = "FULL" | "READ_ONLY";

const featureLabel: Record<LockedFeature, string> = {
  assistant: "AI assistant",
  connectors: "Connectors",
  documents: "Documents",
};

export async function getUserPlanTier(userId: string): Promise<PlanTier | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planTier: true },
  });
  return user?.planTier ?? null;
}

export async function getUserAccessMode(
  userId: string,
): Promise<AccountAccessMode | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { accessMode: true },
  });
  return (user?.accessMode as AccountAccessMode | undefined) ?? null;
}

export async function requireWritableAccount(
  userId: string,
): Promise<NextResponse | null> {
  const enabled = await isPricingModelRolloutEnabled();
  if (!enabled) return null;
  const mode = await getUserAccessMode(userId);
  if (!mode || mode === "FULL") return null;
  return NextResponse.json(
    {
      code: "ACCOUNT_READ_ONLY",
      error:
        "Your subscription is expired and this account is currently read-only. You can still view data and export.",
    },
    { status: 402 },
  );
}

export async function schoolTrackingLimitForUser(
  userId: string,
): Promise<number> {
  const enabled = await isPricingModelRolloutEnabled();
  if (!enabled) return 9999;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { planTier: true },
  });
  if (!user) return 3;
  if (user.planTier === "FREE") return 3;
  return 25;
}

export async function requireSchoolTrackingCapacity(
  userId: string,
): Promise<NextResponse | null> {
  const limit = await schoolTrackingLimitForUser(userId);
  const current = await prisma.school.count({ where: { userId } });
  if (current < limit) return null;
  return NextResponse.json(
    {
      code: "SCHOOL_LIMIT_REACHED",
      error: `School tracking limit reached (${limit}).`,
      limit,
      current,
    },
    { status: 402 },
  );
}

export async function requireNonFreeForFeature(
  userId: string,
  feature: LockedFeature,
): Promise<NextResponse | null> {
  const planTier = await getUserPlanTier(userId);
  if (planTier && planTier !== "FREE") return null;

  return NextResponse.json(
    {
      code: "PLAN_UPGRADE_REQUIRED",
      feature,
      error: `${featureLabel[feature]} is available on PLUS and PRO plans.`,
    },
    { status: 402 },
  );
}
