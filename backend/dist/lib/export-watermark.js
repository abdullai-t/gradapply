export function canExportWithoutWatermark(planTier) {
    return planTier === "PRO" || planTier === "PLUS";
}
export function shouldApplyExportWatermark(planTier) {
    return !canExportWithoutWatermark(planTier);
}
