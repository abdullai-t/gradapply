import { format } from "date-fns";
import type { AdmissionTerm, Profile } from "@prisma/client";

import { admissionTermLabel } from "@/lib/admission-term";

import { completeOneShotLlm } from "@/lib/ai";
import { COUNTRY_OPTIONS } from "@/lib/country-options";
import { DEGREE_OPTIONS, PROGRAM_OPTIONS } from "@/lib/grad-options";

function stripJsonFence(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  const withoutOpen = t.replace(/^```(?:json)?\s*\n?/i, "");
  const end = withoutOpen.lastIndexOf("```");
  if (end === -1) return withoutOpen.trim();
  return withoutOpen.slice(0, end).trim();
}

function snapToCurated(raw: string, curated: readonly string[]): string {
  const t = raw.trim();
  if (!t) return "Other";
  const lower = t.toLowerCase();
  const exact = curated.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const loose = curated.find(
    (c) =>
      c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()),
  );
  if (loose) return loose;
  return "Other";
}

function snapCountry(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const lower = t.toLowerCase();
  const exact = COUNTRY_OPTIONS.find((c) => c.toLowerCase() === lower);
  if (exact) return exact;
  const loose = COUNTRY_OPTIONS.find(
    (c) =>
      c.toLowerCase().includes(lower) ||
      lower.includes(c.toLowerCase()) ||
      lower.replace(/\./g, "") === c.toLowerCase().replace(/\./g, ""),
  );
  return loose ?? t;
}

/** Normalize AI deadline to `YYYY-MM-DD` for `<input type="date">`. */
function deadlineToDateInput(value: unknown): string {
  if (value == null || value === "") return "";
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return "";

  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) return format(parsed, "yyyy-MM-dd");

  return "";
}

function applicantBlock(profile: Profile | null | undefined): string {
  if (!profile) return "Applicant profile: not filled in — infer generically.";
  return [
    "Applicant profile (align program/degree with these when reasonable):",
    profile.targetDegree && `Target degree: ${profile.targetDegree}`,
    profile.focusArea && `Focus area: ${profile.focusArea}`,
    profile.researchInterests &&
      `Research interests (prefer matching department/program): ${profile.researchInterests}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export type InferredSchoolFields = {
  program: string;
  degree: string;
  country: string;
  deadline: string;
  funding: string;
  notes: string;
  portalUrl: string;
};

/**
 * Infer program, deadline, portal URL, etc. from a school / university name using Claude.
 * Values are best-effort from model knowledge; user should verify deadlines and URLs.
 */
export async function inferSchoolDetailsFromName({
  schoolName,
  term,
  profile,
  userId,
}: {
  schoolName: string;
  /** When set, deadlines and cycle notes target this intake (Fall / Spring / Summer). */
  term?: AdmissionTerm | null;
  profile?: Profile | null;
  userId?: string;
}): Promise<InferredSchoolFields> {
  const name = schoolName.trim();
  if (!name) throw new Error("School name is required");

  const programList = PROGRAM_OPTIONS.join(", ");
  const degreeList = DEGREE_OPTIONS.join(", ");

  const termLine = term
    ? `The applicant selected intake term: ${admissionTermLabel(term)}. Infer the application deadline and any cycle-specific notes for that intake (typical Fall vs Spring vs Summer start). If the institution does not offer that term, say so briefly in notes and still suggest the closest typical option.`
    : "Intake term was not specified — infer the next typical application cycle for this institution based on today's date.";

  const userMessage = [
    userId
      ? "Applicant background is in the system context above (profile + documents when available)."
      : applicantBlock(profile),
    "",
    `Today's date (for inferring the next relevant application cycle): ${format(new Date(), "yyyy-MM-dd")}.`,
    "",
    `Graduate program / institution as entered by the applicant: "${name}".`,
    "",
    termLine,
    "",
    "Infer practical application-tracking fields for this institution. Use well-known facts only.",
    "Application deadlines vary by program and year — give your best estimate for the applicant's target degree when possible, otherwise null.",
    "If you are unsure of an exact deadline, set deadline to null and explain in notes.",
    "Never invent a portal URL; only include portalUrl if you are confident of the official graduate admissions or program application URL. Otherwise null.",
    "",
    `program MUST be exactly one of these strings: ${programList}`,
    `degree MUST be exactly one of these strings: ${degreeList}`,
    "country: standard English country name where the main campus for this application is located, or null.",
    'deadline: primary application deadline as ISO date "YYYY-MM-DD" in local terms for that country, or null.',
    "funding: short free-text note about typical funding if known (one line), or null.",
    "notes: brief caveats (deadlines approximate, verify on official site), or null.",
    "portalUrl: official graduate admissions or program apply URL, or null.",
    "",
    "Respond with ONLY valid JSON (no markdown fences) with keys:",
    "program (string), degree (string), country (string|null), deadline (string|null), funding (string|null), notes (string|null), portalUrl (string|null).",
  ].join("\n");

  const raw =
    (
      await completeOneShotLlm({
        system:
          "You help graduate applicants organize school lists. Output strictly valid JSON. Prefer null over guessing URLs or precise deadlines you do not know.",
        user: userMessage,
        maxTokens: 2048,
        userId,
      })
    ).trim() || "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
  } catch {
    throw new Error("AI returned invalid JSON. Try again or fill fields manually.");
  }

  const programRaw =
    typeof parsed.program === "string" ? parsed.program : "Other";
  const degreeRaw =
    typeof parsed.degree === "string" ? parsed.degree : "Other";

  const program = snapToCurated(programRaw, PROGRAM_OPTIONS);
  const degree = snapToCurated(degreeRaw, DEGREE_OPTIONS);

  let country = "";
  if (parsed.country != null && parsed.country !== "") {
    country = snapCountry(String(parsed.country));
  }

  const deadline = deadlineToDateInput(parsed.deadline);

  const funding =
    typeof parsed.funding === "string" ? parsed.funding.trim() : "";
  const notes = typeof parsed.notes === "string" ? parsed.notes.trim() : "";
  let portalUrl =
    typeof parsed.portalUrl === "string" ? parsed.portalUrl.trim() : "";
  if (portalUrl && !/^https?:\/\//i.test(portalUrl)) portalUrl = "";

  return {
    program,
    degree,
    country,
    deadline,
    funding,
    notes,
    portalUrl,
  };
}
