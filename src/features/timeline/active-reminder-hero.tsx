"use client";

import Link from "next/link";
import { differenceInCalendarDays, format } from "date-fns";

import { Icon } from "@/components/icon";
import type { TimelineSchool } from "./types";

/**
 * Top hero on /timeline — gradient-blue card with a watermark icon and the
 * single most urgent reminder. If no reminders exist, fall back to the next
 * upcoming deadline. Empty state stays muted.
 */
export function ActiveReminderHero({
  schools,
  onClearReminder,
}: {
  schools: TimelineSchool[];
  /** Optional handler — when omitted, the snooze button is hidden. */
  onClearReminder?: (id: string) => void;
}) {
  const target = pickHeroTarget(schools);

  if (!target) {
    return (
      <div
        className="relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-8 md:p-10"
      >
        <div
          className="grid h-14 w-14 place-items-center rounded-2xl text-white"
          style={{
            background:
              "linear-gradient(135deg, var(--primary-container), var(--primary))",
          }}
        >
          <Icon name="event_upcoming" size={28} />
        </div>
        <div>
          <h2 className="t-headline-lg m-0 text-[var(--on-surface)]">
            Quiet week
          </h2>
          <p className="mt-2 max-w-prose text-[var(--on-surface-variant)]">
            No active reminders or upcoming deadlines yet. Add a school with a
            date on{" "}
            <Link
              href="/schools"
              className="font-bold text-[var(--primary)] underline-offset-4 hover:underline"
            >
              Schools
            </Link>{" "}
            to populate this timeline.
          </p>
        </div>
      </div>
    );
  }

  const due = new Date(target.dateIso);
  const days = differenceInCalendarDays(due, new Date());
  const dueCopy =
    days < 0
      ? `Was due ${format(due, "MMM d")} — keep moving.`
      : days === 0
        ? `Due today (${format(due, "MMM d")}).`
        : `Due in ${days} day${days === 1 ? "" : "s"} — ${format(due, "MMM d, yyyy")}.`;

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-8 text-white md:p-10"
      style={{
        background:
          "linear-gradient(135deg, var(--primary-container), var(--primary))",
        boxShadow: "0 20px 40px -10px rgba(0, 98, 157, 0.3)",
      }}
    >
      <div
        className="pointer-events-none absolute right-8 top-5 opacity-[0.12]"
        aria-hidden
      >
        <Icon name="event_upcoming" size={140} />
      </div>

      <div className="relative flex flex-col items-start gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <span
            className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.15em] backdrop-blur-md"
          >
            <span
              className="flame block h-2 w-2 rounded-full bg-[var(--secondary-container)]"
              aria-hidden
            />
            {target.kind === "reminder" ? "Active reminder" : "Next deadline"}
          </span>
          <h2 className="t-display-lg m-0 text-white">{target.school.name}</h2>
          <p className="mt-2.5 text-[15px] leading-relaxed text-white/85">
            {target.kind === "reminder" && target.school.reminderNote?.trim()
              ? `${target.school.reminderNote.trim()} — `
              : ""}
            {dueCopy}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/schools/${target.school.id}`}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3.5 text-sm font-extrabold text-[var(--primary)] transition-transform duration-150 hover:-translate-y-0.5"
            style={{ boxShadow: "0 4px 0 0 rgba(0,0,0,0.18)" }}
          >
            Open application
            <Icon name="arrow_forward" size={18} />
          </Link>
          {target.kind === "reminder" && onClearReminder ? (
            <button
              type="button"
              onClick={() => onClearReminder(target.school.id)}
              className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/35 bg-transparent px-5 py-3.5 text-sm font-extrabold text-white transition-colors hover:bg-white/10"
            >
              <Icon name="notifications_off" size={18} />
              Snooze reminder
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type HeroTarget =
  | { kind: "reminder"; school: TimelineSchool; dateIso: string }
  | { kind: "deadline"; school: TimelineSchool; dateIso: string };

function pickHeroTarget(schools: TimelineSchool[]): HeroTarget | null {
  // Prefer the soonest reminder (overdue first → upcoming).
  const withReminder = schools
    .filter((s): s is TimelineSchool & { reminderAt: string } =>
      Boolean(s.reminderAt),
    )
    .sort(
      (a, b) =>
        new Date(a.reminderAt).getTime() - new Date(b.reminderAt).getTime(),
    );
  if (withReminder.length > 0) {
    return {
      kind: "reminder",
      school: withReminder[0]!,
      dateIso: withReminder[0]!.reminderAt,
    };
  }

  // Fallback: nearest upcoming deadline (or oldest overdue).
  const withDeadline = schools
    .filter((s): s is TimelineSchool & { deadline: string } =>
      Boolean(s.deadline),
    )
    .sort(
      (a, b) =>
        new Date(a.deadline).getTime() - new Date(b.deadline).getTime(),
    );
  if (withDeadline.length > 0) {
    return {
      kind: "deadline",
      school: withDeadline[0]!,
      dateIso: withDeadline[0]!.deadline,
    };
  }
  return null;
}
