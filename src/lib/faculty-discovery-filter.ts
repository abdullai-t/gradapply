import { profEmailMatchesSchool } from "@/lib/prof-email-school-match";

export type FacultyDiscoveryCandidate = {
  name: string;
  profileUrl: string | null;
  profEmail: string | null;
  schoolId?: string;
  targetSchoolLabel?: string;
  matchScore: number;
  researchArea: string;
  rationale: string;
  source: "school_program" | "department_page";
};

type SchoolRef = { id: string; name: string };

const INACTIVE_FACULTY_RE =
  /\b(emeritus|emerita|retired|deceased|in memoriam|former faculty|former professor|previous faculty|alumni|no longer at|not currently (?:at|affiliated)|left the (?:university|department|faculty)|past (?:member|faculty))\b/i;

/** True when text suggests the person is not an active researcher at the institution. */
export function isLikelyInactiveFaculty(fields: {
  name?: string;
  researchArea?: string;
  rationale?: string;
  department?: string;
}): boolean {
  const blob = [fields.name, fields.researchArea, fields.rationale, fields.department]
    .filter(Boolean)
    .join(" ");
  return INACTIVE_FACULTY_RE.test(blob);
}

/** Resolve which selected school a candidate belongs to (id preferred, then name match). */
export function resolveCandidateSchoolId(
  candidate: {
    schoolId?: string;
    targetSchoolLabel?: string;
    university?: string;
  },
  schools: SchoolRef[],
  knownSchoolIds: Set<string>,
): string | undefined {
  if (candidate.schoolId && knownSchoolIds.has(candidate.schoolId)) {
    return candidate.schoolId;
  }
  const uni =
    candidate.targetSchoolLabel?.trim() ||
    candidate.university?.trim() ||
    "";
  if (!uni) return undefined;
  const match = schools.find((s) => profEmailMatchesSchool({ university: uni }, s));
  return match?.id;
}

export function candidateBelongsToSelectedSchool(
  candidate: {
    schoolId?: string;
    targetSchoolLabel?: string;
    university?: string;
  },
  schools: SchoolRef[],
  knownSchoolIds: Set<string>,
): boolean {
  return resolveCandidateSchoolId(candidate, schools, knownSchoolIds) != null;
}

/** Keep only named, active faculty tied to one of the selected schools. */
export function filterFacultyDiscoveryCandidates<
  T extends FacultyDiscoveryCandidate,
>(candidates: T[], schools: SchoolRef[]): T[] {
  const knownSchoolIds = new Set(schools.map((s) => s.id));
  const out: T[] = [];

  for (const c of candidates) {
    if (!c.name.trim()) continue;
    if (
      isLikelyInactiveFaculty({
        name: c.name,
        researchArea: c.researchArea,
        rationale: c.rationale,
      })
    ) {
      continue;
    }

    const schoolId = resolveCandidateSchoolId(
      {
        schoolId: c.schoolId,
        targetSchoolLabel: c.targetSchoolLabel,
        university: c.targetSchoolLabel,
      },
      schools,
      knownSchoolIds,
    );
    if (!schoolId) continue;

    const school = schools.find((s) => s.id === schoolId);
    out.push({
      ...c,
      schoolId,
      targetSchoolLabel: school?.name ?? c.targetSchoolLabel,
    });
  }

  return out;
}

export const FACULTY_DISCOVERY_SCHOOL_RULES = [
  "Every candidate MUST be a current faculty member at exactly one of the listed schools — echo the matching schoolId from the Schools list.",
  "Do NOT include professors at other universities, former faculty, emeriti, retired faculty, honorary-only appointments, or alumni.",
  "Only include faculty with active research programs (recent work, running lab, graduate supervision, or current faculty directory listing).",
  "If you cannot verify both (a) affiliation with a listed school and (b) active research status, omit the candidate.",
].join("\n");
