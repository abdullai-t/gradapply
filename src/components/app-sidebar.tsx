"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Shield,
  CalendarDays,
  LayoutDashboard,
  Mail,
  MessageSquare,
  School,
  Settings,
  Upload,
  UserRound,
} from "lucide-react";
import { BrandLogoMark } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/user-menu";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/timeline", label: "Timeline", icon: CalendarDays },
  { href: "/schools", label: "Schools", icon: School },
  { href: "/emails", label: "Professor emails", icon: Mail },
  { href: "/assistant", label: "AI assistant", icon: MessageSquare },
  { href: "/documents", label: "Documents", icon: Upload },
  { href: "/profile", label: "Profile", icon: UserRound },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role;
  const showAdmin = role === "ADMIN" || role === "SUPERADMIN";
  const [isFreePlan, setIsFreePlan] = useState<boolean>(false);
  const [settingsEnabled, setSettingsEnabled] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { planTier?: string; settingsEnabled?: boolean };
      })
      .then((data) => {
        if (!active) return;
        setIsFreePlan(data?.planTier === "FREE");
        setSettingsEnabled(data?.settingsEnabled === true);
      })
      .catch(() => {
        if (!active) return;
        setIsFreePlan(false);
        setSettingsEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const baseNav = nav.filter((item) => {
    if (isFreePlan && (item.href === "/assistant" || item.href === "/documents")) {
      return false;
    }
    if (!settingsEnabled && item.href === "/settings") return false;
    return true;
  });
  const navItems = showAdmin
    ? [...baseNav, { href: "/admin", label: "Admin", icon: Shield }]
    : baseNav;

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 bg-[hsl(232_32%_11%/0.75)] backdrop-blur-2xl md:flex">
      <div className="flex items-center gap-2 px-5 py-6">
        <BrandLogoMark
          size={36}
          className="h-9 w-9 rounded-xl shadow-[0_8px_28px_-6px_hsl(var(--primary)/0.45)] ring-1 ring-amber-400/30"
        />
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold tracking-tight">
            GradApply
          </div>
          <div className="text-xs text-muted-foreground">Scholar Pursuit Hub</div>
        </div>
      </div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/15 text-primary ring-1 ring-primary/35"
                  : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 p-3">
        <UserMenu />
      </div>
    </aside>
  );
}
