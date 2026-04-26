"use client";

import { useState } from "react";

import { Icon } from "@/components/icon";

type TabKey = "pipeline" | "timeline" | "studio" | "vault";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "pipeline", label: "School pipeline", icon: "account_tree" },
  { key: "timeline", label: "Timeline", icon: "schedule" },
  { key: "studio", label: "Professor studio", icon: "history_edu" },
  { key: "vault", label: "Document vault", icon: "description" },
];

/**
 * Functional tab switcher for the landing page's "Workspace Showcase" section.
 * Each tab swaps the embedded mini-preview to a different feature snapshot.
 *
 * Pure JSX with hardcoded sample data — these are visual proof-points for
 * the marketing surface, not live product data. If you tweak a label or
 * add a tab here, the production dashboard / timeline / etc. is untouched.
 */
export function WorkspaceShowcase() {
  const [active, setActive] = useState<TabKey>("pipeline");

  return (
    <div>
      {/* Tab bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TABS.map((t) => {
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActive(t.key)}
              className={
                "flex cursor-pointer flex-col items-center rounded-xl p-5 text-center transition-all duration-150 " +
                (isActive
                  ? "bg-[var(--primary)] text-white [box-shadow:0_4px_0_0_var(--primary-fixed-dim)] -translate-y-1"
                  : "bg-[var(--surface-container)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)]")
              }
            >
              <Icon
                name={t.icon}
                fill={isActive}
                size={28}
                className="mb-3"
              />
              <span className="text-xs font-extrabold tracking-tight">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Showcase canvas */}
      <div className="overflow-hidden rounded-3xl border border-[var(--outline-variant)] bg-white shadow-[0_24px_60px_-30px_rgba(0,98,157,0.35)]">
        <div className="grid lg:grid-cols-5 min-h-[480px]">
          {/* Left pitch panel — common to every tab */}
          <div className="border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-10 lg:col-span-2 lg:border-b-0 lg:border-r">
            <h4 className="t-headline-md m-0 text-[var(--primary)]">
              {TAB_PITCH[active].title}
            </h4>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--on-surface-variant)]">
              {TAB_PITCH[active].body}
            </p>
            <ul className="mt-7 space-y-4">
              {TAB_PITCH[active].bullets.map((b) => (
                <li key={b.title} className="flex items-start gap-3">
                  <div className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--secondary-container)] text-[var(--on-secondary-container)]">
                    <Icon name="check" size={14} />
                  </div>
                  <div>
                    <p className="m-0 text-sm font-bold text-[var(--on-surface)]">
                      {b.title}
                    </p>
                    <p className="m-0 text-xs text-[var(--on-surface-variant)]">
                      {b.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right preview panel — switches per tab */}
          <div className="bg-white p-7 lg:col-span-3">
            {active === "pipeline" ? <PipelinePreview /> : null}
            {active === "timeline" ? <TimelinePreview /> : null}
            {active === "studio" ? <StudioPreview /> : null}
            {active === "vault" ? <VaultPreview /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

const TAB_PITCH: Record<
  TabKey,
  { title: string; body: string; bullets: { title: string; detail: string }[] }
> = {
  pipeline: {
    title: "School pipeline",
    body: "Visual tracking for every phase of your application lifecycle. Documents, interviews, follow-ups — one view.",
    bullets: [
      {
        title: "Real-time tracking",
        detail: "Instant updates on deadlines and portal statuses.",
      },
      {
        title: "Reference hub",
        detail: "Request and monitor LORs from the dashboard.",
      },
    ],
  },
  timeline: {
    title: "Timeline & deadlines",
    body: "Active reminders at the top, deadlines grouped by month, overdue highlighted so nothing slips past.",
    bullets: [
      {
        title: "Snooze, don't lose",
        detail: "Push reminders forward without losing the deadline.",
      },
      {
        title: "Urgency colors",
        detail: "Overdue, this week, this month — color-coded at a glance.",
      },
    ],
  },
  studio: {
    title: "Professor outreach studio",
    body: "Discover faculty matches, draft warm intros with AI, version your replies, send via Gmail with attachments.",
    bullets: [
      {
        title: "Faculty discovery",
        detail: "Match score 1-5 with rationale per professor.",
      },
      {
        title: "Reply analysis",
        detail: "Paste a reply, get intent + suggested next move.",
      },
    ],
  },
  vault: {
    title: "Document vault",
    body: "Upload SOPs, CVs, transcripts, GRE scores. Folder taxonomy, quick access, version snapshots when you need to roll back.",
    bullets: [
      {
        title: "Folders + categories",
        detail: "Organize by program or by document type.",
      },
      {
        title: "Storage health",
        detail: "See exactly how much room you have left.",
      },
    ],
  },
};

/* ============== Per-tab previews ============== */

function PipelinePreview() {
  return (
    <div>
      {/* Filter row */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex gap-2">
          <span className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-extrabold text-white shadow-[0_2px_0_0_var(--primary-fixed-dim)]">
            All Programs (12)
          </span>
          <span className="rounded-lg px-3 py-1.5 text-xs font-extrabold text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]">
            By Deadline
          </span>
        </div>
        <div className="flex gap-1 text-[var(--outline)]">
          <Icon name="search" size={20} />
          <Icon name="filter_list" size={20} />
        </div>
      </div>
      {/* Rows */}
      <div className="space-y-3">
        <PipelineRow
          letter="S"
          name="Stanford University"
          avatarBg="#8C1515"
          status="Writing essay"
          statusTone="amber"
          progress={65}
          deadline="Dec 1"
        />
        <PipelineRow
          letter="M"
          name="MIT"
          avatarBg="#000000"
          status="Submitted"
          statusTone="green"
          progress={100}
          deadline="Nov 15"
        />
        <PipelineRow
          letter="H"
          name="Harvard University"
          avatarBg="#A41034"
          status="References pending"
          statusTone="blue"
          progress={32}
          deadline="Jan 1"
        />
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--outline-variant)] py-5 text-sm font-bold text-[var(--outline)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary)]/5 hover:text-[var(--primary)]"
        >
          <Icon name="add_circle" size={20} />
          Add new program
        </button>
      </div>
    </div>
  );
}

