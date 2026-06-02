"use client";

import Link from "next/link";
import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/icon";
import type { DashboardUrgent } from "./compute";

const DISMISS_KEY = "gradapply_dashboard_urgent_dismissed";

type Props = {
  urgent: DashboardUrgent;
};

export function UrgentStrip({ urgent }: Props) {
  const dismissId = `${urgent.kind}:${urgent.schoolId}:${urgent.dateIso}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(DISMISS_KEY) === dismissId) {
      setDismissed(true);
    }
  }, [dismissId]);

  const dismiss = useCallback(() => {
    sessionStorage.setItem(DISMISS_KEY, dismissId);
    setDismissed(true);
  }, [dismissId]);

  if (dismissed) return null;

  const due = new Date(urgent.dateIso);
  const dueLabel = format(due, "MMM d, yyyy");
  const isWarn = urgent.overdue || urgent.kind === "reminder";

  return (
    <div
      className="flex flex-col gap-3 rounded-2xl border-2 p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{
        borderColor: isWarn
          ? "color-mix(in srgb, var(--error) 40%, transparent)"
          : "color-mix(in srgb, var(--primary) 35%, transparent)",
        background: isWarn
          ? "color-mix(in srgb, var(--error-container) 25%, var(--surface-container-low))"
          : "color-mix(in srgb, var(--primary-container) 20%, var(--surface-container-low))",
      }}
      role="alert"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          name={urgent.kind === "reminder" ? "notifications_active" : "event"}
          size={22}
          className={isWarn ? "text-[var(--error)]" : "text-[var(--primary)]"}
        />
        <div className="min-w-0">
          <p className="m-0 text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--outline)]">
            {urgent.kind === "reminder" ? "Reminder" : "Next deadline"}
            {urgent.overdue ? " · Overdue" : ""}
          </p>
          <p className="m-0 mt-0.5 font-bold text-[var(--on-surface)]">
            {urgent.schoolName}
          </p>
          <p className="m-0 mt-1 text-sm text-[var(--on-surface-variant)]">
            {urgent.kind === "reminder" && urgent.note?.trim()
              ? `${urgent.note.trim()} — `
              : ""}
            {dueLabel}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Link
          href={`/schools/${urgent.schoolId}`}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--on-primary)]"
        >
          Open
          <Icon name="arrow_forward" size={16} />
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl px-3 py-2 text-xs font-bold text-[var(--on-surface-variant)] hover:bg-black/5"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
