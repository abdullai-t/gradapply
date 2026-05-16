/** Normalize school identity for deduplication (recommendations vs tracked list). */

export type SchoolIdentity = {
  name: string;
  program?: string | null;
};

export type RecommendSchoolRow = {
  name?: unknown;
  program?: unknown;
  degree?: unknown;
  country?: unknown;
  tierBucket?: unknown;
  whyFit?: unknown;
  notes?: unknown;
  funding?: unknown;
  portalUrl?: unknown;
};

function cleanPart(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function normalizeSchoolName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\b(the|university|of)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function schoolIdentityKey(name: string, program: string): string {
  return `${normalizeSchoolName(name)}|${normalizeSchoolName(program)}`;
}

export function buildSchoolExcludeIndex(schools: SchoolIdentity[]): {
  nameKeys: Set<string>;
  fullKeys: Set<string>;
} {
  const nameKeys = new Set<string>();
  const fullKeys = new Set<string>();
  for (const s of schools) {
    const name = cleanPart(s.name);
    if (!name) continue;
    nameKeys.add(normalizeSchoolName(name));
    const program = cleanPart(s.program);
    if (program) fullKeys.add(schoolIdentityKey(name, program));
  }
  return { nameKeys, fullKeys };
}

export function isSchoolExcluded(
  row: RecommendSchoolRow,
  index: { nameKeys: Set<string>; fullKeys: Set<string> },
): boolean {
  const name = cleanPart(row.name);
  if (!name) return true;
  if (index.nameKeys.has(normalizeSchoolName(name))) return true;
  const program = cleanPart(row.program);
  if (program && index.fullKeys.has(schoolIdentityKey(name, program))) {
    return true;
  }
  return false;
}

export function filterRecommendSchoolRows(
  rows: unknown[],
  excludeFrom: SchoolIdentity[],
): RecommendSchoolRow[] {
  const index = buildSchoolExcludeIndex(excludeFrom);
  const seen = new Set<string>();
  const out: RecommendSchoolRow[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as RecommendSchoolRow;
    const name = cleanPart(rec.name);
    const program = cleanPart(rec.program);
    if (!name || !program) continue;
    if (isSchoolExcluded(rec, index)) continue;

    const key = schoolIdentityKey(name, program);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rec);
  }

  return out;
}

export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const arr = [...items];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}
