import { BrandLogoMark } from "@/components/brand-logo";
import { AppSidebar } from "@/components/app-sidebar";
import { MainShellBackdrop } from "@/components/layout/glass-scene";
import { MobileNav } from "@/components/mobile-nav";
import { UserMenu } from "@/components/user-menu";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen md:flex">
      <MainShellBackdrop />
      <AppSidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/10 bg-[hsl(232_32%_11%/0.85)] px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-2">
            <BrandLogoMark
              size={36}
              className="h-9 w-9 rounded-lg ring-1 ring-amber-400/30"
            />
            <span className="font-display font-semibold">GradApply</span>
          </div>
          <UserMenu />
        </header>
        <MobileNav />
        <main className="flex-1 px-4 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
