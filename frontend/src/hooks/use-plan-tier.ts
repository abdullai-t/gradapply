"use client";

import { useBillingStatus } from "@/features/billing/api";

export interface PlanAllowance {
  used: number;
  cap: number;
  credits: number;
}

export interface UsePlanTierResult {
  planTier: string | null;
  allowance: PlanAllowance | null;
  loading: boolean;
}

/**
 * Single source of truth for the current user's plan tier + AI allowance.
 *
 * Thin selector over `useBillingStatus` from `src/features/billing/api.ts`,
 * so multiple consumers across the app dedupe to a single network request
 * via the shared `["billing", "status"]` query key.
 *
 * Replaces three near-identical `useEffect + fetch("/api/billing/status")`
 * blocks that used to live in dashboard / assistant / documents pages.
 */
export function usePlanTier(): UsePlanTierResult {
  const query = useBillingStatus();
  const data = query.data ?? null;

  return {
    planTier: data?.planTier ?? null,
    allowance: data
      ? {
          used: data.aiUsageUsed ?? 0,
          cap: data.monthlyAllowance ?? 0,
          credits: data.aiCreditsBalance ?? 0,
        }
      : null,
    loading: query.isLoading,
  };
}
