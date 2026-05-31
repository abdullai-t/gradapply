"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { Icon } from "@/components/icon";
import { SealAvatar } from "@/components/seal-avatar";
import { FitScoreBadge, FitScoreMeter } from "@/components/fit-score-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { profEmailsIndexPath } from "@/features/emails/paths";
import { ProfEmailStatusPill } from "@/features/emails/prof-email-status-pill";
import {
  EMAIL_STATUS_LABEL,
  EMAIL_STATUSES,
  type EmailRow,
  type EmailStatus,
} from "@/features/emails/types";
import { cn } from "@/lib/utils";

type AuditRow = {
  title: string;
  year: string | null;
  summary: string;
  evidence: string | null;
};

type DetailTab = "profile" | "insights" | "publications";

export function ProfEmailBreadcrumb({ profName }: { profName: string | null }) {
  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm">
      <Link
        href={profEmailsIndexPath()}
        className="font-semibold text-[var(--on-surface-variant)] transition-colors hover:text-[var(--primary)]"
      >
        Professor drafts
      </Link>
      <Icon name="chevron_right" size={16} className="text-[var(--outline)]" />
      <span className="line-clamp-1 font-bold text-[var(--on-surface)]">
        {profName ?? "Professor"}
      </span>
    </nav>
  );
}

