import { differenceInCalendarDays, format, formatDistanceStrict } from "date-fns";
import { SchoolStatus } from "@prisma/client";

import {
  lettersProgress,
  materialsProgress,
  normalizeLetterRecommenders,
  normalizeRequiredMaterials,
} from "@/lib/school-tracker-defaults";

import type { DocStatus } from "./doc-status-grid";
import type { FocusSchool } from "./focus-school-grid";

export type DossierGap = {
  label: string;
  href: string;
  done: boolean;
};

export type DashboardUrgent =
  | {
      kind: "reminder";
      schoolId: string;
      schoolName: string;
      dateIso: string;
      note: string | null;
      overdue: boolean;
    }
  | {
      kind: "deadline";
      schoolId: string;
      schoolName: string;
      dateIso: string;
      overdue: boolean;
    };

export type UpcomingDeadlineRow = {
  id: string;
  name: string;
  program: string;
  deadline: Date;
  daysUntil: number;
  status: SchoolStatus;
  overdue: boolean;
};

/**
 * dossierCompleteness — heuristic 0..100 based on profile fields, school
 * count, and document count.
 */
export function dossierCompleteness(args: {
  profile: {
    targetDegree: string | null;
    focusArea: string | null;
    researchInterests: string | null;
    bio: string | null;
  } | null;
  schoolCount: number;
  documentCount: number;
}): number {
  let points = 0;
  const total = 6;
  const p = args.profile;
  if (p?.targetDegree?.trim()) points++;
  if (p?.focusArea?.trim() || p?.researchInterests?.trim()) points++;
  if (p?.bio?.trim()) points++;
  if (args.schoolCount > 0) points++;
  if (args.documentCount > 0) points++;
  if (args.schoolCount >= 3) points++;
  return Math.min(100, Math.round((points / total) * 100));
}

/** Actionable gaps aligned with dossierCompleteness scoring. */
export function buildDossierGaps(args: {
  profile: {
    targetDegree: string | null;
    focusArea: string | null;
    researchInterests: string | null;
    bio: string | null;
  } | null;
  schoolCount: number;
  documentCount: number;
}): DossierGap[] {
  const p = args.profile;
  return [
    {
      label: "Target degree",
      href: "/profile",
      done: Boolean(p?.targetDegree?.trim()),
    },
    {
      label: "Research focus",
      href: "/profile",
      done: Boolean(p?.focusArea?.trim() || p?.researchInterests?.trim()),
    },
    {
      label: "Short bio",
      href: "/profile",
      done: Boolean(p?.bio?.trim()),
    },
    {
      label: "School shortlist",
      href: "/schools",
      done: args.schoolCount > 0,
    },
    {
      label: "3+ schools",
      href: "/schools",
      done: args.schoolCount >= 3,
    },
    {
      label: "Upload a document",
      href: "/documents",
      done: args.documentCount > 0,
    },
  ];
}

export function firstName(name: string | null | undefined): string {
  if (!name?.trim()) return "there";
  return name.trim().split(/\s+/)[0] ?? "there";
}

const ACTIVE_STATUSES: SchoolStatus[] = [
  SchoolStatus.PLANNING,
  SchoolStatus.APPLIED,
  SchoolStatus.WAITING,
];

type SchoolForMission = {
  id: string;
  name: string;
  deadline: Date | null;
  requiredMaterials: unknown;
};

/**
 * Pick the next "daily mission" from the user's state.
 */
export function pickDailyMission(args: {
  upcoming: { id: string; name: string; deadline: Date | null }[];
  schools: SchoolForMission[];
  profile: { researchInterests: string | null; bio: string | null } | null;
  schoolCount: number;
  documentCount: number;
  sopSchoolId?: string | null;
}): { title: string; body: string; href: string; cta?: string } {
  const now = new Date();

  for (const s of args.schools) {
    if (!s.deadline) continue;
    const days = differenceInCalendarDays(s.deadline, now);
    if (days < 0 || days > 14) continue;
    const mats = normalizeRequiredMaterials(s.requiredMaterials);
    const prog = materialsProgress(mats);
    if (prog.total > 0 && prog.done < prog.total) {
      return {
        title: `Finish materials for ${s.name}`,
        body: `${prog.done} of ${prog.total} checklist items done — deadline in ${days === 0 ? "less than a day" : `${days} day${days === 1 ? "" : "s"}`}.`,
        href: `/schools/${s.id}`,
        cta: "Open tracker",
      };
    }
  }

  const next = args.upcoming.find((s) => s.deadline);
  if (next?.deadline) {
    const days = differenceInCalendarDays(next.deadline, now);
    if (days >= 0 && days <= 30) {
      return {
        title: `Refine your application for ${next.name}`,
        body: `Deadline is in ${days === 0 ? "less than a day" : `${days} day${days === 1 ? "" : "s"}`}. Make today's edit your highest-leverage one.`,
        href: `/schools/${next.id}`,
        cta: "Open application",
      };
    }
  }

  if (!args.profile?.researchInterests?.trim()) {
    return {
      title: "Add your research interests",
      body: "Your AI assistant tailors outreach and essays around these. Two minutes here pays compounding dividends.",
      href: "/profile",
      cta: "Open profile",
    };
  }

  if (!args.profile?.bio?.trim()) {
    return {
      title: "Write a one-paragraph bio",
      body: "A crisp bio makes every email draft and SOP feel sharper. Keep it three sentences max.",
      href: "/profile",
      cta: "Open profile",
    };
  }

  if (args.schoolCount === 0) {
    return {
      title: "Build your shortlist",
      body: "Add three schools you're considering — your dossier becomes useful the moment your list does.",
      href: "/schools",
      cta: "Add schools",
    };
  }

  if (args.documentCount === 0) {
    return {
      title: "Upload your CV",
      body: "Drop in a CV and the assistant can use it as context for every draft going forward.",
      href: "/documents",
      cta: "Upload document",
    };
  }

  const sopHref = args.sopSchoolId
    ? `/assistant?mode=sop&schoolId=${args.sopSchoolId}`
    : "/assistant?mode=sop";

  return {
    title: "Tighten one paragraph in your SOP",
    body: "Open your latest draft and rewrite the strongest paragraph one notch sharper. That's today's win.",
    href: sopHref,
    cta: "Open SOP studio",
  };
}

