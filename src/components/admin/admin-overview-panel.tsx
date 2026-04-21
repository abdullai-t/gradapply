"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PlanTier = "FREE" | "PLUS" | "PRO";
type UserRole = "USER" | "ADMIN" | "SUPERADMIN";

type AdminOverview = {
  actorRole: "ADMIN" | "SUPERADMIN";
  metrics: {
    usersTotal: number;
    adminsTotal: number;
    superAdminsTotal: number;
    billingCustomersTotal: number;
    activeSubscriptionsTotal: number;
    newUsers7d: number;
    aiUsageUsedTotal: number;
    aiCreditsBalanceTotal: number;
    byPlan: Record<PlanTier, number>;
  };
  recentUsers: Array<{
    id: string;
    name: string | null;
    email: string | null;
    role: UserRole;
    planTier: PlanTier;
    createdAt: string;
  }>;
};

export function AdminOverviewPanel() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/overview", { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as
      | AdminOverview
      | { error?: string }
      | null;
    if (!res.ok || !json || isErrorPayload(json)) {
      setError(
        json && isErrorPayload(json) ? json.error ?? "Could not load." : "Could not load.",
      );
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="glass-panel flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading admin overview...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-panel border-primary/20 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/90">
              Admin dashboard
            </p>
            <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Control center
            </h1>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-amber-200">{error}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Metric label="Total users" value={data.metrics.usersTotal} />
        <Metric label="New (7d)" value={data.metrics.newUsers7d} />
        <Metric label="Billing customers" value={data.metrics.billingCustomersTotal} />
        <Metric label="Active subscriptions" value={data.metrics.activeSubscriptionsTotal} />
        <Metric label="Admins" value={data.metrics.adminsTotal + data.metrics.superAdminsTotal} />
        <Metric label="Superadmins" value={data.metrics.superAdminsTotal} />
        <Metric label="AI usage total" value={data.metrics.aiUsageUsedTotal} />
        <Metric label="Credits balance total" value={data.metrics.aiCreditsBalanceTotal} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-panel p-5">
          <h3 className="font-display text-lg font-semibold">Plan distribution</h3>
          <div className="mt-4 space-y-2 text-sm">
            {(["FREE", "PLUS", "PRO"] as const).map((tier) => (
              <div key={tier} className="flex items-center justify-between">
                <span className="text-muted-foreground">{tier}</span>
                <span className="font-semibold">{data.metrics.byPlan[tier] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-5">
          <h3 className="font-display text-lg font-semibold">Recent signups</h3>
          <ul className="mt-4 space-y-2">
            {data.recentUsers.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{u.name?.trim() || u.email || "Unnamed user"}</p>
                  <p className="truncate text-xs text-muted-foreground">{u.email ?? "No email"}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function isErrorPayload(value: AdminOverview | { error?: string }): value is { error?: string } {
  return "error" in value;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
