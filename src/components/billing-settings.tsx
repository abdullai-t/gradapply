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

function toErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object") {
    const maybe = value as {
      message?: unknown;
      formErrors?: unknown;
      fieldErrors?: unknown;
    };
    if (typeof maybe.message === "string" && maybe.message.trim()) {
      return maybe.message;
    }
    if (Array.isArray(maybe.formErrors) || maybe.fieldErrors) {
      return "Some billing fields are invalid. Please review your configuration and try again.";
    }
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

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
      const data = (await res.json().catch(() => null)) as { error?: unknown } | null;
      setError(toErrorMessage(data?.error, "Could not load billing status."));
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
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: unknown }
        | null;
      if (!res.ok) {
        setError(toErrorMessage(data?.error, "Checkout failed."));
        return;
      }
      if (data?.url) {
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
      const data = (await res.json().catch(() => null)) as
        | { url?: string; error?: unknown }
        | null;
      if (!res.ok) {
        setError(toErrorMessage(data?.error, "Portal failed."));
        return;
      }
      if (data?.url) {
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
  const currentPlan = status.planTier.toUpperCase();
  const plusIsCurrent = currentPlan === "PLUS";
  const proIsCurrent = currentPlan === "PRO";

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

        <div className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-medium text-foreground">Upgrade your plan</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-sm font-medium text-foreground">Plus</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Best for steady outreach and drafting.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3 w-full"
                variant={plusIsCurrent ? "secondary" : "default"}
                disabled={
                  checkoutLoading !== null || plusIsCurrent || !status.canCheckoutPlus
                }
                onClick={() => void startCheckout("plus")}
              >
                {checkoutLoading === "plus" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                {plusIsCurrent
                  ? "Current plan"
                  : status.canCheckoutPlus
                    ? "Upgrade to Plus"
                    : "Plus unavailable"}
              </Button>
              {!plusIsCurrent && !status.canCheckoutPlus ? (
                <p className="mt-2 text-xs text-amber-200/90">
                  Plus checkout is temporarily unavailable.
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-sm font-medium text-foreground">Pro</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Highest monthly AI allowance for heavy usage.
              </p>
              <Button
                type="button"
                size="sm"
                className="mt-3 w-full"
                variant={proIsCurrent ? "secondary" : "default"}
                disabled={checkoutLoading !== null || proIsCurrent || !status.canCheckoutPro}
                onClick={() => void startCheckout("pro")}
              >
                {checkoutLoading === "pro" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                ) : null}
                {proIsCurrent
                  ? "Current plan"
                  : status.canCheckoutPro
                    ? "Upgrade to Pro"
                    : "Pro unavailable"}
              </Button>
              {!proIsCurrent && !status.canCheckoutPro ? (
                <p className="mt-2 text-xs text-amber-200/90">
                  Pro checkout is temporarily unavailable.
                </p>
              ) : null}
            </div>
          </div>
          {!status.canCheckoutPlus && !status.canCheckoutPro ? (
            <p className="text-xs text-amber-200/90">
              Plan upgrades are not available right now. Please try again shortly or contact support.
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {!status.checkoutConfigured ? (
            <p className="text-xs text-amber-200/85">
              Checkout setup is incomplete. You can still refresh usage while this is being fixed.
            </p>
          ) : (
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
          )}
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
