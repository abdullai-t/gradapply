import type { Profile } from "@prisma/client";

import { completeOneShotLlm } from "@/lib/ai";

export type FacultyDiscoverySchool = {
  id: string;
  name: string;
  program: string;
  degree: string;
  country: string | null;
};

export type FacultyDiscoveryCandidate = {
  name: string;
  profileUrl: string | null;
  profEmail: string | null;
  researchArea: string | null;
  schoolId: string | null;
  targetSchoolLabel: string | null;
  matchScore: number;
  rationale: string;
  source: "page_link" | "page_text" | "school_program";
};

function stripJsonFence(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  const withoutOpen = t.replace(/^```(?:json)?\s*\n?/i, "");
  const end = withoutOpen.lastIndexOf("```");
  if (end === -1) return withoutOpen.trim();
  return withoutOpen.slice(0, end).trim();
}

function applicantBlock(profile: Profile | null | undefined): string {
  if (!profile) {
    return "Applicant profile: incomplete — still use page links and school list to propose plausible matches by research fit.";
  }
  return [
    "Applicant profile:",
    profile.targetDegree && `Target degree: ${profile.targetDegree}`,
    profile.focusArea && `Focus area: ${profile.focusArea}`,
    profile.researchInterests &&
      `Research interests (primary matching signal): ${profile.researchInterests}`,
    profile.bio && `Bio: ${profile.bio.slice(0, 600)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeCandidate(
  raw: Record<string, unknown>,
  allowedSchoolIds: Set<string>,
  allowedProfileUrls: Set<string>,
): FacultyDiscoveryCandidate | null {
  const name =
    typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : null;
  if (!name) return null;

  const schoolProgramSource = raw.source === "school_program";

  let profileUrl: string | null =
    raw.profileUrl === null || raw.profileUrl === undefined
      ? null
      : typeof raw.profileUrl === "string"
        ? raw.profileUrl.trim() || null
        : null;
  if (schoolProgramSource) profileUrl = null;
  else if (profileUrl && !allowedProfileUrls.has(profileUrl)) profileUrl = null;

  let profEmail =
    raw.profEmail === null || raw.profEmail === undefined
      ? null
      : typeof raw.profEmail === "string"
        ? raw.profEmail.trim() || null
        : null;
  if (schoolProgramSource) profEmail = null;

  const researchArea =
    typeof raw.researchArea === "string" && raw.researchArea.trim()
      ? raw.researchArea.trim().slice(0, 500)
      : null;

  let schoolId: string | null =
    typeof raw.schoolId === "string" && raw.schoolId.trim()
      ? raw.schoolId.trim()
      : null;
  if (schoolId && !allowedSchoolIds.has(schoolId)) schoolId = null;

  const targetSchoolLabel =
    typeof raw.targetSchoolLabel === "string" && raw.targetSchoolLabel.trim()
      ? raw.targetSchoolLabel.trim().slice(0, 200)
      : null;

  let matchScore = Number(raw.matchScore);
  if (!Number.isFinite(matchScore)) matchScore = 3;
  matchScore = Math.min(5, Math.max(1, Math.round(matchScore)));

  const rationale =
    typeof raw.rationale === "string" && raw.rationale.trim()
      ? raw.rationale.trim().slice(0, 400)
      : "Match suggested from page context.";

  const source: FacultyDiscoveryCandidate["source"] = schoolProgramSource
    ? "school_program"
    : raw.source === "page_link" || raw.source === "page_text"
      ? raw.source
      : profileUrl
        ? "page_link"
        : "page_text";

  return {
    name,
    profileUrl,
    profEmail,
    researchArea,
    schoolId,
    targetSchoolLabel,
    matchScore,
    rationale,
    source,
  };
}

/**
 * Uses faculty page text + extracted same-site links + applicant schools to propose
 * research-aligned outreach targets. Profile URLs must come from provided links only.
 */
export async function discoverFacultyMatches(opts: {
  profile: Profile | null;
  profilePageUrl: string;
  profilePageText: string;
  links: { url: string; label: string }[];
  schools: FacultyDiscoverySchool[];
  userId: string;
}): Promise<{ candidates: FacultyDiscoveryCandidate[]; advisory: string | null }> {
  const allowedSchoolIds = new Set(opts.schools.map((s) => s.id));
  const allowedProfileUrls = new Set(opts.links.map((l) => l.url));

  const schoolLines = opts.schools.map(
    (s) =>
      `- id="${s.id}" | ${s.name} · ${s.program} · ${s.degree}${s.country ? ` (${s.country})` : ""}`,
  );

  const linkLines = opts.links.slice(0, 55).map((l, i) => `${i + 1}. ${l.label} → ${l.url}`);

  const userMessage = [
    applicantBlock(opts.profile),
    "",
    "## Faculty / department page URL",
    opts.profilePageUrl,
    "",
    "## Plain text extracted from that page",
    opts.profilePageText.trim().slice(0, 95_000),
    "",
    "## Applicant target programs (map candidates using school id when institution + program fit)",
    schoolLines.join("\n"),
    "",
    "## Same-site hyperlinks extracted from the HTML (profileUrl for a candidate MUST be copied exactly from this list, or null)",
    linkLines.length > 0
      ? linkLines.join("\n")
      : "(No same-site links found — use page_text source only; profileUrl must be null.)",
    "",
    "Tasks:",
    "1) Identify professors or research faculty **evidenced** on the page (names in text, directory tables, or link labels) whose research aligns with the applicant's interests AND with at least one selected school when the institution or department on the page matches that school.",
    "2) For each candidate, set schoolId to one of the ids listed above **only** when the page clearly relates to that institution/program pairing; otherwise schoolId null and set targetSchoolLabel to the best-matching school line text.",
    "3) **Never invent** profileUrl — use only URLs from the numbered link list, or null.",
    "4) **Never invent** email addresses — profEmail null unless an email appears verbatim in the page text (you may copy it).",
    "5) source: page_link if profileUrl is set; otherwise page_text.",
    "6) Return ONLY valid JSON: { \"advisory\": string|null, \"candidates\": [ { \"name\", \"profileUrl\", \"profEmail\", \"researchArea\", \"schoolId\", \"targetSchoolLabel\", \"matchScore\" (1-5), \"rationale\", \"source\" } ] }",
    "   Limit to at most 12 candidates, sorted by matchScore descending.",
  ].join("\n");

  const raw = (
    await completeOneShotLlm({
      system:
        "You help graduate applicants find faculty for cold outreach. Be conservative: do not invent people, labs, or URLs. Every factual URL must appear in the provided link list. Output JSON only.",
      user: userMessage,
      maxTokens: 4096,
      userId: opts.userId,
    })
  ).trim();

  let parsed: {
    advisory?: unknown;
    candidates?: unknown;
  };
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as {
      advisory?: unknown;
      candidates?: unknown;
    };
  } catch {
    throw new Error("AI returned invalid JSON. Try a faculty directory URL or another page.");
  }

  const advisory =
    typeof parsed.advisory === "string" && parsed.advisory.trim()
      ? parsed.advisory.trim().slice(0, 800)
      : null;

  const list = Array.isArray(parsed.candidates) ? parsed.candidates : [];
  const candidates: FacultyDiscoveryCandidate[] = [];

  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const row = normalizeCandidate(
      item as Record<string, unknown>,
      allowedSchoolIds,
      allowedProfileUrls,
    );
    if (row) candidates.push(row);
  }

  candidates.sort((a, b) => b.matchScore - a.matchScore);

  return {
    candidates: candidates.slice(0, 12),
    advisory,
  };
}

/**
 * Suggests faculty aligned with the applicant profile for each selected school/program,
 * without fetching a seed URL. Names must be verified on official directories — no profile URLs.
 */
export async function discoverFacultyFromSchoolPrograms(opts: {
  profile: Profile | null;
  schools: FacultyDiscoverySchool[];
  userId: string;
}): Promise<{ candidates: FacultyDiscoveryCandidate[]; advisory: string | null }> {
  const allowedSchoolIds = new Set(opts.schools.map((s) => s.id));
  const emptyLinks = new Set<string>();

  const schoolLines = opts.schools.map(
    (s) =>
      `- id="${s.id}" | ${s.name} · ${s.program} · ${s.degree}${s.country ? ` (${s.country})` : ""}`,
  );

  const userMessage = [
    applicantBlock(opts.profile),
    "",
    "## Applicant target programs",
    "Each candidate must map to exactly one school id from this list when possible:",
    schoolLines.join("\n"),
    "",
    "Tasks:",
    "1) For each program above, suggest faculty or research professors whose published work plausibly aligns with the applicant's stated research interests.",
    "2) Draw only on broad public knowledge (what a careful applicant could infer from department reputation and research areas). If you are uncertain someone is in that department or active there, omit them.",
    "3) **profileUrl must be null for every candidate** — you are not loading live web pages.",
    "4) **profEmail must be null for every candidate** — never invent emails.",
    '5) **source must be \"school_program\" for every candidate.',
    "6) Prefer diversity across schools when multiple programs are selected; cap at **15 candidates total**, sorted by matchScore descending.",
    '7) In \"advisory\", remind the user to verify every name and affiliation on the official university directory before emailing.',
    '8) Return ONLY valid JSON: { \"advisory\": string|null, \"candidates\": [ { \"name\", \"profileUrl\", \"profEmail\", \"researchArea\", \"schoolId\", \"targetSchoolLabel\", \"matchScore\" (1-5), \"rationale\", \"source\" } ] }',
  ].join("\n");

  const raw = (
    await completeOneShotLlm({
      system:
        "You help graduate applicants identify faculty to contact. You must not invent contact details. Output JSON only. Every suggested person must be attributed to the correct school id when possible.",
      user: userMessage,
      maxTokens: 4096,
      userId: opts.userId,
    })
  ).trim();

  let parsed: {
    advisory?: unknown;
    candidates?: unknown;
  };
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as {
      advisory?: unknown;
      candidates?: unknown;
    };
  } catch {
    throw new Error(
      "AI returned invalid JSON. Try again or add detail to your profile research interests.",
    );
  }

  const advisory =
    typeof parsed.advisory === "string" && parsed.advisory.trim()
      ? parsed.advisory.trim().slice(0, 800)
      : null;

  const list = Array.isArray(parsed.candidates) ? parsed.candidates : [];
  const candidates: FacultyDiscoveryCandidate[] = [];

  for (const item of list) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as Record<string, unknown>;
    if (row.source !== "school_program") row.source = "school_program";
    const normalized = normalizeCandidate(row, allowedSchoolIds, emptyLinks);
    if (normalized) candidates.push(normalized);
  }

  candidates.sort((a, b) => b.matchScore - a.matchScore);

  return {
    candidates: candidates.slice(0, 15),
    advisory,
  };
}
