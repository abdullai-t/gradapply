import { PlanTier } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export type LockedFeature = "assistant" | "connectors" | "documents";

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
