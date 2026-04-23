import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BillingSettings } from "@/components/billing-settings";
import { ConnectorsSettings } from "@/components/connectors-settings";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";

export default async function SettingsPage() {
  const settingsEnabled = await isFeatureEnabled("user_settings_page", false, {
    fresh: true,
  });
  if (!settingsEnabled) redirect("/dashboard");

  const session = await auth();
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { planTier: true },
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary/90">
          Account
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Settings
        </h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Connect external services so outreach and future notifications can use your own
          accounts.
        </p>
      </div>

      <Suspense
        fallback={
          <div className="rounded-xl border border-white/10 bg-muted/20 p-8 text-sm text-muted-foreground">
            Loading billing…
          </div>
        }
      >
        <BillingSettings />
      </Suspense>

      <Suspense
        fallback={
          <div className="rounded-xl border border-white/10 bg-muted/20 p-8 text-sm text-muted-foreground">
            Loading connectors…
          </div>
        }
      >
        <ConnectorsSettings planTier={user?.planTier ?? "FREE"} />
      </Suspense>
    </div>
  );
}
