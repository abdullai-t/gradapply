"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type BillingStatus = {
  billingEnabled: boolean;
  checkoutConfigured: boolean;
  stripeEnabled: boolean;
  paystackEnabled: boolean;
  canCheckoutPlus: boolean;
  canCheckoutPro: boolean;
  canCheckoutCredits: boolean;
  planTier: string;
  monthlyAllowance: number;
  aiUsageUsed: number;
  aiCreditsBalance: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
};

export function BillingSettings() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/billing/status");
    if (!res.ok) {
      setError("Could not load billing status.");
      setLoading(false);
      return;
    }
    setStatus((await res.json()) as BillingStatus);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startCheckout = async (tier: "plus" | "pro" | "credits") => {
    setCheckoutLoading(tier);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Checkout failed.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No checkout URL returned.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const openPortal = async () => {
    setCheckoutLoading("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Portal failed.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <Card className="glass-panel border-white/10">
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading billing…
        </CardContent>
      </Card>
    );
  }

  if (!status?.billingEnabled) {
    return (
      <Card className="glass-panel border-white/10">
        <CardHeader>
          <CardTitle className="font-display text-lg">Billing</CardTitle>
          <CardDescription>
            Billing is not configured on this deployment (
            <code className="text-xs">STRIPE_SECRET_KEY</code> or{" "}
            <code className="text-xs">PAYSTACK_SECRET_KEY</code>). All AI
            features remain available without plan limits here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const used = status.aiUsageUsed;
  const cap = status.monthlyAllowance;
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;

  const showPortal = status.hasStripeCustomer && status.stripeEnabled;

  return (
    <Card className="glass-panel border-emerald-500/15">
      <CardHeader>
        <CardTitle className="font-display text-lg">Plan and AI usage</CardTitle>
        <CardDescription>
          Subscription includes a monthly pool of AI actions (drafts, chat,
          discovery, etc.). Bonus credits are used first, then your monthly
          allowance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-amber-200/90">{error}</p>
        ) : null}

        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span>
            Current plan:{" "}
            <strong className="text-foreground">{status.planTier}</strong>
            {status.subscriptionStatus ? (
              <span className="text-muted-foreground">
                {" "}
                · {status.subscriptionStatus}
              </span>
            ) : null}
          </span>
          {status.currentPeriodEnd ? (
            <span className="text-xs text-muted-foreground">
              Period ends{" "}
              {new Date(status.currentPeriodEnd).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </span>
          ) : null}
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Monthly allowance used</span>
            <span>
              {used} / {cap}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/30">
            <div
              className="h-full rounded-full bg-primary/80 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Bonus credits:{" "}
          <strong className="text-foreground">{status.aiCreditsBalance}</strong>
        </p>

        {!status.checkoutConfigured ? (
          <p className="text-xs text-amber-200/85">
            Set Stripe price IDs and/or Paystack plans in the server environment —{" "}
            <code className="text-[10px]">STRIPE_PRICE_*</code>,{" "}
            <code className="text-[10px]">PAYSTACK_PLAN_CODE_*</code>,{" "}
            <code className="text-[10px]">PAYSTACK_AMOUNT_CREDITS_MINOR</code> — to enable
            checkout buttons.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={
                checkoutLoading !== null || !status.canCheckoutPlus
              }
              onClick={() => void startCheckout("plus")}
            >
              {checkoutLoading === "plus" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Plus
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={checkoutLoading !== null || !status.canCheckoutPro}
              onClick={() => void startCheckout("pro")}
            >
              {checkoutLoading === "pro" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Pro
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                checkoutLoading !== null || !status.canCheckoutCredits
              }
              onClick={() => void startCheckout("credits")}
            >
              {checkoutLoading === "credits" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              Buy credits
            </Button>
            {showPortal ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={checkoutLoading !== null}
                onClick={() => void openPortal()}
              >
                {checkoutLoading === "portal" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                Manage billing (Stripe)
              </Button>
            ) : null}
          </div>
        )}

        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-xs"
          onClick={() => void load()}
        >
          Refresh usage
        </Button>
      </CardContent>
    </Card>
  );
}
