"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@/components/icon";
import {
  useBillingStatus,
  useCheckout,
  useOpenPortal,
} from "@/features/billing/api";
import { cn } from "@/lib/utils";

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
  const statusQuery = useBillingStatus();
  const checkoutMutation = useCheckout();
  const portalMutation = useOpenPortal();

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = statusQuery.data ?? null;
  const loading = statusQuery.isLoading;

  // Surface query errors as the local error banner.
  const queryError =
    statusQuery.isError && statusQuery.error instanceof Error
      ? statusQuery.error.message
      : null;
  const visibleError = error ?? queryError;

  const startCheckout = async (tier: "plus" | "pro" | "credits") => {
    setCheckoutLoading(tier);
    setError(null);
    try {
      const data = await checkoutMutation.mutateAsync(tier);
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError("No checkout URL returned.");
    } catch (e) {
      setError(
        toErrorMessage(e instanceof Error ? e.message : e, "Checkout failed."),
      );
    } finally {
      setCheckoutLoading(null);
    }
  };

  const openPortal = async () => {
    setCheckoutLoading("portal");
    setError(null);
    try {
      const data = await portalMutation.mutateAsync();
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
    } catch (e) {
      setError(
        toErrorMessage(e instanceof Error ? e.message : e, "Portal failed."),
      );
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-8 text-sm text-[var(--on-surface-variant)]">
        <Icon name="progress_activity" className="animate-spin" size={18} />
        Loading billing…
      </div>
    );
  }

  if (!status?.billingEnabled) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[var(--outline-variant)] p-6 text-sm text-[var(--on-surface-variant)]">
        <p className="m-0 font-bold text-[var(--on-surface)]">
          Billing is not configured on this deployment.
        </p>
        <p className="mt-2 leading-relaxed">
          Set <CodeChip>STRIPE_SECRET_KEY</CodeChip> or{" "}
          <CodeChip>PAYSTACK_SECRET_KEY</CodeChip> in <CodeChip>.env</CodeChip>.
          AI features remain available without plan limits in this state.
        </p>
      </div>
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
    <div className="space-y-5">
      {visibleError ? (
        <div className="glass-alert-error" role="alert">
          {visibleError}
        </div>
      ) : null}

      {/* Plan badge + period */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid h-12 w-12 place-items-center rounded-xl",
              proIsCurrent
                ? "bg-[var(--tertiary-fixed)] text-[var(--on-tertiary-container)]"
                : plusIsCurrent
                  ? "bg-[var(--primary-fixed)] text-[var(--primary)]"
                  : "bg-[var(--surface-container)] text-[var(--on-surface-variant)]",
            )}
          >
            <Icon
              name={proIsCurrent ? "workspace_premium" : "verified"}
              fill
              size={24}
            />
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--outline)]">
              Current plan
            </div>
            <div className="text-xl font-extrabold tracking-tight text-[var(--on-surface)]">
              {status.planTier}
            </div>
            {status.subscriptionStatus ? (
              <div className="text-xs text-[var(--on-surface-variant)]">
                {status.subscriptionStatus}
              </div>
            ) : null}
          </div>
        </div>
        {status.currentPeriodEnd ? (
          <div className="text-right">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--outline)]">
              Period ends
            </div>
            <div className="text-sm font-bold text-[var(--on-surface)]">
              {new Date(status.currentPeriodEnd).toLocaleDateString(undefined, {
                dateStyle: "medium",
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Usage bar */}
      <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="text-sm font-bold text-[var(--on-surface)]">
              Monthly AI allowance
            </div>
            <div className="text-xs text-[var(--on-surface-variant)]">
              Drafts, chat turns, and discovery flows. Bonus credits spend
              first.
            </div>
          </div>
          <div className="t-numeric text-base text-[var(--on-surface)]">
            {used} / {cap}
          </div>
        </div>
        <Progress
          value={pct}
          tone={pct >= 80 ? "warning" : "primary"}
          size="default"
        />
        <div className="mt-3 flex items-center justify-between text-xs text-[var(--on-surface-variant)]">
          <span className="inline-flex items-center gap-1.5">
            <Icon
              name="local_activity"
              size={14}
              className="text-[var(--secondary)]"
            />
            Bonus credits:{" "}
            <strong className="text-[var(--on-surface)]">
              {status.aiCreditsBalance}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => void statusQuery.refetch()}
            className="inline-flex items-center gap-1 text-[var(--primary)] underline-offset-4 hover:underline"
          >
            <Icon name="refresh" size={14} />
            Refresh usage
          </button>
        </div>
      </div>

      {/* Upgrade options */}
      <div className="grid gap-4 md:grid-cols-2">
        <PlanCard
          name="Plus"
          tagline="Best for steady outreach and drafting."
          icon="auto_awesome"
          highlighted={plusIsCurrent}
          ctaLabel={
            plusIsCurrent
              ? "Current plan"
              : status.canCheckoutPlus
                ? "Upgrade to Plus"
                : "Plus unavailable"
          }
          ctaDisabled={
            checkoutLoading !== null || plusIsCurrent || !status.canCheckoutPlus
          }
          ctaLoading={checkoutLoading === "plus"}
          onClick={() => void startCheckout("plus")}
          warning={
            !plusIsCurrent && !status.canCheckoutPlus
              ? "Plus checkout is temporarily unavailable."
              : null
          }
        />
        <PlanCard
          name="Pro"
          tagline="Highest monthly AI allowance for heavy usage."
          icon="workspace_premium"
          highlighted={proIsCurrent}
          ctaLabel={
            proIsCurrent
              ? "Current plan"
              : status.canCheckoutPro
                ? "Upgrade to Pro"
                : "Pro unavailable"
          }
          ctaDisabled={
            checkoutLoading !== null || proIsCurrent || !status.canCheckoutPro
          }
          ctaLoading={checkoutLoading === "pro"}
          onClick={() => void startCheckout("pro")}
          warning={
            !proIsCurrent && !status.canCheckoutPro
              ? "Pro checkout is temporarily unavailable."
              : null
          }
        />
      </div>

      {!status.canCheckoutPlus && !status.canCheckoutPro ? (
        <div className="glass-alert-warning text-xs">
          Plan upgrades are not available right now. Please try again shortly
          or contact support.
        </div>
      ) : null}

      {/* Credits + portal */}
      <div className="flex flex-wrap gap-2">
        {status.checkoutConfigured ? (
          <Button
            type="button"
            variant="secondary"
            disabled={checkoutLoading !== null || !status.canCheckoutCredits}
            loading={checkoutLoading === "credits"}
            icon="local_activity"
            onClick={() => void startCheckout("credits")}
          >
            Buy credits
          </Button>
        ) : (
          <p className="text-xs text-[var(--on-surface-variant)]">
            Checkout setup is incomplete — you can still refresh usage while
            this is being fixed.
          </p>
        )}
        {showPortal ? (
          <Button
            type="button"
            variant="ghost"
            disabled={checkoutLoading !== null}
            loading={checkoutLoading === "portal"}
            icon="settings"
            className="border border-[var(--outline-variant)]"
            onClick={() => void openPortal()}
          >
            Manage billing (Stripe)
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PlanCard({
  name,
  tagline,
  icon,
  highlighted,
  ctaLabel,
  ctaDisabled,
  ctaLoading,
  onClick,
  warning,
}: {
  name: string;
  tagline: string;
  icon: string;
  highlighted: boolean;
  ctaLabel: string;
  ctaDisabled: boolean;
  ctaLoading: boolean;
  onClick: () => void;
  warning: string | null;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-5",
        highlighted
          ? "border-[var(--primary)] bg-[var(--primary-fixed)]/30"
          : "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl"
            style={{
              background: highlighted
                ? "var(--primary-container)"
                : "rgba(0,98,157,0.08)",
              color: highlighted ? "white" : "var(--primary)",
            }}
          >
            <Icon name={icon} fill={highlighted} size={20} />
          </div>
          <div className="text-lg font-extrabold tracking-tight text-[var(--on-surface)]">
            {name}
          </div>
        </div>
        {highlighted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-container)]/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--primary)]">
            <Icon name="check" size={11} />
            Active
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-[var(--on-surface-variant)]">{tagline}</p>
      <Button
        type="button"
        size="sm"
        className="mt-4 w-full"
        variant={highlighted ? "ghost" : "primary"}
        disabled={ctaDisabled}
        loading={ctaLoading}
        onClick={onClick}
      >
        {ctaLabel}
      </Button>
      {warning ? (
        <p className="mt-2 text-xs text-[var(--streak-orange)]">{warning}</p>
      ) : null}
    </div>
  );
}

function CodeChip({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-[var(--surface-container)] px-1.5 py-0.5 font-mono text-[0.7rem] text-[var(--on-surface)]">
      {children}
    </code>
  );
}