export function buildDocStatusItems(args: {
  documents: { type: string; name: string; createdAt: Date }[];
  upcoming: { id: string; name: string; deadline: Date | null }[];
}): DocStatus[] {
  const docs = args.documents;
  const sopDoc = docs.find((d) => d.type === "sop_draft");
  const cvDoc = docs.find((d) => d.type === "cv");
  const transcriptDoc = docs.find((d) => d.type === "transcript");

  const nextDeadlineSchool = args.upcoming.find((s) => s.deadline);

  return [
    {
      icon: "article",
      tone: sopDoc ? "primary" : "destructive",
      status: sopDoc ? "In progress" : "Action needed",
      title: "Statement of purpose",
      body: sopDoc
        ? `Last edited ${formatDistanceStrict(sopDoc.createdAt, new Date(), { addSuffix: true })}. Keep going.`
        : "Upload a draft so the assistant can help you tighten it.",
      cta: sopDoc ? "Continue editing" : "Upload draft",
      ctaIcon: "arrow_forward",
      href: "/documents",
      showBlinkDot: !sopDoc,
    },
    {
      icon: "task",
      tone: transcriptDoc ? "tertiary" : "destructive",
      status: transcriptDoc ? "Ready" : "Action needed",
      title: "Transcripts",
      body:
        transcriptDoc
          ? "On file."
          : nextDeadlineSchool
            ? `Required for ${nextDeadlineSchool.name} and others — get it on file.`
            : "Upload official transcripts so they're ready for any program.",
      cta: transcriptDoc ? "View document" : "Upload transcript",
      ctaIcon: transcriptDoc ? "visibility" : "upload",
      href: "/documents",
      showBlinkDot: !transcriptDoc,
    },
    {
      icon: "group",
      tone: "tertiary",
      status: cvDoc ? "Ready" : "Pending",
      title: "CV / Letters",
      body: cvDoc
        ? "CV on file. Letters of rec land here as recommenders submit."
        : "Drop in your CV and start a list of recommenders.",
      cta: cvDoc ? "View" : "Upload CV",
      ctaIcon: cvDoc ? "visibility" : "upload",
      href: "/documents",
    },
  ];
}

function deadlineUrgency(deadline: Date | null): {
  chip: string | null;
  tone: FocusSchool["urgencyTone"];
} {
  if (!deadline) return { chip: null, tone: "neutral" };
  const days = differenceInCalendarDays(deadline, new Date());
  if (days < 0) return { chip: "Overdue", tone: "destructive" };
  if (days === 0) return { chip: "Due today", tone: "destructive" };
  if (days <= 14) return { chip: `Due in ${days}d`, tone: "warning" };
  return { chip: format(deadline, "MMM d"), tone: "neutral" };
}

type SchoolForFocus = {
  id: string;
  name: string;
  program: string;
  deadline: Date | null;
  status: SchoolStatus;
  requiredMaterials: unknown;
};

