import { auth } from "@/auth";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { isOnboardingExemptRole } from "@/lib/onboarding";
import { getOnboardingStatusForUser } from "@/lib/onboarding-server";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/onboarding");
  }

  if (isOnboardingExemptRole(session.user.role)) {
    redirect("/admin");
  }

  const { complete } = await getOnboardingStatusForUser(session.user.id);
  if (complete) {
    redirect("/dashboard");
  }

  return <OnboardingWizard />;
}
