import type { Profile } from "@prisma/client";

import { completeOneShotLlm } from "@/lib/ai";
import { COUNTRY_OPTIONS } from "@/lib/country-options";
import { DEGREE_OPTIONS, PROGRAM_OPTIONS } from "@/lib/grad-options";

type RecommendedSchoolRaw = {
  name?: unknown;
  program?: unknown;
  degree?: unknown;
  country?: unknown;
  whyFit?: unknown;
  notes?: unknown;
  portalUrl?: unknown;
};

export type RecommendedSchool = {
  name: string;
  program: string;
  degree: string;
  country: string;
  whyFit: string;
  notes: string;
  portalUrl: string;
};

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

function snapCountry(raw: unknown): string {
  const t = typeof raw === "string" ? raw.trim() : "";
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

function profileSummary(profile: Profile | null): string {
  if (!profile) return "Profile is missing. Infer broadly from common graduate pathways.";
  return [
    "Applicant profile snapshot:",
    profile.targetDegree && `- Target degree: ${profile.targetDegree}`,
    profile.focusArea && `- Focus area: ${profile.focusArea}`,
    profile.researchInterests && `- Research interests: ${profile.researchInterests}`,
    profile.countriesOfInterest.length > 0 &&
      `- Countries of interest: ${profile.countriesOfInterest.join(", ")}`,
    profile.undergradSchool && `- Undergrad school: ${profile.undergradSchool}`,
    profile.undergradDegree && `- Undergrad degree: ${profile.undergradDegree}`,
    profile.yearsExperience && `- Experience: ${profile.yearsExperience}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function recommendSchoolsFromProfile({
  profile,
  existingSchoolNames,
  userId,
}: {
  profile: Profile | null;
  existingSchoolNames: string[];
  userId: string;
}): Promise<RecommendedSchool[]> {
  const normalizedExisting = existingSchoolNames
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  const preferredCountries = (profile?.countriesOfInterest ?? []).filter(Boolean);

  const raw = await completeOneShotLlm({
    system:
      "You recommend graduate schools for applicants. Return only strict JSON. Keep recommendations practical and diverse.",
    user: [
      "Recommend 8 graduate schools this applicant can add to a tracking list.",
      profileSummary(profile),
      "",
      preferredCountries.length > 0
        ? `Only suggest schools in these countries: ${preferredCountries.join(", ")}.`
        : "Country is flexible; include a reasonable geographic mix.",
      "",
      `Do not include schools already in this list: ${normalizedExisting.join(", ") || "(none)"}`,
      "",
      `program must be exactly one of: ${PROGRAM_OPTIONS.join(", ")}`,
      `degree must be exactly one of: ${DEGREE_OPTIONS.join(", ")}`,
      "country should be a plain English country name or null.",
      "whyFit should be one concise sentence grounded in the profile.",
      "notes should be brief and practical (e.g. application competitiveness).",
      "portalUrl should be official admissions URL when confident, else null.",
      "",
      "Return ONLY valid JSON with shape:",
      '{ "schools": [{ "name": string, "program": string, "degree": string, "country": string|null, "whyFit": string, "notes": string|null, "portalUrl": string|null }] }',
    ].join("\n"),
    maxTokens: 3072,
    userId,
    qualityMode: "high",
  });

  let parsed: { schools?: RecommendedSchoolRaw[] } | null = null;
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as { schools?: RecommendedSchoolRaw[] };
  } catch {
    throw new Error("AI returned invalid JSON. Please try again.");
  }

  const rows = Array.isArray(parsed?.schools) ? parsed!.schools : [];
  const deduped = new Map<string, RecommendedSchool>();
  const allowedCountries = new Set(preferredCountries.map((c) => c.toLowerCase()));
  for (const row of rows) {
    const name = typeof row.name === "string" ? row.name.trim() : "";
    if (!name) continue;
    const key = name.toLowerCase();
    if (normalizedExisting.includes(key) || deduped.has(key)) continue;

    const program = snapToCurated(
      typeof row.program === "string" ? row.program : "Other",
      PROGRAM_OPTIONS,
    );
    const degree = snapToCurated(
      typeof row.degree === "string" ? row.degree : "Other",
      DEGREE_OPTIONS,
    );
    const country = snapCountry(row.country);
    if (
      allowedCountries.size > 0 &&
      (!country || !allowedCountries.has(country.toLowerCase()))
    ) {
      continue;
    }
    const whyFit =
      typeof row.whyFit === "string" && row.whyFit.trim()
        ? row.whyFit.trim()
        : "Potential fit based on your profile goals and interests.";
    const notes =
      typeof row.notes === "string" ? row.notes.trim() : "";
    let portalUrl = typeof row.portalUrl === "string" ? row.portalUrl.trim() : "";
    if (portalUrl && !/^https?:\/\//i.test(portalUrl)) portalUrl = "";

    deduped.set(key, {
      name,
      program,
      degree,
      country,
      whyFit,
      notes,
      portalUrl,
    });
  }

  return Array.from(deduped.values()).slice(0, 8);
}
