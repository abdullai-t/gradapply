import { NextResponse } from "next/server";

import { isFeatureFlagEnabled } from "@/lib/feature-flags";
import { getUserPlanTier } from "@/lib/plan-gates";

/** PLUS/PRO required to create or manage review sessions; FREE may comment when invited. */
export async function requireCollaborationCreate(
  userId: string,
): Promise<NextResponse | null> {
  const enabled = await isFeatureFlagEnabled("collaboration");
  if (!enabled) {
    return NextResponse.json(
      {
        code: "FEATURE_DISABLED",
        error: "Collaboration is not available yet.",
      },
      { status: 403 },
    );
  }

  const planTier = await getUserPlanTier(userId);
  if (planTier && planTier !== "FREE") return null;

  return NextResponse.json(
    {
      code: "PLAN_UPGRADE_REQUIRED",
      feature: "collaboration",
      error:
        "Creating review sessions requires a PLUS or PRO plan. You can still comment when invited.",
    },
    { status: 402 },
  );
}

export async function requireCollaborationFeature(): Promise<NextResponse | null> {
  const enabled = await isFeatureFlagEnabled("collaboration");
  if (!enabled) {
    return NextResponse.json(
      {
        code: "FEATURE_DISABLED",
        error: "Collaboration is not available yet.",
      },
      { status: 403 },
    );
  }
  return null;
}
