"use client";

import * as React from "react";

export interface PageLoaderProps {
  /** Visible loading copy. Defaults to "Loading…". */
  label?: string;
}

/**
 * Standardised dashed-border centered loading block.
 *
 * Mirrors the loading branch currently used on /documents and other list
 * pages: dashed outline-variant border, generous padding, muted text.
 */
export function PageLoader({ label = "Loading…" }: PageLoaderProps) {
  return (
    <div
      className="rounded-2xl border-2 border-dashed border-[var(--outline-variant)] p-10 text-center text-sm text-[var(--on-surface-variant)]"
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  );
}
