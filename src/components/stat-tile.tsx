"use client";

import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";

type Tone = "primary" | "secondary" | "tertiary" | "destructive" | "neutral" | "warning";

const TONE: Record<
  Tone,
  { tint: string; fg: string; accent: string }
> = {
  primary: {
    tint: "rgba(0,98,157,0.08)",
    fg: "var(--primary)",
    accent: "var(--primary)",
  },
  secondary: {
    tint: "rgba(83,250,194,0.2)",
    fg: "var(--on-secondary-container)",
    accent: "var(--secondary)",
  },
  tertiary: {
    tint: "rgba(43,108,0,0.08)",
    fg: "var(--tertiary)",
    accent: "var(--tertiary)",
  },
  destructive: {
    tint: "rgba(186,26,26,0.08)",
    fg: "var(--error)",
    accent: "var(--error)",
  },
  warning: {
    tint: "rgba(255,150,0,0.12)",
    fg: "var(--streak-orange)",
    accent: "var(--streak-orange)",
  },
  neutral: {
    tint: "var(--surface-container)",
    fg: "var(--on-surface-variant)",
    accent: "var(--outline-variant)",
  },
};

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: string;
  value: React.ReactNode;
  label: string;
  tone?: Tone;
  delay?: number;
  /** When set, the tile navigates on click. */
  href?: string;
}

/**
 * Compact statistic tile used across dashboard / schools / assistant.
 * Hover lift + bottom accent border in the chosen tone.
 */
export function StatTile({
  icon,
  value,
  label,
  tone = "primary",
  delay = 0,
  href,
  className,
  style,
  ...rest
}: StatTileProps) {
  const t = TONE[tone];
  const inner = (
    <>
      <div
        className="mb-2 grid h-9 w-9 place-items-center rounded-xl"
        style={{ background: t.tint, color: t.fg }}
      >
        <Icon name={icon} size={20} />
      </div>
      <div className="text-[1.4rem] font-extrabold tracking-tight text-[var(--on-surface)]">
        {value}
      </div>
      <div className="t-label-lg mt-1">{label}</div>
    </>
  );

  const classes = cn(
    "stat-tile pop-number rounded-2xl border-2 border-[var(--surface-container)] bg-[var(--surface-container-low)] p-4",
    href &&
      "block transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)]",
    className,
  );

  const tileStyle = {
    borderBottomWidth: 4,
    borderBottomColor: t.accent,
    animationDelay: `${delay}s`,
    ...style,
  };

  if (href) {
    return (
      <Link href={href} className={classes} style={tileStyle}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={classes} style={tileStyle} {...rest}>
      {inner}
    </div>
  );
}
