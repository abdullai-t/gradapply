"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { differenceInCalendarDays, format } from "date-fns";

import { Icon } from "@/components/icon";
import { PageLoader } from "@/components/page-loader";
import { SealAvatar } from "@/components/seal-avatar";
import { StatTile } from "@/components/stat-tile";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  useDeleteSchool,
  useSchool,
  useUpdateSchool,
} from "@/features/schools/api";
import type { SchoolRow } from "@/features/schools/types";
import { STATUS_TAG } from "@/features/schools/types";
import { useProfEmails } from "@/features/emails/api";
import { profEmailPath } from "@/features/emails/paths";
import { useSopVariant } from "@/features/sop-studio/api";
import { profEmailMatchesSchool } from "@/lib/prof-email-school-match";
import { admissionTermLabel } from "@/lib/admission-term";
import { progressFromStatus } from "@/lib/school-progress";
import { FitScoreBadge, FitScoreMeter } from "@/components/fit-score-badge";
import { cn } from "@/lib/utils";

import {
  buildApplicationChecklist,
  checklistCompletionPercent,
  type ChecklistItem,
} from "./application-checklist";
import { SchoolEditDialog } from "./school-edit-dialog";

type ProfEmailRow = {
  id: string;
  profName: string | null;
  university: string | null;
  researchArea: string | null;
  emailSubject: string | null;
  matchScore: number | null;
  status: string;
  updatedAt?: string | null;
};

const EMAIL_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  REPLIED: "Replied",
  NO_REPLY: "No reply",
  NOT_INTERESTED: "Not interested",
};

type Props = {
  schoolId: string;
};

export function SchoolDetailPage({ schoolId }: Props) {
  const router = useRouter();
  const schoolQuery = useSchool(schoolId);
  const variantQuery = useSopVariant(schoolId);
  const profEmailsQuery = useProfEmails();
  const updateSchool = useUpdateSchool();
  const deleteSchool = useDeleteSchool();
  const [editModalOpen, setEditModalOpen] = useState(false);

  const school = schoolQuery.data;
  const variant = variantQuery.data;

  const matchedProfEmails = useMemo(() => {
    if (!school) return [];
    const rows = (profEmailsQuery.data ?? []) as ProfEmailRow[];
    return rows
      .filter((row) => profEmailMatchesSchool(row, school))
      .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  }, [profEmailsQuery.data, school]);

  const checklist = useMemo(
    () =>
      school
        ? buildApplicationChecklist(school, variant, matchedProfEmails.length)
        : [],
    [school, variant, matchedProfEmails.length],
  );

  const checklistPct = checklistCompletionPercent(checklist);

  if (schoolQuery.isLoading) {
    return <PageLoader label="Loading school…" />;
  }

  if (schoolQuery.isError || !school) {
    return (
      <div className="slide-in space-y-10 pb-10">
        <div className="tactile-card rounded-3xl border border-[var(--outline-variant)] p-10 text-center">
          <Icon
            name="school"
            size={48}
            className="mx-auto text-[var(--outline)]"
          />
          <h1 className="t-headline-md mt-4 text-[var(--on-surface)]">
            School not found
          </h1>
          <p className="mt-2 text-sm text-[var(--on-surface-variant)]">
            This application may have been deleted or the link is invalid.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/schools">Back to schools</Link>
          </Button>
        </div>
      </div>
    );
  }

  const statusTag = STATUS_TAG[school.status];
  const pipelineProgress = progressFromStatus(school.status);
  const profDrafts = matchedProfEmails.filter((e) => e.status === "DRAFT").length;
  const profSent = matchedProfEmails.filter(
    (e) => e.status === "SENT" || e.status === "REPLIED",
  ).length;

  const patchSchool = (body: Partial<SchoolRow> & Record<string, unknown>) =>
    updateSchool.mutateAsync({ id: school.id, data: body });

  const handleDelete = async () => {
    if (!confirm("Delete this school and its tailored SOP?")) return;
    await deleteSchool.mutateAsync(school.id);
    router.push("/schools");
  };

  return (
    <div className="slide-in space-y-10 pb-10">
      <nav className="flex flex-wrap items-center gap-2 text-sm">
        <Link
          href="/schools"
          className="font-semibold text-[var(--on-surface-variant)] transition-colors hover:text-[var(--primary)]"
        >
          Schools
        </Link>
        <Icon name="chevron_right" size={16} className="text-[var(--outline)]" />
        <span className="font-bold text-[var(--on-surface)]">{school.name}</span>
      </nav>

      <SchoolHero
        school={school}
        statusLabel={statusTag.label}
        statusTone={statusTag.tone}
        pipelineProgress={pipelineProgress}
        checklistPct={checklistPct}
        onDelete={handleDelete}
        onEditDetails={() => setEditModalOpen(true)}
      />

      <SchoolEditDialog
        school={school}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onPatch={patchSchool}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          icon="percent"
          value={`${checklistPct}%`}
          label="Checklist done"
          tone="primary"
        />
        <StatTile
          icon="description"
          value={variant?.body?.trim() ? "Yes" : "—"}
          label="SOP draft"
          tone={variant?.body?.trim() ? "tertiary" : "neutral"}
        />
        <StatTile
          icon="mail"
          value={String(matchedProfEmails.length)}
          label="Prof. drafts"
          tone={matchedProfEmails.length > 0 ? "secondary" : "neutral"}
        />
        <StatTile
          icon="event"
          value={deadlineShort(school.deadline)}
          label="Deadline"
          tone={
            school.deadline && daysUntil(school.deadline) <= 14
              ? "warning"
              : "neutral"
          }
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-8">
          <SopDraftSection
            school={school}
            variant={variant}
            loading={variantQuery.isLoading}
          />
          <ProfessorDraftsSection
            school={school}
            emails={matchedProfEmails}
            draftCount={profDrafts}
            sentCount={profSent}
          />
        </div>

        <aside className="space-y-6">
          <ChecklistCard items={checklist} completionPct={checklistPct} />
          <FactsCard school={school} />
        </aside>
      </div>
    </div>
  );
}

