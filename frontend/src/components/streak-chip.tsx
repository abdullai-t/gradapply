"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";

export interface StreakChipProps extends React.HTMLAttributes<HTMLDivElement> {
  days: number;
  /** Whether to show the orange "soft" pill (default) or the on-primary inverted variant. */
  variant?: "soft" | "inverted";
}

/**
 * Streak chip — tiny gamification badge shown in the topbar.
 * `days` is derived from `UserActivityDay` rows server-side.
 */
export function StreakChip({
  days,
  variant = "soft",
  className,
  ...rest
}: StreakChipProps) {
  // No streak yet → render nothing. The chip is celebratory by design;
  // showing "0 Day Streak" feels like a demerit.
  if (!days || days <= 0) return null;
  const inverted = variant === "inverted";
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-extrabold tracking-tight cursor-default",
        inverted
          ? "bg-white/15 text-white border border-white/20"
          : "bg-[var(--streak-orange-soft)] text-[#c2410c] border-2 border-[#fed7aa] dark:border-[#5c4a2a] dark:text-[var(--streak-orange)]",
        className,
      )}
      role="status"
      aria-label={`${days} day streak`}
      {...rest}
    >
      <Icon name="local_fire_department" fill className="flame" size={16} />
      <span>{days} Day Streak</span>
    </div>
  );
}