function PipelineRow({
  letter,
  name,
  avatarBg,
  status,
  statusTone,
  progress,
  deadline,
}: {
  letter: string;
  name: string;
  avatarBg: string;
  status: string;
  statusTone: "amber" | "green" | "blue";
  progress: number;
  deadline: string;
}) {
  const tone = TONE_STYLES[statusTone];
  return (
    <div className="group flex cursor-pointer items-center rounded-2xl border border-[var(--outline-variant)] bg-white p-4 shadow-sm transition-all hover:translate-x-2 hover:shadow-md">
      <div
        className="mr-4 grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-black text-white transition-transform group-hover:scale-110"
        style={{ background: avatarBg }}
      >
        {letter}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h5 className="m-0 truncate text-sm font-bold text-[var(--on-surface)] transition-colors group-hover:text-[var(--primary)]">
            {name}
          </h5>
          <div className="flex shrink-0 items-center gap-1.5">
            {statusTone === "green" ? (
              <Icon
                name="verified"
                size={14}
                style={{ color: tone.dot }}
              />
            ) : (
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ background: tone.dot }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ background: tone.dot }}
                />
              </span>
            )}
            <span
              className="rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em]"
              style={{
                background: tone.bg,
                color: tone.text,
                borderColor: tone.border,
              }}
            >
              {status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-container)]">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progress}%`, background: tone.bar }}
            />
          </div>
          <span className="flex w-20 shrink-0 items-center gap-1 text-[10px] font-bold text-[var(--outline)]">
            <Icon name="calendar_today" size={12} />
            {deadline}
          </span>
        </div>
      </div>
      <Icon
        name="chevron_right"
        size={20}
        className="ml-3 text-[var(--outline-variant)] transition-colors group-hover:text-[var(--primary)]"
      />
    </div>
  );
}

const TONE_STYLES: Record<
  "amber" | "green" | "blue",
  {
    dot: string;
    bg: string;
    text: string;
    border: string;
    bar: string;
  }
> = {
  amber: {
    dot: "#f59e0b",
    bg: "#fef3c7",
    text: "#854d0e",
    border: "#fde68a",
    bar: "#f59e0b",
  },
  green: {
    dot: "#10b981",
    bg: "#dcfce7",
    text: "#166534",
    border: "#bbf7d0",
    bar: "#10b981",
  },
  blue: {
    dot: "#0ea5e9",
    bg: "#dbeafe",
    text: "#1e40af",
    border: "#bfdbfe",
    bar: "#0ea5e9",
  },
};

