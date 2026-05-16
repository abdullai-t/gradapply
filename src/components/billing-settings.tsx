"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Icon } from "@/components/icon";
import {
  type CheckoutTier,
  useBillingStatus,
  useCheckout,
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

  const startCheckout = async (tier: CheckoutTier, renewal = false) => {
    setCheckoutLoading(tier);
    setError(null);
    try {
      const data = await checkoutMutation.mutateAsync({ tier, renewal });
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
          Set <CodeChip>PAYSTACK_SECRET_KEY</CodeChip> in <CodeChip>.env</CodeChip>.
          AI features remain available without plan limits in this state.
        </p>
      </div>
    );
  }

  const used = status.aiUsageUsed;
  const cap = status.monthlyAllowance;
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;

  const currentPlan = status.planTier.toUpperCase();
  const isFreePlan = currentPlan === "FREE";
  const plusIsCurrent = currentPlan === "PLUS";
  const proIsCurrent = currentPlan === "PRO";
  const isExpired =
    status.accessMode === "READ_ONLY" ||
    (status.currentPeriodEnd
      ? new Date(status.currentPeriodEnd).getTime() < Date.now()
      : false);
  const showProRenewal = isExpired && currentPlan === "PRO";
  const showPlusRenewal = isExpired && currentPlan === "PLUS";

  return (
    <div className="space-y-5">
      {visibleError ? (
        <div className="glass-alert-error" role="alert">
          {visibleError}
        </div>
      ) : null}
      {status.accessMode === "READ_ONLY" ? (
        <div className="glass-alert-warning" role="status">
          Account is currently read-only because your subscription expired.
          Exports remain available.
        </div>
      ) : null}

      {/* Usage bar */}
      <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="text-sm font-bold text-[var(--on-surface)]">
              Monthly credits
            </div>
            <div className="text-xs text-[var(--on-surface-variant)]">
              {isFreePlan
                ? "Free tier uses credit balance and monthly credit grants."
                : "Monthly credits expire each month. Purchased bonus credits are consumed first."}
            </div>
          </div>
          <div className="t-numeric text-base text-[var(--on-surface)]">
            {isFreePlan ? `${status.aiCreditsBalance} available` : `${used} / ${cap}`}
          </div>
        </div>
        <Progress
          value={isFreePlan ? 0 : pct}
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
        {status.planTier === "FREE" ? (
          <div className="mt-3 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3 text-xs text-[var(--on-surface-variant)]">
            Lifetime free limits: {status.freeEmailGenerationsRemaining ?? 0} cold
            email generation left, {status.freeSopPreviewRemaining ?? 0} SOP preview
            left. Free exports are watermarked.
          </div>
        ) : (
          <div className="mt-3 text-xs text-[var(--on-surface-variant)]">
            Your exports are generated without watermark on this plan.
          </div>
        )}
      </div>

      {/* Upgrade options */}
      <div className="grid gap-4 md:grid-cols-2">
        <PlanCard
          name="Pro"
          priceLabel={`GHS ${status.displayPriceProGhs}`}
          creditLabel="80 credits/month"
          summary="Full core toolkit"
          icon="workspace_premium"
          highlighted={proIsCurrent}
          ctaLabel={
            proIsCurrent
              ? "Current plan"
              : status.canCheckoutPro
                ? "Choose Pro"
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
        <PlanCard
          name="Plus"
          priceLabel={`GHS ${status.displayPricePlusGhs}`}
          creditLabel="200 credits/month"
          summary="Advanced guidance"
          icon="auto_awesome"
          highlighted={plusIsCurrent}
          ctaLabel={
            plusIsCurrent
              ? "Current plan"
              : status.canCheckoutPlus
                ? "Choose Plus"
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
      </div>

      {!status.canCheckoutPlus && !status.canCheckoutPro ? (
        <div className="glass-alert-warning text-xs">
          Plan upgrades are not available right now. Please try again shortly
          or contact support.
        </div>
      ) : null}

      {/* Credits */}
      <div className="flex flex-wrap gap-2">
        {status.checkoutConfigured ? (
          <>
            {[10, 20, 50, 100].map((credits) => (
              <Button
                key={credits}
                type="button"
                variant="secondary"
                disabled={checkoutLoading !== null || !status.canCheckoutCredits}
                loading={checkoutLoading === `credits-${credits}`}
                icon="local_activity"
                onClick={async () => {
                  setCheckoutLoading(`credits-${credits}`);
                  setError(null);
                  try {
                    const data = await checkoutMutation.mutateAsync({
                      tier: "credits",
                      creditsAmount: credits as 10 | 20 | 50 | 100,
                    });
                    if (data?.url) {
                      window.location.href = data.url;
                      return;
                    }
                    setError("No checkout URL returned.");
                  } catch (e) {
                    setError(
                      toErrorMessage(
                        e instanceof Error ? e.message : e,
                        "Checkout failed.",
                      ),
                    );
                  } finally {
                    setCheckoutLoading(null);
                  }
                }}
              >
                Buy {credits} credits (GHS {credits * status.creditUnitPriceGhs})
              </Button>
            ))}
          </>
        ) : (
          <p className="text-xs text-[var(--on-surface-variant)]">
            Checkout setup is incomplete — you can still refresh usage while
            this is being fixed.
          </p>
        )}
        {showProRenewal ? (
          <Button
            type="button"
            variant="ghost"
            disabled={checkoutLoading !== null || !status.canCheckoutPro}
            onClick={() => void startCheckout("pro", true)}
          >
            Renew Pro (GHS {status.displayPriceProRenewalGhs})
          </Button>
        ) : null}
        {showPlusRenewal ? (
          <Button
            type="button"
            variant="ghost"
            disabled={checkoutLoading !== null || !status.canCheckoutPlus}
            onClick={() => void startCheckout("plus", true)}
          >
            Renew Plus (GHS {status.displayPricePlusRenewalGhs})
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function PlanCard({
  name,
  priceLabel,
  creditLabel,
  summary,
  icon,
  highlighted,
  ctaLabel,
  ctaDisabled,
  ctaLoading,
  onClick,
  warning,
}: {
  name: string;
  priceLabel: string;
  creditLabel: string;
  summary: string;
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
        "rounded-2xl border p-5",
        highlighted
          ? "border-[color-mix(in_srgb,var(--primary)_55%,transparent)] bg-[color-mix(in_srgb,var(--primary-fixed)_24%,transparent)] shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--primary)_35%,transparent)]"
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
          <div>
            <div className="text-lg font-extrabold tracking-tight text-[var(--on-surface)]">
              {name}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-[var(--on-surface-variant)]">
              {priceLabel}
            </div>
          </div>
        </div>
        {highlighted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary-container)]/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--primary)]">
            <Icon name="check" size={11} />
            Active
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-2.5 py-1 text-[11px] font-semibold text-[var(--on-surface)]">
          {creditLabel}
        </span>
        <span className="rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-2.5 py-1 text-[11px] text-[var(--on-surface-variant)]">
          {summary}
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        className="mt-4 w-full"
        variant={highlighted ? "secondary" : "primary"}
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
