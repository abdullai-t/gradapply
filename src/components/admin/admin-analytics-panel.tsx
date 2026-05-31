"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, HelpCircle, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getPostHogAppUrl } from "@/lib/analytics/posthog";
import { cn } from "@/lib/utils";

type AnalyticsRange = "7d" | "30d" | "90d";

type DayPoint = { date: string; count: number };

type AdminAnalytics = {
  range: AnalyticsRange;
  generatedAt: string;
  growth: {
    usersTotal: number;
    signupsInRange: number;
    signupsByDay: DayPoint[];
    byPlan: Record<string, number>;
    activeSubscriptionsTotal: number;
    newPaidUsers: number;
    revenueGhs: number;
    paymentsCount: number;
    revenueByDay: DayPoint[];
  };
  product: {
    dau: number;
    wau: number;
    activation: {
      signedUp: number;
      onboardingComplete: number;
      hasSchool: number;
      hasProfEmail: number;
      hasChat: number;
    };
    features: {
      schools: number;
      profEmails: number;
      sopVariants: number;
      chatMessages: number;
      documents: number;
      collabSessions: number;
      googleDocLinks: number;
    };
    llmFeatures: Array<{ feature: string; calls: number; costUsd: number }>;
  };
  ai: {
    totalCostUsdRange: number;
    totalCostUsdMonth: number;
    budgetUsd: number;
    utilizationPctMonth: number;
    callsInRange: number;
    callsByDay: DayPoint[];
    byModel: Array<{ model: string; calls: number; costUsd: number }>;
    topUsers: Array<{
      userId: string;
      email: string | null;
      name: string | null;
      calls: number;
      costUsd: number;
    }>;
  };
  sales: {
    staleFreeUsers: Array<{
      id: string;
      email: string | null;
      name: string | null;
      schoolCount: number;
      createdAt: string;
    }>;
  };
  infra: {
    configured: boolean;
    dashboardUrl: string;
    rangeDays: number;
    requests: number | null;
    errors: number | null;
    subrequests: number | null;
    errorRatePct: number | null;
    cpuTimeP50Ms: number | null;
    cpuTimeP99Ms: number | null;
    durationP50Ms: number | null;
    durationP99Ms: number | null;
    errorMessage?: string;
  };
  links: {
    sentryUrl: string | null;
    neonConsoleUrl: string | null;
    posthogConfigured: boolean;
  };
};

const RANGES: AnalyticsRange[] = ["7d", "30d", "90d"];

function isAdminAnalytics(value: unknown): value is AdminAnalytics {
  return (
    typeof value === "object" &&
    value !== null &&
    "range" in value &&
    "growth" in value &&
    "product" in value
  );
}

const FEATURE_LABELS: Record<string, string> = {
  schools: "Schools",
  profEmails: "Professor emails",
  sopVariants: "SOP variants",
  chatMessages: "Assistant messages",
  documents: "Documents",
  collabSessions: "Collaboration sessions",
  googleDocLinks: "Google Doc links",
};

