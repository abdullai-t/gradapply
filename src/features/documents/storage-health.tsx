"use client";

import { Icon } from "@/components/icon";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";

const QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5GB visual cap

/**
 * Friendly storage quota display. Pure visual derivation — back-end has no
 * quota yet, so we show usage against a fixed 5 GB target.
 */
export function StorageHealth({ bytesUsed }: { bytesUsed: number }) {
  const pct = Math.min(100, Math.round((bytesUsed / QUOTA_BYTES) * 100));
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
              color: "var(--on-primary-container)",
            }}
          >
            <Icon name="hard_drive" size={22} />
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
          Using {formatBytes(bytesUsed)} of {formatBytes(QUOTA_BYTES)}.
        </p>
      </div>
    </div>
  );
}
