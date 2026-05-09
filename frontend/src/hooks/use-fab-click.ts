"use client";

import { useEffect } from "react";

/**
 * Subscribe to the global Floating Action Button click for a specific route.
 *
 * Contract: `src/features/shell/fab.tsx` dispatches a cancelable
 * `CustomEvent("gradapply:fab-click", { detail: { route } })` when the FAB
 * is pressed. Pages can intercept that event to swap the default behaviour
 * for a page-local one (e.g. opening an "add" modal instead of routing to
 * the assistant). Calling `event.preventDefault()` on the event tells the
 * FAB to skip its own default handler.
 *
 * @param route   The route key (matches `meta.key` in nav-config) this
 *                page handles. Other routes' clicks are ignored.
 * @param handler Called when a FAB click is received for `route`.
 *
 * @example
 *   useFabClick("schools", () => setAddOpen(true));
 */
export function useFabClick(route: string, handler: () => void): void {
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ route?: string }>).detail;
      if (detail?.route === route) {
        event.preventDefault();
        handler();
      }
    };
    window.addEventListener("gradapply:fab-click", listener);
    return () => window.removeEventListener("gradapply:fab-click", listener);
  }, [route, handler]);
}
