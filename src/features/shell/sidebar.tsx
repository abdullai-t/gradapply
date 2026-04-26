"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";
import { UserMenu } from "@/components/user-menu";
import { useAppStatus } from "@/hooks/use-app-status";
import { NAV_ITEMS, partitionNav, type NavItem } from "./nav-config";

export function Sidebar() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role;
  const isAdmin = role === "ADMIN" || role === "SUPERADMIN";
  const status = useAppStatus();
  const isFreePlan = status.planTier === "FREE";

  const visible = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.flag === "settingsEnabled" && !status.settingsEnabled) return false;
    if (item.flag === "supportTabEnabled" && !status.supportTabEnabled)
      return false;
    if (item.freeHidden && isFreePlan) return false;
    return true;
  });
  const { main, footer } = partitionNav(visible);

  return (
    <aside className="glass-rail sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-1 px-4 py-4 md:flex">
      {/* Brand */}
      <Link
        href="/dashboard"
        className="mb-3 flex items-center gap-2.5 px-2 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)] rounded-xl"
      >
        <div
          className="grid h-9 w-9 place-items-center rounded-xl text-white shadow-[0_3px_0_0_var(--on-primary-fixed-variant)]"
          style={{
            background:
              "linear-gradient(135deg, var(--primary-container), var(--primary))",
          }}
        >
          <Icon name="auto_stories" fill size={20} />
        </div>
        <div className="leading-tight">
          <div className="text-base font-extrabold tracking-tight text-[var(--primary)]">
            GradApply
          </div>
          <div className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[var(--outline)]">
            Scholar Pursuit Hub
          </div>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {main.map((item) => (
          <SidebarLink
            key={item.key}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-[var(--outline-variant)] pt-2">
        {footer.map((item) => (
          <SidebarLink
            key={item.key}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
        <div className="mt-1 px-1.5">
          <UserMenu />
        </div>
      </div>
    </aside>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition-all duration-200 ease-spring outline-none",
        active
          ? "bg-[color-mix(in_srgb,var(--primary-container)_18%,transparent)] text-[var(--primary)] -translate-y-0.5 [box-shadow:0_2px_0_0_var(--primary-container)]"
          : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:translate-x-0.5",
      )}
      style={
        active
          ? { borderBottom: "4px solid var(--primary)", marginBottom: -4 }
          : undefined
      }
    >
      <Icon name={item.icon} fill={active} size={22} />
      <span>{item.label}</span>
    </Link>
  );
}
