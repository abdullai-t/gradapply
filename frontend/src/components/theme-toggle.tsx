"use client";

import * as React from "react";

import { useTheme, type ThemePreference } from "@/components/theme-provider";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: string;
}[] = [
  { value: "light", label: "Light", icon: "light_mode" },
  { value: "dark", label: "Dark", icon: "dark_mode" },
  { value: "system", label: "System", icon: "contrast" },
];

/**
 * Segmented theme picker — light / dark / system. Use inside Settings →
 * Preferences or as a standalone control.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[var(--surface-container)] p-1",
        className,
      )}
    >
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            type="button"
            aria-checked={active}
            onClick={() => setPreference(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
              active
                ? "bg-[var(--surface-container-lowest)] text-[var(--primary)] shadow-[0_2px_0_0_var(--outline-variant)]"
                : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]",
            )}
          >
            <Icon name={opt.icon} size={16} fill={active} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
