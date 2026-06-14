import type { SchoolTierBucket } from "@/lib/school-tier-options";

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

export {
  SCHOOL_TIER_SECTIONS as TIER_SECTIONS,
  type SchoolTierBucket,
} from "@/lib/school-tier-options";
