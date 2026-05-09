"use client";

import * as React from "react";
import Link from "next/link";
import { format, differenceInCalendarDays } from "date-fns";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SealAvatar } from "@/components/seal-avatar";
import { progressFromStatus } from "@/lib/school-progress";
import { cn } from "@/lib/utils";

import type { SchoolRow } from "./types";
import { STATUS_TAG } from "./types";

export interface SchoolGridCardProps {
  school: SchoolRow;
  /** Whether this card is the currently expanded one (renders inline edit form). */
  expanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  /** Children render slot for the expanded edit form (lives below the card body). */
  children?: React.ReactNode;
}

/**
 * Tactile school card — the design's signature 2-col list item.
 *
 * Collapsed: seal avatar, name + program, status pill, progress bar, deadline,
 * tailor-SOP link, delete button.
 * Expanded: above + a children slot underneath for inline editing.
 */
export function SchoolGridCard({
  school,
  expanded,
  onToggleExpand,
  onDelete,
  children,
}: SchoolGridCardProps) {
  const tag = STATUS_TAG[school.status];
  const progress = progressFromStatus(school.status);
  const deadlineLabel = school.deadline
    ? deadlineCopy(school.deadline)
    : "No deadline";
  const isSubmitted = school.status === "APPLIED" || school.status === "ACCEPTED";

  return (
    <div
      className={cn(
        "tactile-card group relative flex flex-col gap-4 rounded-2xl border border-[var(--outline-variant)] p-6",
      )}
    >
      <div className="absolute right-4 top-4">
        <StatusPill label={tag.label} tone={tag.tone} />
      </div>

      <button
        type="button"
        onClick={onToggleExpand}
        aria-expanded={expanded}
        className="flex items-start gap-4 pr-28 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)]"
      >
        <SealAvatar name={school.name} size={64} />
        <div className="min-w-0">
          <h3 className="text-xl font-bold leading-tight tracking-tight text-[var(--on-surface)]">
            {school.name}
          </h3>
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--on-surface-variant)]">
            {school.program} · {school.degree}
          </p>
          {school.country ? (
            <p className="mt-1 text-xs text-[var(--outline)]">{school.country}</p>
          ) : null}
        </div>
      </button>

      <div>
        <div className="mb-1.5 flex items-end justify-between">
          <span className="text-[12px] font-bold text-[var(--on-surface-variant)]">
            Application progress
          </span>
          <span className="text-[12px] font-extrabold text-[var(--primary)]">
            {progress}%
          </span>
        </div>
        <Progress
          value={progress}
          tone={progress === 100 ? "tertiary" : "primary"}
          size="default"
        />
      </div>

      <div className="flex items-center justify-between border-t border-[var(--surface-container)] pt-4">
        <div className="flex items-center gap-1.5 text-[var(--on-surface-variant)]">
          <Icon
            name={isSubmitted ? "check_circle" : "event"}
            size={16}
            fill={isSubmitted}
          />
          <span className="text-xs font-bold">{deadlineLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          {school.portalUrl?.trim() ? (
            <a
              href={school.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="grid h-9 w-9 place-items-center rounded-lg text-[var(--outline)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--primary)]"
              aria-label="Open application portal"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="open_in_new" size={18} />
            </a>
          ) : null}
          <Link
            href={`/assistant?mode=sop&schoolId=${school.id}`}
            prefetch={false}
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--outline)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--primary)]"
            aria-label="Open SOP studio"
            title="Tailor SOP for this school"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="auto_awesome" fill size={18} />
          </Link>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--outline)] transition-colors hover:bg-[var(--error-container)] hover:text-[var(--error)]"
            aria-label="Delete school"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Icon name="delete" size={18} />
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-1"
            onClick={onToggleExpand}
            iconRight={expanded ? "expand_less" : "expand_more"}
          >
            {expanded ? "Close" : "Edit"}
          </Button>
        </div>
      </div>

      {expanded && children ? (
        <div className="border-t border-[var(--outline-variant)] pt-5 -mx-6 -mb-6 px-6 pb-6 bg-[var(--surface-container-low)] rounded-b-2xl">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function deadlineCopy(iso: string): string {
  const d = new Date(iso);
  const days = differenceInCalendarDays(d, new Date());
  const date = format(d, "MMM d, yyyy");
  if (days < 0) return `Overdue · ${date}`;
  if (days === 0) return `Due today · ${date}`;
  if (days <= 30) return `Due in ${days}d · ${date}`;
  return date;
}

const PILL_TONE: Record<
  "primary" | "secondary" | "tertiary" | "destructive" | "warning" | "muted",
  string
> = {
  primary:
    "bg-[var(--primary-fixed)] text-[var(--primary)] border border-[var(--primary-container)]/30",
  secondary:
    "bg-[var(--secondary-container)]/30 text-[var(--on-secondary-container)] border border-[var(--secondary-container)]/40",
  tertiary:
    "bg-[var(--tertiary-fixed)]/40 text-[var(--tertiary)] border border-[var(--tertiary)]/30",
  destructive:
    "bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/30",
  warning:
    "bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] dark:bg-[#2a1f10] dark:text-[var(--streak-orange)] dark:border-[#5c4a2a]",
  muted:
    "bg-[var(--surface-container)] text-[var(--on-surface-variant)] border border-[var(--outline-variant)]",
};

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: keyof typeof PILL_TONE;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em]",
        PILL_TONE[tone],
      )}
    >
      {label}
    </span>
  );
}
