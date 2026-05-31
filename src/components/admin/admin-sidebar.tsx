"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  Settings,
  Tags,
  Users,
} from "lucide-react";

import { BrandLogoMark } from "@/components/brand-logo";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/user-menu";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/users", label: "User management", icon: Users },
  { href: "/admin/settings", label: "Platform settings", icon: Settings },
  { href: "/admin/pricing", label: "Pricing & billing", icon: Tags },
];

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-white/10 bg-[hsl(232_32%_11%/0.85)] backdrop-blur-xl md:flex">
      <div className="flex items-center gap-2 px-5 py-6">
        <BrandLogoMark
          size={36}
          className="h-9 w-9 rounded-xl shadow-[0_8px_28px_-6px_hsl(var(--primary)/0.45)] ring-1 ring-amber-400/30"
        />
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold tracking-tight">
            GradApply Admin
          </div>
          <div className="text-xs text-muted-foreground">Control and billing</div>
        </div>
      </div>
      <Separator />
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {nav.map((item) => {
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