function TimelinePreview() {
  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--outline)]">
            Up next
          </div>
          <div className="mt-1 text-2xl font-black tracking-tight text-[var(--on-surface)]">
            Stanford SOP · in <span className="text-[var(--primary)]">12 days</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-[10px] font-extrabold text-white shadow-[0_2px_0_0_var(--primary-fixed-dim)]"
        >
          Open application
        </button>
      </div>
      <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h5 className="m-0 text-xs font-extrabold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
            December 2026
          </h5>
          <div className="flex gap-1 text-[var(--outline)]">
            <Icon name="chevron_left" size={18} />
            <Icon name="chevron_right" size={18} />
          </div>
        </div>
        <ul className="space-y-3">
          <TimelineRow
            day="Dec 1"
            school="Stanford"
            program="MS Computer Science"
            tone="amber"
            urgency="Due in 12 days"
          />
          <TimelineRow
            day="Dec 5"
            school="Berkeley"
            program="EECS PhD"
            tone="primary"
            urgency="Due in 16 days"
          />
          <TimelineRow
            day="Dec 15"
            school="Carnegie Mellon"
            program="Robotics Institute"
            tone="primary"
            urgency="Due in 26 days"
          />
          <TimelineRow
            day="Dec 31"
            school="ETH Zurich"
            program="MSc Robotics"
            tone="muted"
            urgency="Due in 42 days"
          />
        </ul>
      </div>
    </div>
  );
}

function TimelineRow({
  day,
  school,
  program,
  tone,
  urgency,
}: {
  day: string;
  school: string;
  program: string;
  tone: "amber" | "primary" | "muted";
  urgency: string;
}) {
  const accent =
    tone === "amber"
      ? "var(--streak-orange)"
      : tone === "primary"
        ? "var(--primary)"
        : "var(--outline)";
  return (
    <li className="flex items-center gap-3 rounded-xl bg-white p-3 transition-colors hover:bg-[var(--primary-fixed)]/40">
      <div
        className="grid h-10 w-12 shrink-0 place-items-center rounded-lg text-[10px] font-black uppercase leading-none text-white"
        style={{ background: accent }}
      >
        {day}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-[var(--on-surface)]">
          {school}
        </div>
        <div className="truncate text-[11px] text-[var(--on-surface-variant)]">
          {program}
        </div>
      </div>
      <div className="text-[10px] font-bold text-[var(--on-surface-variant)]">
        {urgency}
      </div>
    </li>
  );
}

function StudioPreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--outline)]">
            Outreach drafts
          </div>
          <div className="mt-1 text-lg font-black tracking-tight text-[var(--on-surface)]">
            3 active threads
          </div>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-[10px] font-extrabold text-white shadow-[0_2px_0_0_var(--primary-fixed-dim)]"
        >
          <Icon name="auto_awesome" size={14} fill />
          New draft
        </button>
      </div>
      <ThreadRow
        prof="Prof. Chen"
        univ="Stanford · NLP Group"
        snippet="Hi Prof. Chen, I'm a final-year undergrad at IIT Bombay working on multilingual model evaluation…"
        statusTone="amber"
        statusLabel="Drafting"
      />
      <ThreadRow
        prof="Prof. Lopez"
        univ="MIT CSAIL · Robotics"
        snippet="Following up on my note last week — would love 15 minutes to discuss your recent work on grasping…"
        statusTone="blue"
        statusLabel="Sent · awaiting reply"
      />
      <ThreadRow
        prof="Prof. Patel"
        univ="Berkeley EECS"
        snippet="Thanks for the encouraging reply! I'd love to set up a quick call next week if your schedule allows…"
        statusTone="green"
        statusLabel="Reply received"
      />
      <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-4 text-[11px] text-[var(--on-surface-variant)]">
        <div className="flex items-center gap-2 text-[var(--primary)]">
          <Icon name="auto_awesome" size={14} fill />
          <span className="font-extrabold uppercase tracking-[0.08em]">
            AI suggestion
          </span>
        </div>
        <p className="m-0 mt-1.5">
          Mention your published preprint on document grounding — it&apos;s a
          strong fit for Prof. Chen&apos;s recent ACL paper.
        </p>
      </div>
    </div>
  );
}

