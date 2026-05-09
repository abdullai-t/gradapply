"use client";

import { Icon } from "@/components/icon";
import type { SchoolRow } from "./types";

/**
 * Three bento tiles across the top of /schools — Total · In progress · Submitted.
 * Numbers come straight from the loaded school list; pure derivation, no fetch.
 */
export function SchoolsStats({ schools }: { schools: SchoolRow[] }) {
  const total = schools.length;
  const inProgress = schools.filter((s) =>
    s.status === "PLANNING" || s.status === "APPLIED" || s.status === "WAITING",
  ).length;
  const submitted = schools.filter(
    (s) => s.status === "APPLIED" || s.status === "ACCEPTED",
  ).length;

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
      <Bento icon="assignment" tone="primary" label="Total apps" value={pad(total)} />
      <Bento
        icon="pending_actions"
        tone="secondary"
        label="In progress"
        value={pad(inProgress)}
      />
      <Bento
        icon="check_circle"
        tone="tertiary"
        label="Submitted"
        value={pad(submitted)}
      />
    </div>
  );
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

const TONE: Record<
  "primary" | "secondary" | "tertiary",
  { iconBg: string; iconFg: string }
> = {
  primary: { iconBg: "rgba(0,98,157,0.08)", iconFg: "var(--primary)" },
  secondary: {
    iconBg: "rgba(83,250,194,0.2)",
    iconFg: "var(--on-secondary-container)",
  },
  tertiary: {
    iconBg: "rgba(43,108,0,0.08)",
    iconFg: "var(--tertiary)",
  },
};

function Bento({
  icon,
  tone,
  label,
  value,
}: {
  icon: string;
  tone: keyof typeof TONE;
  label: string;
  value: string;
}) {
  const t = TONE[tone];
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
        style={{ background: t.iconBg, color: t.iconFg }}
      >
        <Icon name={icon} size={24} />
      </div>
      <div>
        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-[var(--outline)]">
          {label}
        </div>
        <div className="text-2xl font-extrabold tracking-tight text-[var(--on-surface)]">
          {value}
        </div>
      </div>
    </div>
  );
}
