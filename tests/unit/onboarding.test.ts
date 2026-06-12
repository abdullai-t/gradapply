import { describe, expect, it } from "vitest";

import {
  isOnboardingComplete,
  isOnboardingExemptRole,
  isRecentOnboarding,
  profileMeetsOnboardingMinimum,
} from "@/lib/onboarding";

describe("onboarding", () => {
  it("exempts admin roles", () => {
    expect(isOnboardingExemptRole("ADMIN")).toBe(true);
    expect(isOnboardingExemptRole("SUPERADMIN")).toBe(true);
    expect(isOnboardingExemptRole("USER")).toBe(false);
  });

  it("profileMeetsOnboardingMinimum requires degree and countries", () => {
    expect(profileMeetsOnboardingMinimum(null)).toBe(false);
    expect(
      profileMeetsOnboardingMinimum({
        targetDegree: "PhD",
        researchInterests: null,
        countriesOfInterest: [],
        onboardingCompletedAt: null,
      }),
    ).toBe(false);
    expect(
      profileMeetsOnboardingMinimum({
        targetDegree: "PhD",
        researchInterests: "ML",
        countriesOfInterest: ["US"],
        onboardingCompletedAt: null,
      }),
    ).toBe(true);
  });

  it("isOnboardingComplete checks timestamp", () => {
    expect(isOnboardingComplete(null)).toBe(false);
    expect(
      isOnboardingComplete({ onboardingCompletedAt: new Date() }),
    ).toBe(true);
  });

  it("isRecentOnboarding respects window and invalid dates", () => {
    expect(isRecentOnboarding(null)).toBe(false);
    expect(isRecentOnboarding("not-a-date")).toBe(false);
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    expect(isRecentOnboarding(recent)).toBe(true);
    const old = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(isRecentOnboarding(old)).toBe(false);
  });
});