function ThreadRow({
  prof,
  univ,
  snippet,
  statusTone,
  statusLabel,
}: {
  prof: string;
  univ: string;
  snippet: string;
  statusTone: "amber" | "green" | "blue";
  statusLabel: string;
}) {
  const tone = TONE_STYLES[statusTone];
  return (
    <div className="cursor-pointer rounded-2xl border border-[var(--outline-variant)] bg-white p-4 transition-all hover:translate-x-1 hover:shadow-md">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-bold text-[var(--on-surface)]">
            {prof}
          </span>
          <span className="ml-2 text-xs text-[var(--on-surface-variant)]">
            · {univ}
          </span>
        </div>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em]"
          style={{
            background: tone.bg,
            color: tone.text,
            borderColor: tone.border,
          }}
        >
          {statusLabel}
        </span>
      </div>
      <p className="m-0 line-clamp-2 text-xs leading-relaxed text-[var(--on-surface-variant)]">
        {snippet}
      </p>
    </div>
  );
}

function VaultPreview() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-[var(--outline)]">
            Document library
          </div>
          <div className="mt-1 text-lg font-black tracking-tight text-[var(--on-surface)]">
            12 files · 3 folders
          </div>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-[10px] font-extrabold text-white shadow-[0_2px_0_0_var(--primary-fixed-dim)]"
        >
          <Icon name="cloud_upload" size={14} />
          Upload
        </button>
      </div>
      {/* Storage bar */}
      <div className="mb-4 rounded-xl bg-[var(--surface-container-low)] p-3">
        <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-[var(--on-surface-variant)]">
          <span>Storage</span>
          <span className="tabular-nums">2.4 GB of 5 GB</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-container-high)]">
          <div
            className="h-full rounded-full bg-[var(--primary)]"
            style={{ width: "48%" }}
          />
        </div>
      </div>
      {/* Folder chips */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { label: "All", count: 12, active: true },
          { label: "Stanford", count: 4 },
          { label: "MIT", count: 3 },
          { label: "Shared", count: 2 },
        ].map((f) => (
          <span
            key={f.label}
            className={
              "inline-flex items-center gap-1 rounded-full border-2 px-2.5 py-1 text-[10px] font-extrabold " +
              (f.active
                ? "border-[var(--primary)] bg-[var(--primary-container)]/40 text-[var(--primary)]"
                : "border-[var(--outline-variant)] text-[var(--on-surface-variant)]")
            }
          >
            {f.label}
            <span
              className={
                "rounded-full px-1 text-[9px] " +
                (f.active
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--surface-container)] text-[var(--on-surface-variant)]")
              }
            >
              {f.count}
            </span>
          </span>
        ))}
      </div>
      {/* File grid */}
      <div className="grid grid-cols-3 gap-3">
        <FileTile name="SOP draft v3" type="sop" />
        <FileTile name="CV Oct 2026" type="cv" />
        <FileTile name="Transcript IITB" type="transcript" />
        <FileTile name="GRE Score" type="gre" />
        <FileTile name="Personal stmt" type="sop" />
        <FileTile name="References" type="other" />
      </div>
    </div>
  );
}

function FileTile({
  name,
  type,
}: {
  name: string;
  type: "cv" | "sop" | "transcript" | "gre" | "other";
}) {
  const meta = FILE_META[type];
  return (
    <div
      className="flex cursor-pointer flex-col items-start rounded-xl border border-[var(--outline-variant)] bg-white p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ borderBottom: `3px solid ${meta.accent}` }}
    >
      <div
        className="mb-2 grid h-8 w-8 place-items-center rounded-lg"
        style={{ background: meta.bg, color: meta.accent }}
      >
        <Icon name={meta.icon} size={16} />
      </div>
      <div className="text-[11px] font-bold leading-tight text-[var(--on-surface)]">
        {name}
      </div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--outline)]">
        {meta.label}
      </div>
    </div>
  );
}

const FILE_META: Record<
  "cv" | "sop" | "transcript" | "gre" | "other",
  { icon: string; label: string; bg: string; accent: string }
> = {
  cv: {
    icon: "description",
    label: "CV",
    bg: "rgba(0,98,157,0.08)",
    accent: "var(--primary)",
  },
  sop: {
    icon: "edit_note",
    label: "SOP",
    bg: "rgba(43,108,0,0.08)",
    accent: "var(--tertiary)",
  },
  transcript: {
    icon: "school",
    label: "Transcript",
    bg: "rgba(186,26,26,0.08)",
    accent: "var(--error)",
  },
  gre: {
    icon: "calculate",
    label: "GRE",
    bg: "rgba(83,250,194,0.18)",
    accent: "var(--on-secondary-container)",
  },
  other: {
    icon: "draft",
    label: "Other",
    bg: "var(--surface-container-high)",
    accent: "var(--outline)",
  },
};
