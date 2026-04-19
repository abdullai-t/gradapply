"use client";

import type { School, SchoolStatus } from "@prisma/client";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { admissionTermLabel } from "@/lib/admission-term";
import { progressFromStatus } from "@/lib/school-progress";
import { cn } from "@/lib/utils";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2)
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function statusStyles(status: SchoolStatus) {
  switch (status) {
    case "PLANNING":
      return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
    case "APPLIED":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
    case "WAITING":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    case "ACCEPTED":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
    case "REJECTED":
      return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
    default:
      return "bg-zinc-100 text-zinc-800";
  }
}

function avatarTint(status: SchoolStatus) {
  switch (status) {
    case "PLANNING":
      return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100";
    case "APPLIED":
      return "bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100";
    case "WAITING":
      return "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100";
    case "ACCEPTED":
      return "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100";
    case "REJECTED":
      return "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100";
    default:
      return "bg-zinc-200 text-zinc-800";
  }
}

function statusLabel(status: SchoolStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ");
}

function fundingLabel(funding: string | null) {
  if (!funding) return "Funding TBD";
  const map: Record<string, string> = {
    Full: "Full funding",
    Partial: "Partial",
    None: "None",
    Unknown: "Unknown",
    FULL: "Full funding",
    PARTIAL: "Partial",
    NONE: "None",
    UNKNOWN: "Unknown",
  };
  return map[funding] ?? funding;
}

type SchoolCardProps = {
  school: School;
  onEdit: (s: School) => void;
  onDelete: (s: School) => void;
};

export function SchoolCard({ school, onEdit, onDelete }: SchoolCardProps) {
  const progressPct = progressFromStatus(school.status);
  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              avatarTint(school.status),
            )}
          >
            {initials(school.name)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
              {school.name}
            </h3>
            <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
              {school.program} · {school.degree}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {school.term ? `${admissionTermLabel(school.term)} · ` : ""}
              {school.deadline
                ? format(new Date(school.deadline), "MMM d, yyyy")
                : "No deadline"}{" "}
              · {fundingLabel(school.funding)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
              statusStyles(school.status),
            )}
          >
            {statusLabel(school.status)}
          </span>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800"
            aria-label="Edit school"
            onClick={() => onEdit(school)}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
            aria-label="Delete school"
            onClick={() => onDelete(school)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-zinc-500">
          <span>Progress</span>
          <span>{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-2" />
      </div>
    </article>
  );
}
