import { auth } from "@/auth";
import { isOnboardingComplete, isOnboardingExemptRole } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

/** Admins skip the scholar onboarding wizard; mark complete so APIs stay consistent. */
export async function ensureAdminOnboardingSkipped(userId: string): Promise<void> {
  const existing = await prisma.profile.findUnique({
    where: { userId },
    select: { onboardingCompletedAt: true },
  });
  if (existing?.onboardingCompletedAt) return;

  if (!existing) {
    await prisma.profile.create({
      data: {
        userId,
        countriesOfInterest: [],
        onboardingCompletedAt: new Date(),
      },
    });
    return;
  }

  await prisma.profile.update({
    where: { userId },
    data: { onboardingCompletedAt: new Date() },
  });
}

export async function getOnboardingStatusForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (isOnboardingExemptRole(user?.role)) {
    await ensureAdminOnboardingSkipped(userId);
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: {
        targetDegree: true,
        researchInterests: true,
        countriesOfInterest: true,
        onboardingCompletedAt: true,
        onboardingRecommendSeenAt: true,
      },
    });
    return {
      profile,
      complete: true,
    };
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      targetDegree: true,
      researchInterests: true,
      countriesOfInterest: true,
      onboardingCompletedAt: true,
      onboardingRecommendSeenAt: true,
    },
  });
  return {
    profile,
    complete: isOnboardingComplete(profile),
  };
}

/** Use in server pages under (main) to send incomplete users to onboarding. */
export async function requireOnboardingCompleteOrRedirect() {
  const session = await auth();
  if (!session?.user?.id) return null;

  if (isOnboardingExemptRole(session.user.role)) {
    await ensureAdminOnboardingSkipped(session.user.id);
    return session;
  }

  const { complete } = await getOnboardingStatusForUser(session.user.id);
  if (!complete) {
    const { redirect } = await import("next/navigation");
    redirect("/onboarding");
  }
  return session;
}
