import { auth } from "@/auth";
import { isOnboardingComplete } from "@/lib/onboarding";
import { prisma } from "@/lib/prisma";

export async function getOnboardingStatusForUser(userId: string) {
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

  const { complete } = await getOnboardingStatusForUser(session.user.id);
  if (!complete) {
    const { redirect } = await import("next/navigation");
    redirect("/onboarding");
  }
  return session;
}
