import { ShellProvider } from "@/components/providers/shell-provider";
import { ServerSessionHydrator } from "@/components/providers/server-session-hydrator";
import { ReminderBanner } from "@/components/reminder-banner";
import { FAB } from "@/features/shell/fab";
import { MobileNav } from "@/features/shell/mobile-nav";
import { Sidebar } from "@/features/shell/sidebar";
import { TopBar } from "@/features/shell/topbar";
import { buildBillingStatusForUser } from "@/lib/billing/build-status";
import { requireOnboardingCompleteOrRedirect } from "@/lib/onboarding-server";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOnboardingCompleteOrRedirect();
  const billingStatus = await buildBillingStatusForUser(session.user.id);

  return (
    <ShellProvider serverSession={session} billingStatus={billingStatus}>
      <ServerSessionHydrator session={session} />
      <div className="relative min-h-screen md:flex bg-[var(--background)] text-[var(--on-background)]">
        <Sidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <TopBar />
          <ReminderBanner />
          <main
            className="flex-1 px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-12"
            style={{ maxWidth: "1320px", margin: "0 auto", width: "100%" }}
          >
            {children}
          </main>
        </div>
        <MobileNav />
        <FAB />
      </div>
    </ShellProvider>
  );
}
