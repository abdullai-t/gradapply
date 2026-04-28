import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BillingSettings } from "@/components/billing-settings";
import { ConnectorsSettings } from "@/components/connectors-settings";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import { Icon } from "@/components/icon";
import { ThemeToggle } from "@/components/theme-toggle";

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
    <div className="slide-in space-y-8 pb-16">
      <header>
        <h1 className="t-headline-lg m-0 text-[var(--on-surface)]">
          Settings
        </h1>
        <p className="mt-1.5 max-w-xl text-[15px] text-[var(--on-surface-variant)]">
          Preferences, billing, and connections to outside services.
        </p>
      </header>

      {/* Appearance */}
      <SettingsSection
        title="Appearance"
        description="Pick how GradApply looks. System matches your OS theme."
        icon="palette"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-[var(--on-surface-variant)]">
            Theme persists across reloads. Tactile shadows and motion stay
            consistent in either mode.
          </p>
          <ThemeToggle />
        </div>
      </SettingsSection>

      {/* Billing */}
      <SettingsSection
        title="Billing &amp; usage"
        description="Plan tier, monthly AI allowance, and credit packs."
        icon="credit_card"
      >
        <Suspense
          fallback={
            <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-8 text-sm text-[var(--on-surface-variant)]">
              Loading billing…
            </div>
          }
        >
          <BillingSettings />
        </Suspense>
      </SettingsSection>

      {/* Connectors */}
      <SettingsSection
        title="Integrations"
        description="Optional Google connectors. Tokens are stored only on your account."
        icon="link"
      >
        <Suspense
          fallback={
            <div className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-8 text-sm text-[var(--on-surface-variant)]">
              Loading connectors…
            </div>
          }
        >
          <ConnectorsSettings planTier={user?.planTier ?? "FREE"} />
        </Suspense>
      </SettingsSection>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-6 md:p-7">
      <header className="mb-5 flex items-start gap-3">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{
            background: "rgba(0,98,157,0.08)",
            color: "var(--primary)",
          }}
        >
          <Icon name={icon} size={22} />
        </div>
        <div>
          <h2
            className="m-0 text-lg font-bold tracking-tight text-[var(--on-surface)]"
            dangerouslySetInnerHTML={{ __html: title }}
          />
          <p className="m-0 mt-0.5 text-sm text-[var(--on-surface-variant)]">
            {description}
          </p>
        </div>
      </header>
      {children}
    </section>
  );
}
