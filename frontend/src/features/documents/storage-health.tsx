"use client";

import { Icon } from "@/components/icon";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";

const DEFAULT_QUOTA_BYTES = 100 * 1024 * 1024; // 100MB fallback

/** Friendly storage quota display for the current plan cap. */
export function StorageHealth({
  bytesUsed,
  quotaBytes = DEFAULT_QUOTA_BYTES,
}: {
  bytesUsed: number;
  quotaBytes?: number;
}) {
  const safeQuota = Math.max(1, quotaBytes);
  const pct = Math.min(100, Math.round((bytesUsed / safeQuota) * 100));
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6">
      <div
        className="pointer-events-none absolute -bottom-4 -right-4 opacity-[0.06]"
        aria-hidden
      >
        <Icon name="folder_managed" size={120} />
      </div>
      <div className="relative z-10">
        <div className="mb-5 flex items-start justify-between">
          <div
            className="grid h-11 w-11 place-items-center rounded-xl"
            style={{
              background: "var(--primary-fixed)",
              color: "var(--primary)",
            }}
          >
            <Icon name="description" size={22} />
          </div>
          <span className="text-sm font-bold text-[var(--on-surface-variant)]">
            {pct}% used
          </span>
        </div>
        <h3 className="m-0 text-lg font-bold tracking-tight text-[var(--on-surface)]">
          Storage health
        </h3>
        <div className="mt-3">
          <Progress value={pct} tone="primary" size="default" />
        </div>
        <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
          Using {formatBytes(bytesUsed)} of {formatBytes(safeQuota)}.
        </p>
      </div>
    </div>
  );
}
