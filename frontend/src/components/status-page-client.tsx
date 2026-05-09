"use client";

import { useCallback, useEffect, useState } from "react";

type HealthJson = { ok: true; version: string } | { ok: false; error: string };

export function StatusPageClient({
  initialOk,
  initialVersion,
}: {
  initialOk: boolean;
  initialVersion?: string;
}) {
  const [ok, setOk] = useState(initialOk);
  const [version, setVersion] = useState<string | undefined>(initialVersion);
  const [error, setError] = useState<string | undefined>(
    initialOk ? undefined : "database",
  );
  const [checkedAt, setCheckedAt] = useState(() => new Date());
  const [loading, setLoading] = useState(false);

  const poll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = (await res.json()) as HealthJson;
      setOk(data.ok);
      setCheckedAt(new Date());
      if (data.ok) {
        setVersion(data.version);
        setError(undefined);
      } else {
        setError("error" in data ? data.error : "unknown");
        setVersion(undefined);
      }
    } catch {
      setOk(false);
      setError("network");
      setVersion(undefined);
      setCheckedAt(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [poll]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide ${
            ok
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
              : "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30"
          }`}
        >
          {ok ? "Operational" : "Degraded"}
        </span>
        <button
          type="button"
          onClick={() => void poll()}
          disabled={loading}
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/90 hover:bg-white/10 disabled:opacity-50"
        >
          {loading ? "Checking…" : "Refresh"}
        </button>
      </div>

      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
          <dt className="text-white/50">API + database</dt>
          <dd className="text-right font-mono text-white/90">
            {ok ? "OK" : "Unavailable"}
          </dd>
        </div>
        {version ? (
          <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
            <dt className="text-white/50">App version</dt>
            <dd className="text-right font-mono text-white/90">v{version}</dd>
          </div>
        ) : null}
        {error ? (
          <div className="flex justify-between gap-4 border-b border-white/5 pb-2">
            <dt className="text-white/50">Detail</dt>
            <dd className="text-right font-mono text-rose-200/90">{error}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-4 pt-1">
          <dt className="text-white/50">Last check</dt>
          <dd className="text-right font-mono text-xs text-white/70">
            {checkedAt.toLocaleString()}
          </dd>
        </div>
      </dl>
    </div>
  );
}
