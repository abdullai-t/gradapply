"use client";

import Link from "next/link";
import { format, startOfMonth } from "date-fns";

import { Icon } from "@/components/icon";
import { admissionTermLabel } from "@/lib/admission-term";
import { deadlineDueMeta, deadlineUrgency } from "@/lib/deadline-urgency";
import { cn } from "@/lib/utils";

import type { TimelineSchool } from "./types";

/**
 * Vertical month-grouped timeline. Each month rendered as a section with a
 * dashed left rail + dot. Within a month, each school is a tactile card.
 *
 * Empty state: prompts to add schools with deadlines.
 */
export function MonthTimeline({ schools }: { schools: TimelineSchool[] }) {
  if (schools.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[var(--outline-variant)] p-10 text-center">
        <Icon
          name="event_busy"
          size={32}
          className="text-[var(--outline)]"
        />
        <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
          No schools yet —{" "}
          <Link
            href="/schools"
            className="font-bold text-[var(--primary)] underline-offset-4 hover:underline"
          >
            add programs
          </Link>{" "}
          with deadlines to populate your calendar.
        </p>
      </div>
    );
  }

  const grouped = groupByMonth(schools);

  return (
    <div className="space-y-4">
      {grouped.monthKeys.map((key, monthIdx) => {
        const bucket = grouped.byMonth.get(key)!;
        const labelMonth = startOfMonth(new Date(bucket[0]!.deadline!));
        return (
          <TimelineMonthSection
            key={key}
            month={format(labelMonth, "MMMM")}
            count={`${bucket.length} ${bucket.length === 1 ? "deadline" : "deadlines"}`}
            year={format(labelMonth, "yyyy")}
            active={monthIdx === 0}
          >
            {bucket.map((school) => (
              <TimelineRow key={school.id} school={school} />
            ))}
          </TimelineMonthSection>
        );
      })}

      {grouped.noDl.length > 0 ? (
        <TimelineMonthSection
          month="No deadline set"
          count={`${grouped.noDl.length} ${grouped.noDl.length === 1 ? "school" : "schools"}`}
          year=""
          active={false}
          dimmed
        >
          {grouped.noDl.map((school) => (
            <DashedRow key={school.id} school={school} />
          ))}
        </TimelineMonthSection>
      ) : null}
    </div>
  );
}

function TimelineMonthSection({
  month,
  count,
  year,
  active,
  dimmed,
  children,
}: {
  month: string;
  count: string;
  year: string;
  active: boolean;
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative pl-9 pb-2",
        "border-l-2 border-dashed border-[var(--outline-variant)]",
      )}
    >
      <div
        className={cn(
          "absolute -left-[9px] top-1.5 h-4 w-4 rounded-full ring-4",
          "ring-[var(--background)]",
        )}
        style={{
          background: active
            ? "var(--primary)"
            : dimmed
              ? "var(--outline-variant)"
              : "var(--surface-container-highest)",
        }}
      />
      <h4 className="m-0 mb-5 flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-[var(--outline)]">
        <span className={dimmed ? "" : "text-[var(--on-surface)]"}>
          {month}
        </span>
        {year ? (
          <span className="text-[var(--on-surface-variant)]">{year}</span>
        ) : null}
        <span className="rounded-full bg-[var(--surface-container)] px-3 py-1 text-xs font-bold text-[var(--on-surface-variant)]">
          {count}
        </span>
      </h4>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function TimelineRow({ school }: { school: TimelineSchool }) {
  const d = new Date(school.deadline!);
  const u = deadlineUrgency(d);
  const meta = deadlineDueMeta(d);
  const urgencyTone = mapUrgency(u.tone);
  const icon = pickProgramIcon(school.program);

  return (
    <Link
      href="/schools"
      className={cn(
        "tactile-card group flex items-center justify-between gap-4 rounded-2xl border p-4 md:p-5",
        meta.isOverdue
          ? "border-[var(--error)]/30"
          : "border-[var(--outline-variant)]",
      )}
    >
      <div className="flex flex-1 items-center gap-4">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[var(--surface-container-high)] text-[var(--primary)] transition-transform duration-300 group-hover:scale-110"
        >
          <Icon name={icon} size={26} />
        </div>
        <div className="min-w-0">
          <h5 className="m-0 text-lg font-bold leading-tight text-[var(--on-surface)]">
            {school.name}
          </h5>
          <p className="m-0 mt-0.5 text-sm text-[var(--on-surface-variant)]">
            {school.program} · {school.degree}
            {school.term ? ` · ${admissionTermLabel(school.term)}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.02em] text-[var(--on-surface-variant)]">
              <Icon name="alarm" size={14} />
              <time dateTime={school.deadline!}>
                {format(d, "EEE, MMM d, yyyy")}
              </time>
            </span>
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold tracking-[0.02em]"
              style={{ color: urgencyTone.color }}
            >
              <Icon name={urgencyTone.icon} size={14} />
              {u.label}
            </span>
          </div>
        </div>
      </div>
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-[var(--surface-container)] text-[var(--outline)] transition-colors group-hover:border-[var(--primary-container)] group-hover:bg-[var(--primary-container)] group-hover:text-white"
      >
        <Icon name="chevron_right" size={22} />
      </div>
    </Link>
  );
}

function DashedRow({ school }: { school: TimelineSchool }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4">
      <div className="font-bold text-[var(--on-surface)]">{school.name}</div>
      <div className="text-sm text-[var(--on-surface-variant)]">
        {school.program} — add a date on{" "}
        <Link
          href="/schools"
          className="font-bold text-[var(--primary)] underline-offset-4 hover:underline"
        >
          Schools
        </Link>{" "}
        to surface it above.
      </div>
    </div>
  );
}

function groupByMonth(schools: TimelineSchool[]) {
  const withDl = schools.filter((s) => s.deadline);
  const noDl = schools.filter((s) => !s.deadline);
  const byMonth = new Map<string, TimelineSchool[]>();
  for (const s of withDl) {
    const d = new Date(s.deadline!);
    const key = format(startOfMonth(d), "yyyy-MM");
    const arr = byMonth.get(key) ?? [];
    arr.push(s);
    byMonth.set(key, arr);
  }
  for (const arr of Array.from(byMonth.values())) {
    arr.sort(
      (a, b) =>
        new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
    );
  }
  const monthKeys = Array.from(byMonth.keys()).sort();
  return { monthKeys, byMonth, noDl };
}

function mapUrgency(
  tone: ReturnType<typeof deadlineUrgency>["tone"],
): { color: string; icon: string } {
  switch (tone) {
    case "destructive":
      return { color: "var(--error)", icon: "warning" };
    case "amber":
      return { color: "#c2410c", icon: "schedule" };
    case "muted":
    default:
      return { color: "var(--outline)", icon: "info" };
  }
}

function pickProgramIcon(program: string): string {
  const p = program.toLowerCase();
  if (p.includes("comput") || p.includes("ai") || p.includes("ml") || p.includes("data"))
    return "computer";
  if (p.includes("bio") || p.includes("med") || p.includes("life")) return "biotech";
  if (p.includes("art") || p.includes("design")) return "palette";
  if (p.includes("law")) return "gavel";
  if (p.includes("business") || p.includes("mba")) return "business_center";
  if (p.includes("phys") || p.includes("math")) return "calculate";
  return "account_balance";
}
