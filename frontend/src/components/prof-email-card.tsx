"use client";

import type { EmailStatus } from "@/types/enums";
import type { ProfEmail } from "@/types/prof-email";
import { format } from "date-fns";
import { Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

function initials(name: string | null | undefined) {
  const n = (name ?? "?").trim();
  const p = n.split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return n.slice(0, 2).toUpperCase() || "?";
}

function statusBadge(status: EmailStatus) {
  switch (status) {
    case "DRAFT":
      return "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200";
    case "SENT":
      return "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200";
    case "REPLIED":
      return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200";
    case "NO_REPLY":
      return "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200";
    default:
      return "bg-zinc-100 text-zinc-800";
  }
}

type Props = {
  row: ProfEmail;
  onEdit: (row: ProfEmail) => void;
  onDelete: (row: ProfEmail) => void;
  onMarkReplied: (row: ProfEmail) => void;
};

export function ProfEmailCard({
  row,
  onEdit,
  onDelete,
  onMarkReplied,
}: Props) {
  const snippet =
    row.lastReplySnippet?.slice(0, 160) ??
    row.emailBody?.slice(0, 160) ??
    "";

  return (
    <article className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100">
            {initials(row.profName)}
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
              {row.profName ?? "Professor"}
            </h3>
            <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">
              {row.university ?? "—"}
              {row.researchArea ? ` · ${row.researchArea}` : ""}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {row.sentAt
                ? `Sent ${format(row.sentAt, "MMM d, yyyy")}`
                : "Not sent"}
              {row.repliedAt
                ? ` · Replied ${format(row.repliedAt, "MMM d, yyyy")}`
                : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium capitalize",
              statusBadge(row.status),
            )}
          >
            {row.status.replace("_", " ").toLowerCase()}
          </span>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Edit"
            onClick={() => onEdit(row)}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
            aria-label="Delete"
            onClick={() => onDelete(row)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {row.status !== "REPLIED" ? (
            <button
              type="button"
              className="rounded-lg border border-emerald-600 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
              onClick={() => onMarkReplied(row)}
            >
              Mark replied
            </button>
          ) : null}
        </div>
      </div>
      {snippet ? (
        <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
          {snippet}
          {(row.lastReplySnippet?.length ?? 0) > 160 ||
          (row.emailBody?.length ?? 0) > 160
            ? "…"
            : ""}
        </p>
      ) : null}
      <div className="mt-2 text-xs text-zinc-500">
        Follow-ups: {row.followUpCount}
      </div>
    </article>
  );
}
