"use client";

import { Icon } from "@/components/icon";
import {
  SCHOOL_TIER_OPTIONS,
  type SchoolTierBucket,
} from "@/lib/school-tier-options";
import { cn } from "@/lib/utils";

type Props = {
  value: SchoolTierBucket[];
  onChange: (next: SchoolTierBucket[]) => void;
  disabled?: boolean;
  hint?: string;
};

export function SchoolTierInterestPicker({
  value,
  onChange,
  disabled = false,
  hint,
}: Props) {
  const selected = new Set(value);

  const toggle = (bucket: SchoolTierBucket) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(bucket)) {
      if (next.size <= 1) return;
      next.delete(bucket);
    } else {
      next.add(bucket);
    }
    onChange(SCHOOL_TIER_OPTIONS.map((o) => o.bucket).filter((b) => next.has(b)));
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {SCHOOL_TIER_OPTIONS.map((option) => {
          const checked = selected.has(option.bucket);
          return (
            <button
              key={option.bucket}
              type="button"
              disabled={disabled}
              onClick={() => toggle(option.bucket)}
              className={cn(
                "tactile-card rounded-2xl border-2 p-4 text-left transition-colors disabled:opacity-60",
                checked
                  ? "border-[var(--primary)] bg-[var(--primary-container)]/15"
                  : "border-[var(--outline-variant)] hover:border-[var(--outline)]",
              )}
              aria-pressed={checked}
            >
              <span className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border-2",
                    checked
                      ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                      : "border-[var(--outline-variant)]",
                  )}
                  aria-hidden
                >
                  {checked ? <Icon name="check" size={14} /> : null}
                </span>
                <span>
                  <span className="block text-sm font-bold text-[var(--on-surface)]">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--on-surface-variant)]">
                    {option.subtitle}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {hint ? (
        <p className="text-xs text-[var(--on-surface-variant)]">{hint}</p>
      ) : null}
    </div>
  );
}
