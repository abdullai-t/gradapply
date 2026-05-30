"use client";

import Link from "next/link";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { SealAvatar } from "@/components/seal-avatar";
import { SchoolStatus } from "@prisma/client";

export interface FocusSchool {
  id: string;
  name: string;
  program: string;
  status: SchoolStatus;
  statusLabel: string;
  deadlineLabel: string;
  urgencyChip: string | null;
  urgencyTone: "destructive" | "warning" | "neutral";
  materialsDone: number;
  materialsTotal: number;
}

const URGENCY_STYLES: Record<
  FocusSchool["urgencyTone"],
  { bg: string; fg: string; border: string }
> = {
  destructive: {
    bg: "rgba(186,26,26,0.12)",
    fg: "var(--error)",
    border: "rgba(186,26,26,0.3)",
  },
  warning: {
    bg: "rgba(255,150,0,0.12)",
    fg: "var(--streak-orange)",
    border: "rgba(255,150,0,0.35)",
  },
  neutral: {
    bg: "var(--surface-container)",
    fg: "var(--on-surface-variant)",
    border: "var(--outline-variant)",
  },
};

export function FocusSchoolGrid({ items }: { items: FocusSchool[] }) {
  if (items.length === 0) {
    return (
      <section>
        <div className="rise-in mb-5 flex items-center justify-between">
          <h2 className="t-headline-md m-0 text-[var(--on-surface)]">
            Your schools
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/schools">Open schools</Link>
          </Button>
        </div>
        <div className="rounded-3xl border-2 border-dashed border-[var(--outline-variant)] p-12 text-center">
          <Icon
            name="add_business"
            size={36}
            className="text-[var(--outline)]"
          />
          <p className="mt-3 text-sm text-[var(--on-surface-variant)]">
            Add programs to track deadlines, materials, and SOP drafts in one
            place.
          </p>
          <Button asChild className="mt-4" icon="add">
            <Link href="/schools">Add a school</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <div className="rise-in mb-5 flex items-center justify-between">
        <h2 className="t-headline-md m-0 text-[var(--on-surface)]">
          Your schools
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/schools">View all schools</Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {items.map((school) => (
          <FocusSchoolCard key={school.id} {...school} />
        ))}
      </div>
    </section>
  );
}

function FocusSchoolCard({
  id,
  name,
  program,
  statusLabel,
  deadlineLabel,
  urgencyChip,
  urgencyTone,
  materialsDone,
  materialsTotal,
}: FocusSchool) {
  const urgency = urgencyChip
    ? URGENCY_STYLES[urgencyTone]
    : null;

  return (
    <div className="tactile-card school-card group rounded-3xl border-2 border-[var(--outline-variant)] p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.06]">
          <SealAvatar name={name} size={52} />
        </div>
        {urgency ? (
          <span
            className="inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em]"
            style={{
              background: urgency.bg,
              color: urgency.fg,
              borderColor: urgency.border,
            }}
          >
            {urgencyChip}
          </span>
        ) : null}
      </div>
      <div className="mb-5">
        <h4 className="m-0 mb-1 text-xl font-bold text-[var(--on-surface)]">
          {name}
        </h4>
        <div className="t-label-lg text-[var(--on-surface-variant)]">
          {program}
        </div>
        <p className="m-0 mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--outline)]">
          {statusLabel}
        </p>
      </div>
      <div className="space-y-3 border-t-2 border-[var(--surface-container)] pt-5">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-[var(--on-surface-variant)]">Materials</span>
          <span className="font-bold text-[var(--on-surface)]">
            {materialsTotal > 0
              ? `${materialsDone}/${materialsTotal}`
              : "—"}
          </span>
        </div>
        {materialsTotal > 0 ? (
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-container)]"
            role="progressbar"
            aria-valuenow={materialsDone}
            aria-valuemin={0}
            aria-valuemax={materialsTotal}
          >
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all"
              style={{
                width: `${Math.round((materialsDone / materialsTotal) * 100)}%`,
              }}
            />
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5 text-[var(--outline)]">
            <Icon name="calendar_today" size={16} className="shrink-0" />
            <span className="t-label-lg truncate">{deadlineLabel}</span>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href={`/schools/${id}`}>Open</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
