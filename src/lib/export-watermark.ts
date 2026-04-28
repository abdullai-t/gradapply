import type { PlanTier } from "@prisma/client";

export function canExportWithoutWatermark(planTier: PlanTier): boolean {
  return planTier === "PRO" || planTier === "PLUS";
}

export function shouldApplyExportWatermark(planTier: PlanTier): boolean {
  return !canExportWithoutWatermark(planTier);
}
