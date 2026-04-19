import type { Profile } from "@prisma/client";

import { completeOneShotLlm } from "@/lib/ai";

export type OutreachFromPageResult = {
  profName: string;
  profEmail: string | null;
  university: string;
  researchArea: string | null;
  emailSubject: string;
  emailBody: string;
};

function stripJsonFence(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  const withoutOpen = t.replace(/^```(?:json)?\s*\n?/i, "");
  const end = withoutOpen.lastIndexOf("```");
  if (end === -1) return withoutOpen.trim();
  return withoutOpen.slice(0, end).trim();
}

function applicantContext(profile: Profile | null | undefined): string {
  if (!profile) {
    return "Applicant profile: not filled in yet. Ask the applicant to complete Profile (research interests, degree goals). Still extract professor facts from the page only.";
  }
  return [
    "Applicant profile (use especially research interests to explain fit in the email):",
    profile.targetDegree && `Target degree: ${profile.targetDegree}`,
    profile.focusArea && `Focus area: ${profile.focusArea}`,
    profile.researchInterests &&
      `Research interests (prioritize aligning the cold email to these): ${profile.researchInterests}`,
    profile.yearsExperience && `Experience: ${profile.yearsExperience}`,
    profile.undergradSchool && `Undergrad institution: ${profile.undergradSchool}`,
    profile.bio && `Bio / narrative: ${profile.bio}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * One Claude call: infer professor identity from page text + draft a cold email aligned with applicant research interests.
 */
export async function extractProfessorAndDraftFromPage({
  profile,
  profilePageUrl,
  profilePageText,
  userId,
}: {
  profile?: Profile | null;
  profilePageUrl: string;
  profilePageText: string;
  userId?: string;
}): Promise<OutreachFromPageResult> {
  const userMessage = [
    userId
      ? "Applicant background and uploaded documents are in the system context above."
      : applicantContext(profile),
    "",
    `Source faculty page URL: ${profilePageUrl}`,
    "",
    "--- Plain text extracted from that page (may be noisy) ---",
    profilePageText.trim(),
    "--- end ---",
    "",
    "Tasks:",
    "1) Infer the professor's display name, institution, and research themes only from the page text above.",
    "2) If an email address appears on the page, capture it; otherwise use null — never guess or invent an email.",
    "3) Write a concise cold email (graduate admissions context) that connects the applicant's stated research interests to this professor's work where the page supports it.",
    "4) Output ONLY valid JSON (no markdown fences) with keys:",
    'profName (string), profEmail (string|null), university (string), researchArea (string|null, short summary of their work), emailSubject (string), emailBody (string, plain text).',
  ].join("\n");

  const raw =
    (
      await completeOneShotLlm({
        system:
          "You read faculty webpage excerpts and draft polite, specific cold emails for prospective graduate students. Never fabricate contact emails or publications not evidenced in the page text. Keep the email professional and under ~350 words unless the page demands more context. Respond with JSON only.",
        user: userMessage,
        maxTokens: 4096,
        userId,
      })
    ).trim() || "{}";

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(stripJsonFence(raw)) as Record<string, unknown>;
  } catch {
    throw new Error("AI returned invalid JSON. Try another URL or try again.");
  }

  const profName =
    typeof parsed.profName === "string" && parsed.profName.trim()
      ? parsed.profName.trim()
      : "Unknown professor";

  const university =
    typeof parsed.university === "string" && parsed.university.trim()
      ? parsed.university.trim()
      : "Unknown institution";

  const profEmail =
    parsed.profEmail === null || parsed.profEmail === undefined
      ? null
      : typeof parsed.profEmail === "string"
        ? parsed.profEmail.trim() || null
        : null;

  const researchArea =
    parsed.researchArea === null || parsed.researchArea === undefined
      ? null
      : typeof parsed.researchArea === "string"
        ? parsed.researchArea.trim() || null
        : null;

  const emailSubject =
    typeof parsed.emailSubject === "string" && parsed.emailSubject.trim()
      ? parsed.emailSubject.trim()
      : "Prospective graduate student — research alignment";

  const emailBody =
    typeof parsed.emailBody === "string" && parsed.emailBody.trim()
      ? parsed.emailBody.trim()
      : "Please complete this draft from your profile page.";

  return {
    profName,
    profEmail,
    university,
    researchArea,
    emailSubject,
    emailBody,
  };
}
