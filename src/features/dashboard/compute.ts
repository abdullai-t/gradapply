import { differenceInCalendarDays, format, formatDistanceStrict } from "date-fns";
import { SchoolStatus } from "@prisma/client";

import type { DocStatus } from "./doc-status-grid";
import type { RecSchool } from "./rec-school-grid";

/**
 * dossierCompleteness — heuristic 0..100 based on profile fields, school
 * count, and document count. Mirrors the previous v1 calculation so the
 * "%" stays stable across the migration.
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

export function firstName(name: string | null | undefined): string {
  if (!name?.trim()) return "there";
  return name.trim().split(/\s+/)[0] ?? "there";
}

/**
 * Pick the next "daily mission" from the user's state.
 * Priority: nearest-deadline open application → empty profile → empty schools.
 */
export function pickDailyMission(args: {
  upcoming: { id: string; name: string; deadline: Date | null }[];
  profile: { researchInterests: string | null; bio: string | null } | null;
  schoolCount: number;
  documentCount: number;
}): { title: string; body: string; href: string; cta?: string } {
  const next = args.upcoming.find((s) => s.deadline);
  if (next?.deadline) {
    const days = differenceInCalendarDays(next.deadline, new Date());
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

  return {
    title: "Tighten one paragraph in your SOP",
    body: "Open your latest draft and rewrite the strongest paragraph one notch sharper. That's today's win.",
    href: "/emails",
    cta: "Open drafts",
  };
}

/**
 * Build the three "Application Documents" cards from the latest documents
 * + nearest deadline. Falls back to encouraging copy when nothing exists.
 */
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

/**
 * Build the "Recommended schools" rail from the user's saved set.
 * Score is a stable hash-based heuristic for now; will use real
 * recommendation match in a follow-up.
 */
export function buildRecSchools(
  schools: {
    id: string;
    name: string;
    program: string;
    deadline: Date | null;
    status: SchoolStatus;
  }[],
): RecSchool[] {
  return schools.slice(0, 3).map((s, i) => {
    // Deterministic 75–98 score from name hash (placeholder until real fit calc).
    let h = 0;
    for (const ch of s.name) h = (h * 31 + ch.charCodeAt(0)) | 0;
    const score = 75 + (Math.abs(h) % 24);
    const tone: RecSchool["tone"] =
      i === 0 ? "tertiary" : i === 1 ? "primary" : "secondary";
    const tag = i === 0 ? "Top pick" : i === 1 ? "Strong fit" : "Solid match";
    const deadline = s.deadline
      ? format(s.deadline, "MMM d")
      : "No deadline";
    return {
      id: s.id,
      name: s.name,
      program: s.program,
      score,
      tone,
      tag,
      deadline,
    };
  });
}

/**
 * Compute a derived streak: today counts if the user has activity today.
 * For v1 (no UserActivityDay model yet) we approximate with the school
 * `updatedAt`/`reminderAt` dates. Returns `streakDays` and a `weekActivity`
 * bitmap (Sun..Sat indexed).
 */
export function computeDerivedStreak(args: {
  recentActivityDates: Date[];
}): { streakDays: number; weekActivity: boolean[]; todayIndex: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayIndex = today.getDay();

  // Day-of-week bitmap for the last 7 days (Sun..Sat).
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

  // Streak = consecutive days ending today (or yesterday if no activity today).
  let streak = 0;
  for (let offset = 0; offset < 365; offset++) {
    const probe = new Date(today);
    probe.setDate(today.getDate() - offset);
    const key = probe.toISOString().slice(0, 10);
    if (seen.has(key)) {
      streak++;
    } else if (offset === 0) {
      // Allow "yesterday only" to still count as a 1-day streak.
      continue;
    } else {
      break;
    }
  }

  return { streakDays: streak, weekActivity: week, todayIndex };
}
