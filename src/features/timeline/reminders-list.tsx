"use client";

import Link from "next/link";
import { format } from "date-fns";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { admissionTermLabel } from "@/lib/admission-term";
import { cn } from "@/lib/utils";
import type { TimelineSchool } from "./types";

/**
 * "Active reminders" panel — chronological list of school-specific reminders
 * with a Clear-reminder action that PATCHes `reminderAt: null, reminderNote: null`.
 *
 * Reminders that fall in the past are highlighted with a soft amber tone.
 */
export function RemindersList({
  schools,
  onClear,
  loading,
}: {
  schools: TimelineSchool[];
  onClear: (id: string) => void;
  loading: boolean;
}) {
  const reminders = schools
    .filter((s) => s.reminderAt != null)
    .sort(
      (a, b) =>
        new Date(a.reminderAt!).getTime() - new Date(b.reminderAt!).getTime(),
    );

  return (
    <section className="rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6 md:p-7">
      <header className="mb-4 flex items-start gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{
            background: "rgba(0,98,157,0.08)",
            color: "var(--primary)",
          }}
        >
          <Icon name="alarm" fill size={22} />
        </div>
        <div>
          <h2 className="m-0 text-lg font-bold tracking-tight text-[var(--on-surface)]">
            Active reminders
          </h2>
          <p className="m-0 mt-0.5 text-sm text-[var(--on-surface-variant)]">
            Nudges you set alongside a school. Clearing removes the ping but
            keeps your deadline.
          </p>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-[var(--on-surface-variant)]">Loading…</p>
      ) : reminders.length === 0 ? (
        <p className="text-sm text-[var(--on-surface-variant)]">
          No reminders yet — open a school card on{" "}
          <Link
            href="/schools"
            className="font-bold text-[var(--primary)] underline-offset-4 hover:underline"
          >
            Schools
          </Link>{" "}
          and pick a reminder date.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--outline-variant)] overflow-hidden rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
          {reminders.map((school) => {
            const r = new Date(school.reminderAt!);
            const past = r.getTime() < Date.now();
            return (
              <li
                key={school.id}
                className={cn(
                  "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                  past
                    ? "bg-[color-mix(in_srgb,var(--streak-orange)_8%,transparent)]"
                    : "",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[var(--on-surface)]">
                      {school.name}
                    </span>
                    <ReminderPill past={past} date={r} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-[var(--on-surface-variant)]">
                    {school.program}
                    {school.term
                      ? ` · ${admissionTermLabel(school.term)}`
                      : ""}
                  </div>
                  {school.reminderNote?.trim() ? (
                    <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
                      {school.reminderNote.trim()}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 border border-dashed border-[var(--outline-variant)]"
                  icon="bell_off"
                  onClick={() => onClear(school.id)}
                >
                  Clear reminder
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ReminderPill({ past, date }: { past: boolean; date: Date }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em]",
        past
          ? "bg-[var(--streak-orange-soft)] text-[#c2410c] border border-[#fed7aa] dark:border-[#5c4a2a] dark:text-[var(--streak-orange)]"
          : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] border border-[var(--outline-variant)]",
      )}
    >
      {past ? "Due ping" : format(date, "MMM d, yyyy")}
    </span>
  );
}
