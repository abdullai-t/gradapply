"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import { useAppStatus } from "@/hooks/use-app-status";
import { NAV_ITEMS, type NavItem } from "./nav-config";

const MOBILE_KEYS = new Set(["dashboard", "schools", "timeline", "emails", "assistant"]);

export function MobileNav() {
  const pathname = usePathname();
  const status = useAppStatus();
  const isFreePlan = status.planTier === "FREE";

  const items: NavItem[] = NAV_ITEMS.filter(
    (i) => MOBILE_KEYS.has(i.key) && (!i.freeHidden || !isFreePlan),
  );

  return (
    <nav
      className="glass-header fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t md:hidden"
      style={{ borderTopColor: "var(--outline-variant)" }}
      aria-label="Primary"
    >
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-bold uppercase tracking-wide outline-none",
              active
                ? "text-[var(--primary)]"
                : "text-[var(--on-surface-variant)]",
            )}
          >
            <Icon name={item.icon} fill={active} size={22} />
            <span>{item.label.split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
