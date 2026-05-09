"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/icon";
import { findActiveItem } from "./nav-config";

export function TopBar() {
  const pathname = usePathname();
  const meta = findActiveItem(pathname);

  return (
    <header className="glass-header sticky top-0 z-30 flex h-16 items-center justify-between gap-4 px-6">
      <div className="flex flex-1 items-center gap-4">
        <h2 className="t-headline-md m-0 text-[var(--on-surface)]">
          {meta?.title ?? "GradApply"}
        </h2>
      </div>

      <div className="flex items-center gap-2.5">
        <SearchPill placeholder={meta?.searchPlaceholder ?? "Search..."} />
        <NotificationsButton />
      </div>
    </header>
  );
}

function SearchPill({ placeholder }: { placeholder: string }) {
  return (
    <div className="relative hidden md:block">
      <Icon
        name="search"
        size={18}
        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--outline)]"
      />
      <input
        type="search"
        placeholder={placeholder}
        aria-label="Search"
        className="h-10 w-64 rounded-full border border-transparent bg-[var(--surface-container)] pl-10 pr-4 text-sm text-[var(--on-surface)] placeholder:text-[var(--outline)] focus:outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-container)]/30"
      />
    </div>
  );
}

function NotificationsButton() {
  return (
    <button
      type="button"
      aria-label="Notifications"
      className="relative grid h-10 w-10 place-items-center rounded-full text-[var(--on-surface-variant)] transition-colors hover:bg-[var(--surface-container)]"
    >
      <Icon name="notifications" size={20} />
      <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-[var(--surface)] bg-[var(--error)]" />
    </button>
  );
}
