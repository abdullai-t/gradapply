import type { UserRole } from "@prisma/client";

export function isOnboardingExemptRole(
  role: UserRole | string | null | undefined,
): boolean {
  return role === "ADMIN" || role === "SUPERADMIN";
}

export type OnboardingProfile = {
  targetDegree: string | null;
  researchInterests: string | null;
  countriesOfInterest: string[];
  onboardingCompletedAt: Date | string | null;
};

const MIN_RESEARCH_INTERESTS_CHARS = 20;

export function profileMeetsOnboardingMinimum(
  profile: OnboardingProfile | null | undefined,
): boolean {
  if (!profile) return false;
  if (!profile.targetDegree?.trim()) return false;
  if ((profile.researchInterests?.trim().length ?? 0) < MIN_RESEARCH_INTERESTS_CHARS) {
    return false;
  }
  if (!profile.countriesOfInterest?.length) return false;
  return true;
}

export function isOnboardingComplete(
  profile: Pick<OnboardingProfile, "onboardingCompletedAt"> | null | undefined,
): boolean {
  return profile?.onboardingCompletedAt != null;
}

export function isRecentOnboarding(
  completedAt: Date | string | null | undefined,
  withinDays = 7,
): boolean {
  if (!completedAt) return false;
  const d = completedAt instanceof Date ? completedAt : new Date(completedAt);
  if (Number.isNaN(d.getTime())) return false;
  const ms = Date.now() - d.getTime();
  return ms >= 0 && ms < withinDays * 24 * 60 * 60 * 1000;
}
