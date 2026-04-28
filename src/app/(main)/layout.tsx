import { Sidebar } from "@/features/shell/sidebar";
import { TopBar } from "@/features/shell/topbar";
import { FAB } from "@/features/shell/fab";
import { MobileNav } from "@/features/shell/mobile-nav";
import { ReminderBanner } from "@/components/reminder-banner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
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
  );
}
