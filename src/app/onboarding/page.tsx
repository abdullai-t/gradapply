import { auth } from "@/auth";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { getOnboardingStatusForUser } from "@/lib/onboarding-server";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/onboarding");
  }

  const { complete } = await getOnboardingStatusForUser(session.user.id);
  if (complete) {
    redirect("/dashboard");
  }

  return <OnboardingWizard />;
}
