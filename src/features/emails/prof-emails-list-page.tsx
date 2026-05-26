"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Plus, Search, Sparkles, Trash2 } from "lucide-react";

import { Icon } from "@/components/icon";
import { PageLoader } from "@/components/page-loader";
import { SealAvatar } from "@/components/seal-avatar";
import { StatTile } from "@/components/stat-tile";
import { FitScoreBadge } from "@/components/fit-score-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfEmails } from "@/features/emails/api";
import { cn } from "@/lib/utils";

import { CreateProfEmailDialog } from "./create-prof-email-dialog";
import { profEmailPath } from "./paths";
import { ProfEmailStatusPill } from "./prof-email-status-pill";
import type { EmailRow, EmailStatus } from "./types";
import { EMAIL_STATUSES } from "./types";

export function ProfEmailsListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profEmailsQuery = useProfEmails();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | EmailStatus>("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  const rows = useMemo(
    () => (profEmailsQuery.data ?? []) as EmailRow[],
    [profEmailsQuery.data],
  );

  useEffect(() => {
    const thread = searchParams.get("thread");
    if (thread) {
      router.replace(profEmailPath(thread));
    }
  }, [searchParams, router]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        row.profName ?? "",
        row.university ?? "",
        row.profEmail ?? "",
        row.researchArea ?? "",
        row.emailSubject ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, searchQuery, statusFilter]);

  const existingProfessorEmails = useMemo(
    () =>
      new Set(
        rows
          .map((r) => (r.profEmail ?? "").trim().toLowerCase())
          .filter((email) => email.length > 0),
      ),
    [rows],
  );

  const stats = useMemo(() => {
    const draft = rows.filter((r) => r.status === "DRAFT").length;
    const sent = rows.filter((r) => r.status === "SENT").length;
    const replied = rows.filter((r) => r.status === "REPLIED").length;
    const withFit = rows.filter((r) => r.matchScore != null).length;
    return { total: rows.length, draft, sent, replied, withFit };
  }, [rows]);

  const remove = async (id: string, name: string | null) => {
    if (!confirm(`Delete outreach draft for ${name ?? "this professor"}?`)) return;
    const res = await fetch(`/api/prof-emails/${id}`, { method: "DELETE" });
    if (res.ok) await profEmailsQuery.refetch();
  };

  if (profEmailsQuery.isLoading) {
    return <PageLoader label="Loading professor drafts…" />;
  }

  return (
    <div className="slide-in space-y-10 pb-10">
      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary/90">
            Scholar outreach
          </p>
          <h1 className="t-headline-lg text-[var(--on-surface)]">Professor drafts</h1>
          <p className="max-w-2xl text-sm text-[var(--on-surface-variant)]">
            Cold emails tailored to each professor. Open a draft to edit the manuscript, run a
            research audit, and send from your Gmail when ready.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add draft
        </Button>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total drafts" value={stats.total} icon="mail" />
        <StatTile label="In progress" value={stats.draft} icon="edit_note" />
        <StatTile label="Sent" value={stats.sent} icon="send" />
        <StatTile label="Replied" value={stats.replied} icon="forum" />
      </div>

      <div className="tactile-card rounded-2xl border border-[var(--outline-variant)] p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--on-surface-variant)]" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by professor, school, email, or research area"
              className="h-10 border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterChip
              active={statusFilter === "ALL"}
              onClick={() => setStatusFilter("ALL")}
              label={`All (${rows.length})`}
            />
            {EMAIL_STATUSES.map((status) => (
              <FilterChip
                key={status}
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
                label={`${status.replaceAll("_", " ")} (${rows.filter((r) => r.status === status).length})`}
              />
            ))}
          </div>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="tactile-card rounded-3xl border border-dashed border-[var(--outline-variant)] p-12 text-center">
          <Icon name="person_search" size={48} className="mx-auto text-[var(--outline)]" />
          <h2 className="t-headline-sm mt-4 text-[var(--on-surface)]">
            {rows.length === 0 ? "No professor drafts yet" : "No drafts match your filters"}
          </h2>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            {rows.length === 0
              ? "Add a draft from a faculty URL or discover professors from your school shortlist."
              : "Try clearing search or choosing a different status filter."}
          </p>
          {rows.length === 0 ? (
            <Button type="button" className="mt-6" onClick={() => setCreateOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" aria-hidden />
              Create first draft
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredRows.map((row) => (
            <ProfEmailCard
              key={row.id}
              row={row}
              onDelete={() => void remove(row.id, row.profName)}
            />
          ))}
        </div>
      )}

      <CreateProfEmailDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingProfessorEmails={existingProfessorEmails}
        onCreated={(created) => router.push(profEmailPath(created.id))}
      />
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "secondary" : "ghost"}
      onClick={onClick}
      className={cn(
        "h-8 rounded-full capitalize",
        active && "bg-[var(--secondary-container)] text-[var(--on-secondary-container)]",
      )}
    >
      {label}
    </Button>
  );
}

function ProfEmailCard({
  row,
  onDelete,
}: {
  row: EmailRow;
  onDelete: () => void;
}) {
  const updatedLabel =
    row.updatedAt != null
      ? formatDistanceToNow(new Date(row.updatedAt), { addSuffix: true })
      : null;

  return (
    <article className="tactile-card group relative rounded-2xl border border-[var(--outline-variant)] p-4 transition hover:border-[var(--outline)]">
      <Link href={profEmailPath(row.id)} className="absolute inset-0 z-0 rounded-2xl" aria-label={`Open draft for ${row.profName ?? "professor"}`} />
      <div className="relative z-10 flex items-start gap-3 pointer-events-none">
        <SealAvatar name={row.profName ?? "Professor"} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="line-clamp-1 font-semibold text-[var(--on-surface)]">
              {row.profName ?? "Professor"}
            </h3>
            <ProfEmailStatusPill status={row.status} />
            {row.matchScore != null ? (
              <FitScoreBadge score={row.matchScore} className="pointer-events-auto" />
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-1 text-sm text-[var(--on-surface-variant)]">
            {row.university ?? "University"}
            {row.profEmail ? ` · ${row.profEmail}` : ""}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-[var(--on-surface)]/90">
            {row.emailSubject?.trim() || "No subject yet"}
          </p>
          {row.researchArea ? (
            <p className="mt-1 line-clamp-1 text-xs text-[var(--on-surface-variant)]">
              {row.researchArea}
            </p>
          ) : null}
          {updatedLabel ? (
            <p className="mt-2 text-[11px] text-[var(--on-surface-variant)]">
              Updated {updatedLabel}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="pointer-events-auto h-8 w-8 shrink-0 text-[var(--on-surface-variant)] hover:text-destructive"
          aria-label={`Delete ${row.profName ?? "draft"}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </article>
  );
}
