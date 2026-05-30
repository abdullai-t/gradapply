export type RecommendedSchool = {
  name: string;
  program: string;
  degree: string;
  country: string;
  tierBucket: string;
  whyFit: string;
  funding: string;
  notes: string;
  portalUrl: string | null;
};

export const TIER_SECTIONS = [
  { bucket: "top_tier", title: "Reach", subtitle: "Ambitious programs with strong fit" },
  { bucket: "mid_tier", title: "Match", subtitle: "Solid alignment and funding odds" },
  { bucket: "safety", title: "Safety", subtitle: "Strong likelihood of admission" },
] as const;
