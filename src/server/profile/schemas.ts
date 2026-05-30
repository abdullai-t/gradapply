import { z } from "zod";

import { COUNTRY_OPTIONS } from "@/lib/country-options";

export const updateProfileSchema = z.object({
  targetDegree: z.string().nullable().optional(),
  focusArea: z.string().nullable().optional(),
  greScore: z.string().nullable().optional(),
  greVerbal: z.number().int().nullable().optional(),
  greQuant: z.number().int().nullable().optional(),
  greAWA: z.number().nullable().optional(),
  undergradSchool: z.string().nullable().optional(),
  undergradDegree: z.string().nullable().optional(),
  undergradGPA: z.number().nullable().optional(),
  yearsExperience: z.string().nullable().optional(),
  researchInterests: z.string().nullable().optional(),
  countriesOfInterest: z
    .array(z.enum(COUNTRY_OPTIONS as [string, ...string[]]))
    .max(5)
    .optional(),
  bio: z.string().nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
  onboardingCompletedAt: z.union([z.string(), z.null()]).optional(),
  onboardingRecommendSeenAt: z.union([z.string(), z.null()]).optional(),
});
