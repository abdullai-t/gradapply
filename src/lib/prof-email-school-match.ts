/** Normalize institution names for fuzzy matching (prof university ↔ school name). */
function normalizeInstitution(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(university|college|institute|of|the)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function significantTokens(value: string): string[] {
  return normalizeInstitution(value)
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

/**
 * Best-effort link between a `ProfEmail` row and a tracker `School`.
 * There is no FK — discovery uses school context in the UI only.
 */
export function profEmailMatchesSchool(
  prof: { university: string | null },
  school: { name: string },
): boolean {
  const uni = prof.university?.trim();
  if (!uni) return false;

  const nUni = normalizeInstitution(uni);
  const nSchool = normalizeInstitution(school.name);
  if (!nUni || !nSchool) return false;

  if (nUni === nSchool) return true;
  if (nUni.includes(nSchool) || nSchool.includes(nUni)) return true;

  const uniTokens = significantTokens(uni);
  const schoolTokens = significantTokens(school.name);
  const overlap = uniTokens.filter((t) => schoolTokens.includes(t));
  if (overlap.length >= 2) return true;
  if (
    overlap.length === 1 &&
    (uniTokens.length <= 2 || schoolTokens.length <= 2)
  ) {
    return true;
  }
  return false;
}