function SchoolHero({
  school,
  statusLabel,
  statusTone,
  pipelineProgress,
  checklistPct,
  onDelete,
  onEditDetails,
}: {
  school: SchoolRow;
  statusLabel: string;
  statusTone: keyof typeof STATUS_PILL;
  pipelineProgress: number;
  checklistPct: number;
  onDelete: () => void;
  onEditDetails: () => void;
}) {
  const term = admissionTermLabel(school.term);

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
          <SealAvatar name={school.name} size={72} className="shrink-0" />
          <div className="min-w-0 pt-1">
            <StatusPill label={statusLabel} tone={statusTone} />
            <h1 className="t-headline-lg mt-3 text-[var(--on-surface)]">
              {school.name}
            </h1>
            <p className="mt-1 text-[15px] text-[var(--on-surface-variant)]">
              {school.program}
              {school.degree ? ` · ${school.degree}` : ""}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-[var(--outline)]">
              {school.country ? <span>{school.country}</span> : null}
              {term ? <span>{term} intake</span> : null}
              {school.funding?.trim() ? (
                <span className="text-[var(--tertiary)]">{school.funding}</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <Button
            variant="outline"
            size="sm"
            icon="edit"
            onClick={onEditDetails}
          >
            Edit details
          </Button>
          {school.portalUrl?.trim() ? (
            <Button variant="outline" size="sm" asChild>
              <a
                href={school.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="open_in_new" size={16} />
                Portal
              </a>
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/assistant?mode=sop&schoolId=${school.id}`}>
              <Icon name="auto_awesome" size={16} fill />
              SOP studio
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/timeline">Timeline</Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--error)]"
            icon="delete"
            onClick={() => void onDelete()}
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
              Pipeline status
            </span>
            <span className="text-xs font-extrabold text-[var(--primary)]">
              {pipelineProgress}%
            </span>
          </div>
          <Progress value={pipelineProgress} size="default" />
        </div>
        <div>
          <div className="mb-2 flex items-end justify-between">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
              Application checklist
            </span>
            <span className="text-xs font-extrabold text-[var(--secondary)]">
              {checklistPct}%
            </span>
          </div>
          <Progress value={checklistPct} tone="secondary" size="default" />
        </div>
      </div>
    </section>
  );
}

function SopDraftSection({
  school,
  variant,
  loading,
}: {
  school: SchoolRow;
  variant:
    | { id: string; title: string; body: string; updatedAt: string }
    | null
    | undefined;
  loading: boolean;
}) {
  const preview = variant?.body?.trim().slice(0, 420);

  return (
    <section className="tactile-card rounded-2xl border border-[var(--outline-variant)] p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--on-surface)]">
            Statement of purpose
          </h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            Tailored draft for this program — edit and refine in SOP studio.
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href={`/assistant?mode=sop&schoolId=${school.id}`}>
            {variant ? "Open studio" : "Create draft"}
          </Link>
        </Button>
      </header>

      {loading ? (
        <p className="mt-6 text-sm text-[var(--on-surface-variant)]">Loading draft…</p>
      ) : variant?.body?.trim() ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[var(--outline)]">
            <span className="rounded-full bg-[var(--primary-fixed)] px-2.5 py-1 text-[var(--primary)]">
              {variant.title}
            </span>
            <span>
              Updated {format(new Date(variant.updatedAt), "MMM d, yyyy")}
            </span>
          </div>
          <div className="rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--on-surface)]">
              {preview}
              {(variant.body.length ?? 0) > 420 ? "…" : ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)]/60 p-8 text-center">
          <Icon
            name="description"
            size={36}
            className="mx-auto text-[var(--outline)]"
          />
          <p className="mt-3 text-sm font-semibold text-[var(--on-surface)]">
            No tailored SOP yet
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--on-surface-variant)]">
            Paste or upload your master statement, then generate a version
            specific to {school.name}.
          </p>
        </div>
      )}
    </section>
  );
}

function ProfessorDraftsSection({
  school,
  emails,
  draftCount,
  sentCount,
}: {
  school: SchoolRow;
  emails: ProfEmailRow[];
  draftCount: number;
  sentCount: number;
}) {
  return (
    <section className="tactile-card rounded-2xl border border-[var(--outline-variant)] p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--on-surface)]">
            Professor outreach
          </h2>
          <p className="mt-1 text-sm text-[var(--on-surface-variant)]">
            Drafts matched to{" "}
            <span className="font-semibold text-[var(--on-surface)]">
              {school.name}
            </span>{" "}
            by university name.
          </p>
          {emails.length > 0 ? (
            <p className="mt-2 text-xs font-bold text-[var(--outline)]">
              {draftCount} draft · {sentCount} sent or replied
            </p>
          ) : null}
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/emails">Faculty emails</Link>
        </Button>
      </header>

      {emails.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)]/60 p-8 text-center">
          <Icon name="mail" size={36} className="mx-auto text-[var(--outline)]" />
          <p className="mt-3 text-sm font-semibold text-[var(--on-surface)]">
            No professor drafts linked yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-[var(--on-surface-variant)]">
            Discover faculty from the Emails page and select this school. Drafts
            whose university matches {school.name} will appear here.
          </p>
          <Button className="mt-4" size="sm" variant="secondary" asChild>
            <Link href="/emails">Discover professors</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {emails.map((row) => (
            <li key={row.id}>
              <Link
                href={profEmailPath(row.id)}
                className="group flex gap-4 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-4 transition-colors hover:border-[var(--primary-container)] hover:bg-[var(--primary-fixed)]/30"
              >
                <div
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[var(--primary)]"
                  style={{ background: "rgba(0,98,157,0.08)" }}
                >
                  <Icon name="person" size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[var(--on-surface)]">
                      {row.profName?.trim() || "Unnamed faculty"}
                    </span>
                    <FitScoreBadge score={row.matchScore} />
                    <EmailStatusPill status={row.status} />
                  </div>
                  <FitScoreMeter score={row.matchScore} className="mt-2" />
                  {row.researchArea ? (
                    <p className="mt-0.5 text-xs text-[var(--on-surface-variant)]">
                      {row.researchArea}
                    </p>
                  ) : null}
                  <p className="mt-1 truncate text-sm text-[var(--outline)]">
                    {row.emailSubject?.trim() || "No subject yet"}
                  </p>
                </div>
                <Icon
                  name="chevron_right"
                  size={20}
                  className="shrink-0 self-center text-[var(--outline)] transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChecklistCard({
  items,
  completionPct,
}: {
  items: ChecklistItem[];
  completionPct: number;
}) {
  return (
    <section className="tactile-card rounded-2xl border border-[var(--outline-variant)] p-5">
      <h2 className="text-sm font-bold text-[var(--on-surface)]">
        Application progress
      </h2>
      <p className="mt-1 text-xs text-[var(--on-surface-variant)]">
        {completionPct}% of recommended steps complete
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const inner = (
            <>
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                  item.done
                    ? "bg-[var(--tertiary-fixed)]/50 text-[var(--tertiary)]"
                    : "bg-[var(--surface-container)] text-[var(--outline)]",
                )}
              >
                <Icon
                  name={item.done ? "check_circle" : item.icon}
                  size={18}
                  fill={item.done}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-[var(--on-surface)]">
                  {item.label}
                </p>
                <p className="text-xs text-[var(--on-surface-variant)]">
                  {item.detail}
                </p>
              </div>
              {item.href && !item.done ? (
                <Icon name="north_east" size={16} className="text-[var(--primary)]" />
              ) : null}
            </>
          );

          return (
            <li key={item.id}>
              {item.href && !item.done ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-[var(--surface-container-low)]"
                >
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-3 rounded-xl p-2">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function FactsCard({ school }: { school: SchoolRow }) {
  const rows: { icon: string; label: string; value: string; href?: string }[] =
    [];

  if (school.deadline) {
    rows.push({
      icon: "event",
      label: "Deadline",
      value: formatDeadlineFact(school.deadline),
    });
  }
  if (school.reminderAt) {
    rows.push({
      icon: "notifications",
      label: "Reminder",
      value: [
        format(new Date(school.reminderAt), "MMM d, yyyy"),
        school.reminderNote?.trim(),
      ]
        .filter(Boolean)
        .join(" — "),
    });
  }
  if (school.portalUrl?.trim()) {
    rows.push({
      icon: "link",
      label: "Portal",
      value: "Open application site",
      href: school.portalUrl,
    });
  }
  if (school.funding?.trim()) {
    rows.push({
      icon: "payments",
      label: "Funding",
      value: school.funding,
    });
  }
  if (school.notes?.trim()) {
    rows.push({
      icon: "sticky_note_2",
      label: "Notes",
      value: school.notes.trim(),
    });
  }

  return (
    <section className="tactile-card rounded-2xl border border-[var(--outline-variant)] p-5">
      <h2 className="text-sm font-bold text-[var(--on-surface)]">Key details</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--on-surface-variant)]">
          Add deadline, portal, funding, or notes in Edit application below.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.label} className="flex gap-3">
              <Icon
                name={row.icon}
                size={18}
                className="mt-0.5 shrink-0 text-[var(--outline)]"
              />
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--outline)]">
                  {row.label}
                </p>
                {row.href ? (
                  <a
                    href={row.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-[var(--primary)] underline-offset-2 hover:underline"
                  >
                    {row.value}
                  </a>
                ) : (
                  <p className="text-sm leading-relaxed text-[var(--on-surface)]">
                    {row.value}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const STATUS_PILL: Record<
  "primary" | "secondary" | "tertiary" | "destructive" | "warning" | "muted",
  string
> = {
  primary:
    "bg-[var(--primary-fixed)] text-[var(--primary)] border border-[var(--primary-container)]/30",
  secondary:
    "bg-[var(--secondary-container)]/30 text-[var(--on-secondary-container)]",
  tertiary: "bg-[var(--tertiary-fixed)]/40 text-[var(--tertiary)]",
  destructive: "bg-[var(--error-container)] text-[var(--on-error-container)]",
  warning:
    "bg-[#fff7ed] text-[#c2410c] dark:bg-[#2a1f10] dark:text-[var(--streak-orange)]",
  muted: "bg-[var(--surface-container)] text-[var(--on-surface-variant)]",
};

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: keyof typeof STATUS_PILL;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em]",
        STATUS_PILL[tone],
      )}
    >
      {label}
    </span>
  );
}

function EmailStatusPill({ status }: { status: string }) {
  const label = EMAIL_STATUS_LABEL[status] ?? status;
  const tone =
    status === "REPLIED"
      ? "tertiary"
      : status === "SENT"
        ? "primary"
        : status === "DRAFT"
          ? "muted"
          : "warning";
  return <StatusPill label={label} tone={tone} />;
}

function formatDeadlineFact(iso: string): string {
  const d = new Date(iso);
  const days = differenceInCalendarDays(d, new Date());
  const date = format(d, "MMM d, yyyy");
  if (days < 0) return `Overdue · ${date}`;
  if (days === 0) return `Due today · ${date}`;
  if (days <= 30) return `Due in ${days}d · ${date}`;
  return date;
}

function deadlineShort(iso: string | null): string {
  if (!iso) return "—";
  const days = differenceInCalendarDays(new Date(iso), new Date());
  if (days < 0) return "Late";
  if (days === 0) return "Today";
  if (days <= 99) return `${days}d`;
  return format(new Date(iso), "MMM d");
}

function daysUntil(iso: string): number {
  return differenceInCalendarDays(new Date(iso), new Date());
}
