"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const baseItems = [
  { href: "/dashboard", label: "Home" },
  { href: "/timeline", label: "Timeline" },
  { href: "/schools", label: "Schools" },
  { href: "/emails", label: "Emails" },
  { href: "/assistant", label: "AI" },
  { href: "/documents", label: "Files" },
  { href: "/profile", label: "Profile" },
  { href: "/support", label: "Help" },
  { href: "/settings", label: "Settings" },
];

export function MobileNav() {
  const pathname = usePathname();
  const { data } = useSession();
  const role = data?.user?.role;
  const [isFreePlan, setIsFreePlan] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/billing/status", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as {
          planTier?: string;
        };
      })
      .then((json) => {
        if (!active) return;
        setIsFreePlan(json?.planTier === "FREE");
      })
      .catch(() => {
        if (!active) return;
        setIsFreePlan(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleBase = baseItems.filter((item) => {
    if (isFreePlan && (item.href === "/assistant" || item.href === "/documents")) {
      return false;
    }
    return true;
  });
  const items =
    role === "ADMIN" || role === "SUPERADMIN"
      ? [...visibleBase, { href: "/admin", label: "Admin" }]
      : visibleBase;
  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-white/10 bg-[hsl(232_30%_12%/0.9)] px-4 py-2 text-sm backdrop-blur-xl md:hidden">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1 font-medium transition-colors",
              active
                ? "bg-primary/18 text-primary ring-1 ring-primary/30"
                : "text-muted-foreground hover:bg-white/[0.08] hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
