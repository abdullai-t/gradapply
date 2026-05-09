import { ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { MainShellBackdrop } from "@/components/layout/glass-scene";
import { UserMenu } from "@/components/user-menu";
import { getCurrentUserRole } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  const role = await getCurrentUserRole(session.user.id);
  if (role !== "ADMIN" && role !== "SUPERADMIN") {
    return (
      <div className="relative min-h-screen">
        <MainShellBackdrop />
        <main className="mx-auto max-w-3xl px-4 py-10">
          <div className="glass-panel border-amber-500/30 p-6">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" aria-hidden />
              <div>
                <h1 className="font-display text-2xl font-semibold">Access denied</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  This area is available only to admins and superadmins.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen md:flex">
      <MainShellBackdrop />
      <AdminSidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-white/10 bg-[hsl(232_32%_11%/0.85)] px-4 py-3 backdrop-blur-xl md:hidden">
          <p className="font-display text-sm font-semibold tracking-tight">
            GradApply Admin
          </p>
          <UserMenu />
        </header>
        <AdminMobileNav />
        <main className="flex-1 px-4 py-8 md:px-10">{children}</main>
      </div>
    </div>
  );
}
