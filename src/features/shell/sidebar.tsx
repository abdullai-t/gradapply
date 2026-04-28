"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

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
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = globalThis.localStorage?.getItem("ga:sidebar-collapsed");
    setCollapsed(stored === "1");
  }, []);

  useEffect(() => {
    globalThis.localStorage?.setItem("ga:sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "glass-rail sticky top-0 hidden h-screen shrink-0 flex-col gap-1 py-4 transition-[width,padding] duration-200 md:flex",
        collapsed ? "w-20 px-2.5" : "w-64 px-4",
      )}
    >
      {/* Brand */}
      <Link
        href="/dashboard"
        className={cn(
          "mb-3 flex items-center px-2 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)] rounded-xl",
          collapsed ? "justify-center" : "gap-2.5",
        )}
        aria-label="Go to dashboard"
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
        {!collapsed ? (
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <div className="text-base font-extrabold tracking-tight text-[var(--primary)]">
                GradApply
              </div>
              <span className="inline-flex items-center rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--on-surface)]">
                {status.planTier ?? "FREE"}
              </span>
            </div>
            <div className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[var(--outline)]">
              Scholar Pursuit Hub
            </div>
          </div>
        ) : null}
      </Link>

      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className={cn(
          "mb-2 inline-flex h-9 items-center rounded-lg border border-[var(--outline-variant)] bg-[var(--surface-container-low)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]",
          collapsed ? "justify-center px-2" : "justify-between px-2.5",
        )}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <>
            <span className="text-xs font-semibold">Collapse</span>
            <PanelLeftClose className="h-4 w-4" />
          </>
        )}
      </button>

      <nav className="flex flex-1 flex-col gap-1">
        {main.map((item) => (
          <SidebarLink
            key={item.key}
            item={item}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-[var(--outline-variant)] pt-2">
        {footer.map((item) => (
          <SidebarLink
            key={item.key}
            item={item}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
          />
        ))}
        <div className="mt-1 px-1.5">
          <UserMenu compact={collapsed} />
        </div>
      </div>
    </aside>
  );
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      className={cn(
        "group relative flex items-center rounded-xl text-sm font-bold transition-all duration-200 ease-spring outline-none",
        collapsed
          ? "mx-auto h-11 w-11 justify-center"
          : "h-11 gap-3 px-3.5",
        active
          ? "bg-[color-mix(in_srgb,var(--primary-container)_20%,transparent)] text-[var(--primary)] ring-1 ring-[color-mix(in_srgb,var(--primary)_35%,transparent)]"
          : "text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)] hover:translate-x-0.5",
      )}
    >
      <Icon name={item.icon} fill={active} size={22} />
      {!collapsed ? <span>{item.label}</span> : null}
    </Link>
  );
}
