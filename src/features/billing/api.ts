"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export const billingKeys = {
  all: ["billing"] as const,
  status: () => ["billing", "status"] as const,
};

export type BillingStatus = {
  billingEnabled: boolean;
  checkoutConfigured: boolean;
  paystackEnabled: boolean;
  canCheckoutPlus: boolean;
  canCheckoutPro: boolean;
  canCheckoutCredits: boolean;
  canCheckoutCvReview: boolean;
  canCheckoutSopCritique: boolean;
  planTier: string;
  monthlyCredits: number;
  monthlyAllowance: number;
  aiUsageUsed: number;
  aiUsageMonth: string | null;
  aiCreditsBalance: number;
  freeEmailGenerationsRemaining: number | null;
  freeSopPreviewRemaining: number | null;
  accessMode: "FULL" | "READ_ONLY";
  canExportWithoutWatermark: boolean;
  displayPriceProGhs: number;
  displayPricePlusGhs: number;
  displayPriceCreditsPackGhs: number;
  creditUnitPriceGhs: number;
  creditsPackSize: number;
  displayPriceProRenewalGhs: number;
  displayPricePlusRenewalGhs: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasSubscription: boolean;
  hasPaystackCustomer: boolean;
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function useBillingStatus() {
  return useQuery({
    queryKey: billingKeys.status(),
    queryFn: async () =>
      jsonOrThrow<BillingStatus>(await fetch("/api/billing/status")),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export type CheckoutTier =
  | "plus"
  | "pro"
  | "credits"
  | "cv_review"
  | "sop_critique";

export function useCheckout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tier,
      renewal,
      creditsAmount,
    }: {
      tier: CheckoutTier;
      renewal?: boolean;
      creditsAmount?: 10 | 20 | 50 | 100;
    }) =>
      jsonOrThrow<{ url: string }>(
        await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            tier,
            renewal: Boolean(renewal),
            ...(typeof creditsAmount === "number" ? { creditsAmount } : {}),
          }),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: billingKeys.all });
    },
  });
}
