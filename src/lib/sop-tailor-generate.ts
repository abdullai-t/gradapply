import type { Profile, School } from "@prisma/client";

import { completeOneShotLlm } from "@/lib/ai";
import { admissionTermLabel } from "@/lib/admission-term";
import { formatDeadlineDateInput } from "@/lib/school-deadline";

const MAX_MASTER_CHARS = 28_000;

export function sopTailorTaskInstructions(): string {
  return [
    "You tailor a Statement of Purpose for ONE target graduate program. Follow every rule below.",
    "## Output",
    "- Return only the complete tailored statement text. No title line, preamble, or markdown code fences unless the master draft already used them.",
    "## Factual integrity (critical)",
    "- Do **not** invent faculty names, lab names, centers, joint programs, courses, deadlines, rankings, outcomes, or institutional facts.",
    "- Mention a specific professor, lab, or initiative **only** if their name or exact identifier already appears in the master SOP text or in the \"School notes\" section below. Otherwise use careful generic wording (e.g. \"research groups in robotics\").",
    "- Never add new factual claims about the applicant (employers, publications, GPA, awards) that are not supported by the master draft.",
    "## Writing task",
    "- Refocus paragraphs toward this program's name, degree, and field implied by the school row.",
    "- Preserve voice and truthful experience from the master draft while improving fit and clarity.",
  ].join("\n");
}

function formatSchoolBlock(school: School): string {
  const lines = [
    "## Target program",
    `- Institution / label: ${school.name}`,
    `- Program: ${school.program}`,
    `- Degree: ${school.degree}`,
    school.country?.trim() ? `- Country: ${school.country.trim()}` : null,
    school.term ? `- Admission term: ${admissionTermLabel(school.term)}` : null,
    school.deadline
      ? `- Application deadline: ${formatDeadlineDateInput(school.deadline)}`
      : null,
    school.portalUrl?.trim()
      ? `- Portal (verify externally): ${school.portalUrl.trim()}`
      : null,
    school.notes?.trim()
      ? `- School notes (user-provided; may include faculty names you may reference): ${school.notes.trim()}`
      : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function formatProfileHints(profile: Profile | null): string {
  if (!profile) return "";
  const parts = [
    profile.targetDegree?.trim() && `Target degree: ${profile.targetDegree.trim()}`,
    profile.focusArea?.trim() && `Focus: ${profile.focusArea.trim()}`,
    profile.researchInterests?.trim() &&
      `Research interests: ${profile.researchInterests.trim()}`,
  ].filter(Boolean) as string[];
  if (parts.length === 0) return "";
  return ["## Applicant profile (supporting context)", ...parts.map((p) => `- ${p}`)].join(
    "\n",
  );
}

export async function generateTailoredSopBody(opts: {
  masterSopText: string;
  school: School;
  profile: Profile | null;
}): Promise<string> {
  let master = opts.masterSopText.trim();
  if (master.length > MAX_MASTER_CHARS) {
    master = `${master.slice(0, MAX_MASTER_CHARS)}\n\n[Truncated by server at ${MAX_MASTER_CHARS} characters.]`;
  }

  const userPayload = [
    formatSchoolBlock(opts.school),
    "",
    formatProfileHints(opts.profile),
    "",
    "## Master statement of purpose (revise for the target above)",
    master,
  ]
    .filter((s) => s.length > 0)
    .join("\n");

  /** Omit `userId`: do not prepend full applicant doc pack—profile + school are already in `userPayload`. */
  return completeOneShotLlm({
    system: sopTailorTaskInstructions(),
    user: userPayload,
    maxTokens: 6000,
  });
}
