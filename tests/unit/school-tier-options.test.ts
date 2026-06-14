import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCHOOL_TIER_INTERESTS,
  distributeOnboardingSchoolCounts,
  formatSchoolTierDefinitionsForPrompt,
  resolveSchoolTierInterests,
  SCHOOL_TIER_LLM_DEFINITIONS,
} from "@/lib/school-tier-options";

describe("resolveSchoolTierInterests", () => {
  it("returns all tiers when unset or empty", () => {
    expect(resolveSchoolTierInterests(null)).toEqual(DEFAULT_SCHOOL_TIER_INTERESTS);
    expect(resolveSchoolTierInterests([])).toEqual(DEFAULT_SCHOOL_TIER_INTERESTS);
  });

  it("preserves valid selected tiers in canonical order", () => {
    expect(resolveSchoolTierInterests(["safety", "top_tier"])).toEqual([
      "top_tier",
      "safety",
    ]);
  });

  it("ignores invalid bucket values", () => {
    expect(resolveSchoolTierInterests(["mid_tier", "invalid"])).toEqual([
      "mid_tier",
    ]);
  });
});

describe("distributeOnboardingSchoolCounts", () => {
  it("splits five picks across three tiers", () => {
    expect(distributeOnboardingSchoolCounts(3)).toEqual([2, 2, 1]);
  });

  it("splits five picks across two tiers", () => {
    expect(distributeOnboardingSchoolCounts(2)).toEqual([3, 2]);
  });

  it("gives all five to one tier when only one is selected", () => {
    expect(distributeOnboardingSchoolCounts(1)).toEqual([5]);
  });
});

describe("formatSchoolTierDefinitionsForPrompt", () => {
  it("includes full funding language for each tier", () => {
    const block = formatSchoolTierDefinitionsForPrompt(["mid_tier"]);
    expect(block).toContain(SCHOOL_TIER_LLM_DEFINITIONS.mid_tier);
    expect(block.toLowerCase()).toContain("full funding");
  });
});
