import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AUTH_CONTINUE_PATH, isSafeAuthRedirectPath } from "@/lib/auth-redirect";
import { isOnboardingExemptRole } from "@/lib/onboarding";
import {
  ensureAdminOnboardingSkipped,
  getOnboardingStatusForUser,
} from "@/lib/onboarding-server";

type SearchParams = Promise<{ next?: string }>;

export default async function AuthContinuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(AUTH_CONTINUE_PATH)}`,
    );
  }

  const { next } = await searchParams;
  if (next && isSafeAuthRedirectPath(next)) {
    redirect(next);
  }

  if (isOnboardingExemptRole(session.user.role)) {
    await ensureAdminOnboardingSkipped(session.user.id);
    redirect("/admin");
  }

  const { complete } = await getOnboardingStatusForUser(session.user.id);
  if (!complete) {
    redirect("/onboarding");
  }

  redirect("/dashboard");
}
