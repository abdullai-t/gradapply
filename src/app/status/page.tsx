import { StatusPageClient } from "@/components/status-page-client";
import { runHealthCheck } from "@/lib/health-check";

/** Avoid baking a single health snapshot at build time. */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "System status — GradApply",
  description: "Application and database availability for GradApply.",
};

export default async function StatusPage() {
  const initial = await runHealthCheck();

  return (
    <div className="min-h-screen bg-[hsl(232_32%_8%)] px-4 py-16 text-white">
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          System status
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Live checks against the GradApply API and database. No sign-in
          required.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
          <StatusPageClient
            initialOk={initial.ok}
            initialVersion={initial.ok ? initial.version : undefined}
          />
        </div>

        <p className="mt-8 text-xs text-white/40">
          For automation, use{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-white/70">
            GET /api/health
          </code>{" "}
          — returns JSON and{" "}
          <code className="text-white/60">503</code> when the database is
          unreachable.
        </p>
      </div>
    </div>
  );
}