/** Top schools to focus on — sorted by nearest deadline, no fake match scores. */
export function buildFocusSchools(schools: SchoolForFocus[]): FocusSchool[] {
  const sorted = [...schools].sort((a, b) => {
    if (a.deadline && b.deadline) {
      return a.deadline.getTime() - b.deadline.getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  return sorted.slice(0, 3).map((s) => {
    const mats = normalizeRequiredMaterials(s.requiredMaterials);
    const prog = materialsProgress(mats);
    const { chip, tone } = deadlineUrgency(s.deadline);
    return {
      id: s.id,
      name: s.name,
      program: s.program,
      status: s.status,
      statusLabel: s.status.replaceAll("_", " "),
      deadlineLabel: s.deadline ? format(s.deadline, "MMM d, yyyy") : "No deadline",
      urgencyChip: chip,
      urgencyTone: tone,
      materialsDone: prog.done,
      materialsTotal: prog.total,
    };
  });
}

/** @deprecated Use buildFocusSchools */
export const buildRecSchools = buildFocusSchools;

export function buildUpcomingDeadlineRows(
  schools: {
    id: string;
    name: string;
    program: string;
    deadline: Date | null;
    status: SchoolStatus;
  }[],
  limit = 5,
): UpcomingDeadlineRow[] {
  const now = new Date();
  return schools
    .filter(
      (s): s is typeof s & { deadline: Date } =>
        s.deadline != null &&
        ACTIVE_STATUSES.includes(s.status),
    )
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime())
    .slice(0, limit)
    .map((s) => {
      const daysUntil = differenceInCalendarDays(s.deadline, now);
      return {
        id: s.id,
        name: s.name,
        program: s.program,
        deadline: s.deadline,
        daysUntil,
        status: s.status,
        overdue: daysUntil < 0,
      };
    });
}

export function pickDashboardUrgent(
  schools: {
    id: string;
    name: string;
    status: SchoolStatus;
    deadline: Date | null;
    reminderAt: Date | null;
    reminderNote: string | null;
  }[],
): DashboardUrgent | null {
  const now = Date.now();

  const withReminder = schools
    .filter((s) => s.reminderAt)
    .sort((a, b) => a.reminderAt!.getTime() - b.reminderAt!.getTime());
  if (withReminder.length > 0) {
    const s = withReminder[0]!;
    const at = s.reminderAt!;
    return {
      kind: "reminder",
      schoolId: s.id,
      schoolName: s.name,
      dateIso: at.toISOString(),
      note: s.reminderNote,
      overdue: at.getTime() < now,
    };
  }

  const withDeadline = schools
    .filter(
      (s): s is typeof s & { deadline: Date } =>
        s.deadline != null && ACTIVE_STATUSES.includes(s.status),
    )
    .sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
  if (withDeadline.length > 0) {
    const s = withDeadline[0]!;
    return {
      kind: "deadline",
      schoolId: s.id,
      schoolName: s.name,
      dateIso: s.deadline.toISOString(),
      overdue: s.deadline.getTime() < now,
    };
  }

  return null;
}

export function aggregateTrackerProgress(
  schools: {
    status: SchoolStatus;
    requiredMaterials: unknown;
    letterRecommenders: unknown;
  }[],
): {
  activeCount: number;
  materialsDone: number;
  materialsTotal: number;
  lettersDone: number;
  lettersTotal: number;
} {
  const active = schools.filter((s) => ACTIVE_STATUSES.includes(s.status));
  let materialsDone = 0;
  let materialsTotal = 0;
  let lettersDone = 0;
  let lettersTotal = 0;

  for (const s of active) {
    const m = materialsProgress(
      normalizeRequiredMaterials(s.requiredMaterials),
    );
    const l = lettersProgress(
      normalizeLetterRecommenders(s.letterRecommenders),
    );
    materialsDone += m.done;
    materialsTotal += m.total;
    lettersDone += l.done;
    lettersTotal += l.total;
  }

  return {
    activeCount: active.length,
    materialsDone,
    materialsTotal,
    lettersDone,
    lettersTotal,
  };
}

export function computeDerivedStreak(args: {
  recentActivityDates: Date[];
}): { streakDays: number; weekActivity: boolean[]; todayIndex: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIndex = today.getDay();

  const week: boolean[] = Array(7).fill(false);
  const seen = new Set<string>();
  for (const raw of args.recentActivityDates) {
    if (!raw) continue;
    const d = new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
    const days = differenceInCalendarDays(today, d);
    if (days < 0 || days > 6) continue;
    const idx = (todayIndex - days + 7) % 7;
    week[idx] = true;
    seen.add(d.toISOString().slice(0, 10));
  }

  let streak = 0;
  for (let offset = 0; offset < 365; offset++) {
    const probe = new Date(today);
    probe.setDate(today.getDate() - offset);
    const key = probe.toISOString().slice(0, 10);
    if (seen.has(key)) {
      streak++;
    } else if (offset === 0) {
      continue;
    } else {
      break;
    }
  }

  return { streakDays: streak, weekActivity: week, todayIndex };
}

export function shouldShowUpgradeBanner(args: {
  isFreePlan: boolean;
  schoolCount: number;
  documentCount: number;
  dossierPct: number;
}): boolean {
  if (!args.isFreePlan) return false;
  if (args.schoolCount === 0) return true;
  if (args.documentCount === 0) return true;
  if (args.dossierPct < 50) return true;
  return false;
}

export function gettingStartedItems(args: {
  hasCv: boolean;
  schoolCount: number;
  hasOpenedSop: boolean;
}): { icon: string; label: string; href: string; done: boolean }[] {
  return [
    {
      icon: "upload_file",
      label: "Upload your CV",
      href: "/documents",
      done: args.hasCv,
    },
    {
      icon: "school",
      label: "Open a school hub",
      href: args.schoolCount > 0 ? `/schools` : "/schools",
      done: args.schoolCount > 0,
    },
    {
      icon: "edit_note",
      label: "Try SOP Studio",
      href: "/assistant?mode=sop",
      done: args.hasOpenedSop,
    },
  ];
}