export function ProfEmailHero({
  selected,
  gmailConnected,
  googleOAuthConfigured,
  sendingViaGmail,
  drafting,
  deleting,
  onSendGmail,
  onAiDraft,
  onDelete,
}: {
  selected: EmailRow;
  gmailConnected: boolean;
  googleOAuthConfigured: boolean;
  sendingViaGmail: boolean;
  drafting: boolean;
  deleting?: boolean;
  onSendGmail: () => void;
  onAiDraft: () => void;
  onDelete: () => void;
}) {
  const canSend = googleOAuthConfigured && gmailConnected;

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-[var(--outline-variant)] p-6 md:p-8"
      style={{
        background:
          "linear-gradient(145deg, var(--surface-container-lowest) 0%, var(--surface-container-low) 55%, var(--primary-fixed) 160%)",
      }}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4 md:gap-5">
          <SealAvatar name={selected.profName ?? "Professor"} size={72} className="shrink-0" />
          <div className="min-w-0 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <ProfEmailStatusPill status={selected.status} />
              {selected.matchScore != null ? (
                <FitScoreBadge score={selected.matchScore} label="match" />
              ) : null}
            </div>
            <h1 className="t-headline-lg mt-3 text-[var(--on-surface)]">
              {selected.profName ?? "Professor"}
            </h1>
            <p className="mt-1 text-[15px] text-[var(--on-surface-variant)]">
              {selected.university ?? "Institution"}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-[var(--outline)]">
              {selected.profEmail ? <span>{selected.profEmail}</span> : null}
              {selected.researchArea ? (
                <span className="line-clamp-1 text-[var(--on-surface-variant)]">
                  {selected.researchArea}
                </span>
              ) : null}
            </div>
            {selected.matchScore != null ? (
              <FitScoreMeter score={selected.matchScore} className="mt-3 max-w-[200px]" />
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:max-w-sm md:justify-end">
          {canSend ? (
            <Button
              variant="primary"
              size="sm"
              loading={sendingViaGmail}
              onClick={onSendGmail}
            >
              Send via Gmail
            </Button>
          ) : null}
          <Button
            variant="secondary"
            size="sm"
            loading={drafting}
            onClick={onAiDraft}
            title={
              selected.profileUrl?.trim()
                ? "Regenerate using profile URL and your interests"
                : "Draft from name, university, and research area"
            }
          >
            Improve with AI
          </Button>
          {selected.profileUrl?.trim() ? (
            <Button variant="outline" size="sm" asChild>
              <a href={selected.profileUrl} target="_blank" rel="noopener noreferrer">
                <Icon name="open_in_new" size={16} />
                Faculty page
              </a>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--error)]"
            icon="delete"
            loading={deleting}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      </div>

      {!googleOAuthConfigured ? (
        <p className="mt-4 rounded-xl border border-[var(--streak-orange)]/35 bg-[var(--streak-orange-soft)] px-3 py-2 text-sm text-[#7a3a08] dark:text-[var(--streak-orange)]">
          Gmail send is unavailable until OAuth is configured on this deployment.
        </p>
      ) : !gmailConnected ? (
        <p className="mt-4 rounded-xl border border-[var(--streak-orange)]/35 bg-[var(--streak-orange-soft)] px-3 py-2 text-sm text-[#7a3a08] dark:text-[var(--streak-orange)]">
          <Link
            href="/settings"
            className="font-semibold text-[var(--primary)] underline-offset-4 hover:underline"
          >
            Connect Gmail in Settings
          </Link>{" "}
          to send from your mailbox. Add the professor&apos;s email in the sidebar before sending.
        </p>
      ) : (
        <p className="mt-4 text-xs text-[var(--on-surface-variant)]">
          Verify the professor email and profile link, then send from your own Gmail for best
          deliverability.
        </p>
      )}
    </section>
  );
}

export function EmailDraftEditor({
  selected,
  draftSubject,
  draftBody,
  drafting,
  onSubjectChange,
  onBodyChange,
  onSubjectBlur,
  onBodyBlur,
  onTemplate,
  onAiDraft,
  onClarity,
  onShorten,
  onSaveVersion,
}: {
  selected: EmailRow;
  draftSubject: string;
  draftBody: string;
  drafting: boolean;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onSubjectBlur: () => void;
  onBodyBlur: () => void;
  onTemplate: () => void;
  onAiDraft: () => void;
  onClarity: () => void;
  onShorten: () => void;
  onSaveVersion: () => void;
}) {
  const wordCount = draftBody.trim() ? draftBody.trim().split(/\s+/).length : 0;

  return (
    <section className="tactile-card rounded-2xl border border-[var(--outline-variant)] p-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--outline-variant)] pb-5">
        <div>
          <h2 className="text-lg font-bold text-[var(--on-surface)]">Email draft</h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            Versioned cold email for {selected.profName ?? "this professor"}.
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-container)] px-2.5 py-1 text-xs font-bold text-[var(--on-surface-variant)]">
          {wordCount} words
        </span>
      </header>

      <div className="mt-5 flex flex-wrap gap-2">
        <ToolbarButton onClick={onTemplate}>Use template</ToolbarButton>
        <ToolbarButton onClick={onAiDraft} loading={drafting}>
          Personalize with AI
        </ToolbarButton>
        <ToolbarButton onClick={onClarity}>Improve clarity</ToolbarButton>
        <ToolbarButton onClick={onShorten}>Shorten</ToolbarButton>
        <ToolbarButton onClick={onSaveVersion}>Save version</ToolbarButton>
      </div>

      <div className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email-subject" className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
            Subject line
          </Label>
          <Input
            id="email-subject"
            className="border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] font-medium"
            placeholder={`Research fit — ${selected.profName ?? "Professor"}`}
            value={draftSubject}
            onChange={(e) => onSubjectChange(e.target.value)}
            onBlur={onSubjectBlur}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-body" className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
            Email body
          </Label>
          <Textarea
            id="email-body"
            className="font-display min-h-[min(52vh,420px)] resize-y border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[15px] leading-relaxed text-[var(--on-surface)]"
            placeholder={`Dear ${selected.profName ?? "Professor"},\n\n`}
            value={draftBody}
            onChange={(e) => onBodyChange(e.target.value)}
            onBlur={onBodyBlur}
          />
        </div>
      </div>
    </section>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  loading,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      loading={loading}
      className="h-8 rounded-full border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 text-xs font-semibold"
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ResearchContextPanel({
  selected,
  detailTab,
  onTabChange,
  profEmailDraft,
  onProfEmailChange,
  onSaveEmail,
  auditLatestResearch,
  auditError,
  auditingResearch,
  onRunAudit,
}: {
  selected: EmailRow;
  detailTab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  profEmailDraft: string;
  onProfEmailChange: (v: string) => void;
  onSaveEmail: () => void;
  auditLatestResearch: AuditRow[];
  auditError: string | null;
  auditingResearch: boolean;
  onRunAudit: () => void;
}) {
  const tabs: { id: DetailTab; label: string }[] = [
    { id: "profile", label: "Contact" },
    { id: "insights", label: "Insights" },
    { id: "publications", label: "Research" },
  ];

  return (
    <section className="tactile-card rounded-2xl border border-[var(--outline-variant)] p-5">
      <header className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--on-surface)]">Professor context</h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            Contact details and latest research for personalization.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          loading={auditingResearch}
          onClick={onRunAudit}
        >
          Run research audit
        </Button>
        <div
          className="grid grid-cols-3 gap-1 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-1"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={detailTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "h-9 rounded-lg text-xs font-bold transition-colors",
                detailTab === tab.id
                  ? "bg-[var(--surface-container-high)] text-[var(--on-surface)] shadow-sm"
                  : "text-[var(--on-surface-variant)] hover:text-[var(--on-surface)]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mt-5" role="tabpanel">
        {detailTab === "profile" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prof-email-sidebar">Professor email</Label>
              <div className="flex gap-2">
                <Input
                  id="prof-email-sidebar"
                  value={profEmailDraft}
                  onChange={(e) => onProfEmailChange(e.target.value)}
                  placeholder="name@university.edu"
                  type="email"
                  className="border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
                />
                <Button type="button" variant="secondary" size="sm" onClick={onSaveEmail}>
                  Save
                </Button>
              </div>
              {!profEmailDraft.trim() ? (
                <p className="rounded-lg border border-[var(--streak-orange)]/35 bg-[var(--streak-orange-soft)] px-2.5 py-2 text-xs text-[#7a3a08] dark:text-[var(--streak-orange)]">
                  Required before sending.{" "}
                  {selected.profileUrl ? (
                    <a
                      href={selected.profileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline"
                    >
                      Find on faculty page
                    </a>
                  ) : (
                    "Add from the faculty directory."
                  )}
                </p>
              ) : null}
            </div>
            {selected.researchArea ? (
              <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--outline)]">
                  Listed research area
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--on-surface)]">
                  {selected.researchArea}
                </p>
              </div>
            ) : null}
          </div>
        ) : detailTab === "insights" ? (
          <ResearchTabBody
            rows={auditLatestResearch}
            fallback={
              selected.researchArea?.trim() ||
              "Run a research audit to pull talking points from recent publications."
            }
            emptyTitle="No insights yet"
            emptyHint="The audit summarizes fit angles you can weave into your opening paragraph."
          />
        ) : (
          <ResearchTabBody
            rows={auditLatestResearch}
            fallback={null}
            emptyTitle="No publications loaded"
            emptyHint="Run research audit to surface the three most recent items."
            showEvidence
          />
        )}

        {auditError ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-[var(--error)]/40 bg-[var(--error-container)] p-2.5 text-xs text-[var(--on-error-container)]"
          >
            {auditError}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ResearchTabBody({
  rows,
  fallback,
  emptyTitle,
  emptyHint,
  showEvidence,
}: {
  rows: AuditRow[];
  fallback: string | null;
  emptyTitle: string;
  emptyHint: string;
  showEvidence?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)]/60 p-6 text-center">
        <Icon name="science" size={32} className="mx-auto text-[var(--outline)]" />
        <p className="mt-3 text-sm font-semibold text-[var(--on-surface)]">{emptyTitle}</p>
        <p className="mx-auto mt-1 max-w-[240px] text-xs text-[var(--on-surface-variant)]">
          {fallback ?? emptyHint}
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r, idx) => (
        <li
          key={`${r.title}-${idx}`}
          className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-3"
        >
          <p className="text-sm font-semibold text-[var(--on-surface)]">{r.title}</p>
          {r.year ? (
            <p className="mt-0.5 text-xs font-medium text-[var(--on-surface-variant)]">{r.year}</p>
          ) : null}
          {r.summary ? (
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--on-surface-variant)]">
              {r.summary}
            </p>
          ) : null}
          {showEvidence && r.evidence ? (
            <p className="mt-1 text-[10px] text-[var(--outline)]">Source: {r.evidence}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function OutreachTrackingCard({
  status,
  notes,
  onStatusChange,
  onNotesBlur,
}: {
  status: EmailStatus;
  notes: string | null;
  onStatusChange: (status: EmailStatus) => void;
  onNotesBlur: (notes: string) => void;
}) {
  return (
    <section className="tactile-card rounded-2xl border border-[var(--outline-variant)] p-5">
      <h2 className="text-lg font-bold text-[var(--on-surface)]">Outreach tracking</h2>
      <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
        Pipeline status and private notes for this thread.
      </p>
      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
            Status
          </Label>
          <Select value={status} onValueChange={(v) => onStatusChange(v as EmailStatus)}>
            <SelectTrigger className="border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
              <SelectValue>{EMAIL_STATUS_LABEL[status]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EMAIL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {EMAIL_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
            Your notes
          </Label>
          <Textarea
            className="min-h-[100px] border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]"
            defaultValue={notes ?? ""}
            placeholder="Follow-up date, lab fit, who referred you…"
            onBlur={(e) => onNotesBlur(e.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
