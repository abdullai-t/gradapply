import { auth, type AppSession } from "@/auth";
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
export async function requireOnboardingCompleteOrRedirect(): Promise<AppSession> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    const { redirect } = await import("next/navigation");
    redirect("/login?callbackUrl=/dashboard");
    throw new Error("redirect");
  }

  if (isOnboardingExemptRole(session.user.role)) {
    await ensureAdminOnboardingSkipped(userId);
    return session;
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      onboardingCompletedAt: true,
      targetDegree: true,
      researchInterests: true,
      countriesOfInterest: true,
    },
  });

  if (profile?.onboardingCompletedAt || isOnboardingComplete(profile)) {
    return session;
  }

  const { redirect } = await import("next/navigation");
  redirect("/onboarding");
  throw new Error("redirect");
}
