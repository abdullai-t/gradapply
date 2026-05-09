"use client";

import { useBillingStatus } from "@/features/billing/api";

export interface AppStatus {
  loading: boolean;
  planTier: "FREE" | "PLUS" | "PRO" | null;
  monthlyAllowance: number | null;
  aiUsageUsed: number | null;
  aiCreditsBalance: number | null;
  /** Days streak — derived server-side from UserActivityDay (not yet shipped → 0). */
  streakDays: number;
}

/**
 * Shell-level snapshot of the user's billing + plan state, plus the streak
 * counter the topbar will eventually surface.
 *
 * Thin selector over `useBillingStatus` so multiple shell components
 * (sidebar, topbar, FAB) all dedupe to the same TanStack Query cache.
 */
export function useAppStatus(): AppStatus {
  const query = useBillingStatus();
  const data = query.data;

  return {
    loading: query.isLoading,
    planTier: (data?.planTier as AppStatus["planTier"]) ?? null,
    monthlyAllowance: data?.monthlyAllowance ?? null,
    aiUsageUsed: data?.aiUsageUsed ?? null,
    aiCreditsBalance: data?.aiCreditsBalance ?? null,
    // The billing status payload may carry `streakDays` once the
    // UserActivityDay table ships. Until then, default to 0.
    streakDays:
      ((data as unknown) as { streakDays?: number } | undefined)?.streakDays ??
      0,
  };
}
