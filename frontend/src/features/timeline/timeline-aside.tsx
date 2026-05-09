"use client";

import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import type { TimelineSchool } from "./types";

/**
 * Right-side rail on /timeline — three stacked panels:
 *   1. ProgressCard  — completion ratio of upcoming deadlines.
 *   2. AIStrategyCard — short narrative + "View plan" deep link.
 *   3. QuickTool grid — New school, Open Schools.
 *
 * Pure derivation — no extra fetches.
 */
export function TimelineAside({ schools }: { schools: TimelineSchool[] }) {
  const completion = computeCompletion(schools);
  const next = nextDeadline(schools);
  const daysToNext = next
    ? Math.max(0, differenceInCalendarDays(new Date(next), new Date()))
    : null;

  return (
    <div className="flex flex-col gap-5">
      <ProgressCard
        pctComplete={completion.pct}
        tasksLeft={completion.left}
        daysToNext={daysToNext}
      />
      <AIStrategyCard schools={schools} />
      <div className="grid grid-cols-2 gap-3">
        <QuickTool icon="add_task" label="New school" href="/schools" />
        <QuickTool icon="folder_open" label="All schools" href="/schools" />
      </div>
    </div>
  );
}

function ProgressCard({
  pctComplete,
  tasksLeft,
  daysToNext,
}: {
  pctComplete: number;
  tasksLeft: number;
  daysToNext: number | null;
}) {
  return (
    <div className="rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6">
      <h4 className="m-0 text-lg font-bold tracking-tight text-[var(--on-surface)]">
        Cycle progress
      </h4>
      <div className="mt-4 flex items-center justify-between">
        <span className="rounded-full bg-[var(--secondary-container)]/30 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--on-secondary-container)]">
          Tasks completed
        </span>
        <span className="text-sm font-extrabold text-[var(--secondary)]">
          {pctComplete}%
        </span>
      </div>
      <div className="mt-2.5">
        <Progress value={pctComplete} tone="secondary" size="default" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Tile label="Tasks left" value={padTwo(tasksLeft)} />
        <Tile
          label="Days to next"
          value={daysToNext == null ? "—" : padTwo(daysToNext)}
        />
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[var(--surface-container)] p-3.5">
      <div className="text-[1.4rem] font-extrabold tracking-tight text-[var(--on-surface)]">
        {value}
      </div>
      <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--outline)]">
        {label}
      </div>
    </div>
  );
}

function AIStrategyCard({ schools }: { schools: TimelineSchool[] }) {
  const next = schools
    .filter((s) => s.deadline)
    .sort(
      (a, b) =>
        new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
    )[0];

  const message = next
    ? `Prioritize "${next.program}" at ${next.name}. Your writing velocity is higher on weekends — aim for one tightening pass Saturday.`
    : "Add deadlines to a few schools and I'll surface a focused plan for the week.";

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-[var(--outline-variant)] p-6"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--surface-container-lowest) 70%, transparent), color-mix(in srgb, var(--surface-container-lowest) 50%, transparent))",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        className="float-blob pointer-events-none absolute -top-5 -right-5 h-24 w-24 rounded-full"
        style={{
          background: "rgba(0,163,255,0.2)",
          filter: "blur(40px)",
        }}
        aria-hidden
      />
      <div className="relative">
        <div className="mb-3 flex items-center gap-3">
          <div
            className="grid h-9 w-9 place-items-center rounded-xl text-white"
            style={{ background: "var(--primary-container)" }}
          >
            <Icon name="smart_toy" fill size={20} />
          </div>
          <h4 className="m-0 text-lg font-bold tracking-tight text-[var(--on-surface)]">
            AI strategy
          </h4>
        </div>
        <p className="m-0 mb-4 text-sm leading-relaxed text-[var(--on-surface-variant)]">
          {message}
        </p>
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="w-full"
          iconRight="bolt"
        >
          <Link href="/assistant">View plan</Link>
        </Button>
      </div>
    </div>
  );
}

function QuickTool({
  icon,
  label,
  href,
}: {
  icon: string;
  label: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2.5 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--primary-container)]"
    >
      <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--surface-container)] text-[var(--outline)] transition-colors group-hover:bg-[var(--primary-container)]/15 group-hover:text-[var(--primary)]">
        <Icon name={icon} size={22} />
      </div>
      <span className="text-xs font-bold text-[var(--on-surface)]">{label}</span>
    </Link>
  );
}

function nextDeadline(schools: TimelineSchool[]): string | null {
  const sorted = schools
    .filter((s) => s.deadline)
    .sort(
      (a, b) =>
        new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime(),
    );
  return sorted[0]?.deadline ?? null;
}

function computeCompletion(schools: TimelineSchool[]): {
  pct: number;
  left: number;
} {
  const withDeadline = schools.filter((s) => s.deadline);
  if (withDeadline.length === 0) return { pct: 0, left: 0 };
  const now = Date.now();
  const passed = withDeadline.filter(
    (s) => new Date(s.deadline!).getTime() < now,
  ).length;
  const left = withDeadline.length - passed;
  const pct = Math.round((passed / withDeadline.length) * 100);
  return { pct, left };
}

function padTwo(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