export function AdminAnalyticsPanel() {
  const [range, setRange] = useState<AnalyticsRange>("30d");
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/admin/analytics?range=${range}`, {
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok || !json || !isAdminAnalytics(json)) {
      const err =
        json && typeof json === "object" && "error" in json
          ? String((json as { error?: string }).error ?? "Could not load analytics.")
          : "Could not load analytics.";
      setError(err);
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const posthogUrl = getPostHogAppUrl();

  return (
    <div className="space-y-6">
      <div className="glass-panel border-primary/20 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">
              Admin analytics
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Product & ops metrics
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Growth, feature adoption, AI spend, and Cloudflare Worker health.
              Worker CPU is request CPU time (ms), not host RAM.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-white/10 p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    range === r
                      ? "bg-primary/20 text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
        {data ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Updated {new Date(data.generatedAt).toLocaleString()}
          </p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}
      </div>

      {loading || !data ? (
        <div className="glass-panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading analytics...
        </div>
      ) : (
        <>
          <Section title="Growth & sales" hint="Signups, revenue, and plan mix for sales forecasting.">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="Total users"
                value={data.growth.usersTotal}
                tip="All registered accounts."
              />
              <Metric
                label={`Signups (${range})`}
                value={data.growth.signupsInRange}
                tip="New accounts in the selected range."
              />
              <Metric
                label="Active subscriptions"
                value={data.growth.activeSubscriptionsTotal}
                tip="PLUS/PRO with active or trialing status."
              />
              <Metric
                label={`Revenue GHS (${range})`}
                value={`GHS ${data.growth.revenueGhs.toLocaleString()}`}
                tip="Successful Paystack payments in GHS."
              />
              <Metric
                label={`New paid users (${range})`}
                value={data.growth.newPaidUsers}
                tip="Users who signed up and paid within the range."
              />
              <Metric
                label={`Payments (${range})`}
                value={data.growth.paymentsCount}
                tip="Count of GHS payment records."
              />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <DaySeries title="Signups by day" series={data.growth.signupsByDay} />
              <DaySeries title="Revenue events by day" series={data.growth.revenueByDay} />
              <PlanBreakdown byPlan={data.growth.byPlan} />
            </div>
          </Section>

          <Section
            title="Product adoption"
            hint="DAU/WAU from daily activity records; feature counts are creations in range."
          >
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Metric
                label="DAU (yesterday UTC)"
                value={data.product.dau}
                tip="Distinct users active yesterday (UTC)."
              />
              <Metric
                label="WAU (last 7d)"
                value={data.product.wau}
                tip="Distinct users with activity in the last 7 days."
              />
            </div>
            <Funnel activation={data.product.activation} />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <FeatureBars features={data.product.features} />
              <LlmFeatureList items={data.product.llmFeatures} />
            </div>
          </Section>

          <Section title="AI & cost" hint="LLM spend from LlmCostLog; month budget from LLM_MONTHLY_BUDGET_USD.">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Metric
                label={`LLM cost (${range})`}
                value={`$${data.ai.totalCostUsdRange.toFixed(2)}`}
                tip="Sum of input + output cost in range."
              />
              <Metric
                label="LLM cost (month)"
                value={`$${data.ai.totalCostUsdMonth.toFixed(2)}`}
                tip="Calendar month spend vs budget."
              />
              <Metric
                label="Budget utilization"
                value={`${data.ai.utilizationPctMonth}%`}
                tip={`Of $${data.ai.budgetUsd} monthly cap.`}
              />
              <Metric
                label={`LLM calls (${range})`}
                value={data.ai.callsInRange}
                tip="Number of logged LLM invocations."
              />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <DaySeries title="LLM calls by day" series={data.ai.callsByDay} />
              <ModelList items={data.ai.byModel} />
            </div>
            <TopLlmUsers users={data.ai.topUsers} />
          </Section>

          <Section title="Sales opportunities" hint="FREE users with schools but no payments.">
            {data.sales.staleFreeUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No stale FREE leads in this snapshot.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.sales.staleFreeUsers.map((u) => (
                  <li
                    key={u.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
                  >
                    <span className="font-medium">
                      {u.name?.trim() || u.email || u.id}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {u.schoolCount} schools · joined{" "}
                      {new Date(u.createdAt).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Infrastructure"
            hint="Cloudflare Worker metrics; not continuous RAM monitoring (~128MB isolate limit)."
          >
            <InfraPanel data={data.infra} links={data.links} posthogUrl={posthogUrl} />
          </Section>
        </>
      )}
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-panel space-y-4 p-5">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  tip,
}: {
  label: string;
  value: number | string;
  tip: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <Tip text={tip} />
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <HelpCircle className="h-3.5 w-3.5 opacity-60" aria-hidden />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-48 -translate-x-1/2 rounded-md bg-black/90 px-2 py-1 text-[10px] font-normal normal-case tracking-normal text-white group-hover:block">
        {text}
      </span>
    </span>
  );
}

function DaySeries({ title, series }: { title: string; series: DayPoint[] }) {
  const max = Math.max(1, ...series.map((p) => p.count));
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 flex h-24 items-end gap-0.5">
        {series.map((p) => (
          <div
            key={p.date}
            className="min-w-0 flex-1 rounded-t bg-primary/50"
            style={{ height: `${Math.max(4, (p.count / max) * 100)}%` }}
            title={`${p.date}: ${p.count}`}
          />
        ))}
      </div>
    </div>
  );
}

function PlanBreakdown({ byPlan }: { byPlan: Record<string, number> }) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <h3 className="text-sm font-semibold">Plan distribution (all users)</h3>
      <div className="mt-3 space-y-2 text-sm">
        {(["FREE", "PLUS", "PRO"] as const).map((tier) => (
          <div key={tier} className="flex justify-between">
            <span className="text-muted-foreground">{tier}</span>
            <span className="font-semibold">{byPlan[tier] ?? 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Funnel({
  activation,
}: {
  activation: AdminAnalytics["product"]["activation"];
}) {
  const steps = [
    { label: "Signed up", count: activation.signedUp },
    { label: "Onboarding complete", count: activation.onboardingComplete },
    { label: "Added a school", count: activation.hasSchool },
    { label: "Professor email", count: activation.hasProfEmail },
    { label: "Used assistant", count: activation.hasChat },
  ];
  const base = activation.signedUp || 1;
  return (
    <div className="mt-4 rounded-xl border border-white/10 p-4">
      <h3 className="text-sm font-semibold">Activation funnel (all-time)</h3>
      <div className="mt-3 space-y-2">
        {steps.map((s) => (
          <div key={s.label}>
            <div className="flex justify-between text-xs">
              <span>{s.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {s.count} ({Math.round((s.count / base) * 100)}%)
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-primary/60"
                style={{ width: `${Math.min(100, (s.count / base) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureBars({
  features,
}: {
  features: AdminAnalytics["product"]["features"];
}) {
  const entries = Object.entries(features) as Array<[string, number]>;
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <h3 className="text-sm font-semibold">Feature usage ({`created in range`})</h3>
      <div className="mt-3 space-y-2">
        {entries.map(([key, count]) => (
          <div key={key}>
            <div className="flex justify-between text-xs">
              <span>{FEATURE_LABELS[key] ?? key}</span>
              <span className="tabular-nums">{count}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-500/50"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LlmFeatureList({
  items,
}: {
  items: AdminAnalytics["product"]["llmFeatures"];
}) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <h3 className="text-sm font-semibold">LLM by feature</h3>
      <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
        {items.length === 0 ? (
          <li className="text-muted-foreground">No LLM calls in range.</li>
        ) : (
          items.map((row) => (
            <li key={row.feature} className="flex justify-between gap-2">
              <span className="truncate font-mono text-xs">{row.feature}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {row.calls} · ${row.costUsd.toFixed(2)}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function ModelList({
  items,
}: {
  items: AdminAnalytics["ai"]["byModel"];
}) {
  return (
    <div className="rounded-xl border border-white/10 p-4">
      <h3 className="text-sm font-semibold">LLM by model</h3>
      <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto text-sm">
        {items.map((row) => (
          <li key={row.model} className="flex justify-between gap-2">
            <span className="truncate font-mono text-xs">{row.model}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {row.calls} · ${row.costUsd.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopLlmUsers({
  users,
}: {
  users: AdminAnalytics["ai"]["topUsers"];
}) {
  if (users.length === 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-white/10 p-4">
      <h3 className="text-sm font-semibold">Top LLM consumers (range)</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {users.map((u) => (
          <li key={u.userId} className="flex justify-between gap-2">
            <span className="truncate">
              {u.name?.trim() || u.email || u.userId}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {u.calls} calls · ${u.costUsd.toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InfraPanel({
  data,
  links,
  posthogUrl,
}: {
  data: AdminAnalytics["infra"];
  links: AdminAnalytics["links"];
  posthogUrl: string | null;
}) {
  return (
    <div className="space-y-4">
      {!data.configured ? (
        <p className="text-sm text-amber-200/90">
          Set <code className="text-xs">CLOUDFLARE_ACCOUNT_ID</code> and{" "}
          <code className="text-xs">CLOUDFLARE_API_TOKEN</code> to load Worker metrics.
          See DEPLOY.md.
        </p>
      ) : data.errorMessage ? (
        <p className="text-sm text-amber-200/90">{data.errorMessage}</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Worker requests"
          value={data.requests ?? "—"}
          tip="Total invocations in range."
        />
        <Metric
          label="Error rate"
          value={
            data.errorRatePct != null ? `${data.errorRatePct}%` : "—"
          }
          tip="Errors / requests."
        />
        <Metric
          label="CPU p99 (ms)"
          value={data.cpuTimeP99Ms ?? "—"}
          tip="99th percentile Worker CPU time per request."
        />
        <Metric
          label="Duration p99 (ms)"
          value={data.durationP99Ms ?? "—"}
          tip="99th percentile wall time."
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Workers run in memory-isolated V8 isolates (~128MB cap). These metrics are
        request CPU time and duration, not host RAM or OS CPU %.
      </p>

      <div className="flex flex-wrap gap-2">
        <LinkButton href={data.dashboardUrl} label="Cloudflare Workers" />
        {links.sentryUrl ? (
          <LinkButton href={links.sentryUrl} label="Sentry" />
        ) : null}
        {links.neonConsoleUrl ? (
          <LinkButton href={links.neonConsoleUrl} label="Neon database" />
        ) : null}
        {links.posthogConfigured && posthogUrl ? (
          <LinkButton href={posthogUrl} label="PostHog" />
        ) : null}
      </div>
    </div>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <Button size="sm" variant="outline" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {label}
        <ExternalLink className="ml-2 h-3.5 w-3.5" />
      </a>
    </Button>
  );
}
