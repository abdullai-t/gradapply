/** Admission + full-funding tiers used in school recommendations. */
export const SCHOOL_TIER_BUCKETS = [
  "top_tier",
  "mid_tier",
  "safety",
] as const;

export type SchoolTierBucket = (typeof SCHOOL_TIER_BUCKETS)[number];

export const DEFAULT_SCHOOL_TIER_INTERESTS: SchoolTierBucket[] = [
  "top_tier",
  "mid_tier",
  "safety",
];

/**
 * How each tier is defined for users and for LLM school-search prompts.
 * Tiers rank by likelihood of admission WITH full funding (stipend + tuition coverage).
 */
export const SCHOOL_TIER_LLM_DEFINITIONS: Record<SchoolTierBucket, string> = {
  top_tier:
    "Top tier (reach): admission is unlikely even for a strong, well-prepared applicant, but students who are admitted typically receive full funding (living stipend plus tuition remission via RA, TA, or fellowship).",
  mid_tier:
    "Mid tier (match): a qualified applicant has a realistic chance of admission, and full funding (stipend plus tuition coverage) is commonly available to admitted students.",
  safety:
    "Safety tier: admission is highly likely for this applicant profile, and full funding (stipend plus tuition coverage) is reliably offered to admitted students.",
};

export const SCHOOL_TIER_OPTIONS: ReadonlyArray<{
  bucket: SchoolTierBucket;
  title: string;
  subtitle: string;
}> = [
  {
    bucket: "top_tier",
    title: "Top tier (reach)",
    subtitle: "Unlikely admission, but full funding if admitted",
  },
  {
    bucket: "mid_tier",
    title: "Mid tier (match)",
    subtitle: "Realistic admission with full funding",
  },
  {
    bucket: "safety",
    title: "Safety",
    subtitle: "Likely admission with reliable full funding",
  },
];

/** Short labels for onboarding school picker sections. */
export const SCHOOL_TIER_SECTIONS: ReadonlyArray<{
  bucket: SchoolTierBucket;
  title: string;
  subtitle: string;
}> = [
  {
    bucket: "top_tier",
    title: "Reach",
    subtitle: "Unlikely admission, but full funding if admitted",
  },
  {
    bucket: "mid_tier",
    title: "Match",
    subtitle: "Realistic admission with full funding",
  },
  {
    bucket: "safety",
    title: "Safety",
    subtitle: "Likely admission with reliable full funding",
  },
];

const BUCKET_SET = new Set<string>(SCHOOL_TIER_BUCKETS);

export function isSchoolTierBucket(v: string): v is SchoolTierBucket {
  return BUCKET_SET.has(v);
}

/** Block of tier definitions for LLM recommend prompts. */
export function formatSchoolTierDefinitionsForPrompt(
  tiers: SchoolTierBucket[] = DEFAULT_SCHOOL_TIER_INTERESTS,
): string {
  return tiers
    .map((bucket) => `- ${SCHOOL_TIER_LLM_DEFINITIONS[bucket]}`)
    .join("\n");
}

/** Normalize stored JSON/array; empty → all tiers (legacy users). */
export function resolveSchoolTierInterests(
  raw: string[] | null | undefined,
): SchoolTierBucket[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_SCHOOL_TIER_INTERESTS];
  }
  const seen = new Set<SchoolTierBucket>();
  const out: SchoolTierBucket[] = [];
  for (const bucket of SCHOOL_TIER_BUCKETS) {
    if (raw.includes(bucket) && !seen.has(bucket)) {
      seen.add(bucket);
      out.push(bucket);
    }
  }
  return out.length > 0 ? out : [...DEFAULT_SCHOOL_TIER_INTERESTS];
}

/** Distribute `total` onboarding picks across selected tiers as evenly as possible. */
export function distributeOnboardingSchoolCounts(
  tierCount: number,
  total = 5,
): number[] {
  if (tierCount <= 0) return [];
  const base = Math.floor(total / tierCount);
  const remainder = total % tierCount;
  return Array.from({ length: tierCount }, (_, i) => base + (i < remainder ? 1 : 0));
}
