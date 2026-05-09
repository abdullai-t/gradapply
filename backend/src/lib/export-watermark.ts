// @ts-nocheck
import type { PlanTier } from "@/types/enums";

export function canExportWithoutWatermark(planTier: PlanTier): boolean {
  return planTier === "PRO" || planTier === "PLUS";
}

export function shouldApplyExportWatermark(planTier: PlanTier): boolean {
  return !canExportWithoutWatermark(planTier);
}
