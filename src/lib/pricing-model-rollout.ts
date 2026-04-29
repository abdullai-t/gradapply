import { isFeatureEnabled } from "@/lib/feature-flags";

export async function isPricingModelRolloutEnabled(): Promise<boolean> {
  return isFeatureEnabled("billing_model_rollout", true, { fresh: false });
}
