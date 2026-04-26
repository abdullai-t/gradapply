"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";

import { Icon } from "@/components/icon";
import { findActiveItem } from "./nav-config";
import { cn } from "@/lib/utils";

/**
 * Floating Action Button — fixed bottom-right, route-aware.
 * Default action: open AI Assistant (smart_toy). Schools page swaps to "add",
 * Documents page to "cloud_upload" (these are the affordances most users
 * will reach for on those pages).
 *
 * Listens for `gradapply:fab-click` if any page wants to override behaviour.
 */
export function FAB() {
  const pathname = usePathname();
  const router = useRouter();
  const meta = findActiveItem(pathname);

  if (!meta?.showFab) return null;
  const icon = meta.fabIcon ?? "smart_toy";

  function handleClick() {
    // Allow page-local override via custom event.
    const overrideEvent = new CustomEvent("gradapply:fab-click", {
      cancelable: true,
      detail: { route: meta?.key },
    });
    const dispatched = window.dispatchEvent(overrideEvent);
    if (overrideEvent.defaultPrevented || !dispatched) return;

    // Default behaviours per route.
    if (icon === "smart_toy") {
      router.push("/assistant");
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={icon === "smart_toy" ? "Ask AI assistant" : "Quick action"}
      className={cn(
        "tactile pulse-glow fixed bottom-8 right-8 z-50 grid h-14 w-14 place-items-center rounded-full text-white",
        "bg-[var(--primary)] shadow-fab",
      )}
    >
      <Icon name={icon} fill size={26} />
    </button>
  );
}
