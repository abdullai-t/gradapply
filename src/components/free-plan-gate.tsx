"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { TactileCard } from "@/components/tactile-card";

export interface FreePlanGateProps {
  /** Material Symbols icon name shown in the gradient tile. */
  icon: string;
  /** Headline shown above the body copy. */
  title: string;
  /** Body copy explaining why the feature is gated. */
  body: string;
  /** CTA label. Defaults to "Upgrade plan". */
  ctaLabel?: string;
  /** CTA href. Defaults to "/settings". */
  ctaHref?: string;
}

/**
 * Standardised "this feature requires a paid plan" upgrade card.
 *
 * Replaces the duplicated upgrade-card block currently sitting in:
 *   - src/app/(main)/dashboard/page.tsx
 *   - src/app/(main)/assistant/page.tsx
 *   - src/app/(main)/documents/page.tsx
 *
 * Layout matches the canonical version in /documents (gradient icon tile,
 * headline, body, primary button with arrow_forward).
 */
export function FreePlanGate({
  icon,
  title,
  body,
  ctaLabel = "Upgrade plan",
  ctaHref = "/settings",
}: FreePlanGateProps) {
  return (
    <div className="slide-in mx-auto max-w-2xl">
      <TactileCard className="rounded-3xl border-2 border-[var(--outline-variant)] p-8 text-center">
        <div
          className="mx-auto grid h-16 w-16 place-items-center rounded-2xl text-white"
          style={{
            background:
              "linear-gradient(135deg, var(--primary-container), var(--primary))",
          }}
        >
          <Icon name={icon} fill size={32} />
        </div>
        <h1 className="t-headline-md mt-5 text-[var(--on-surface)]">{title}</h1>
        <p className="mt-2 text-[var(--on-surface-variant)]">{body}</p>
        <Button asChild className="mt-6" iconRight="arrow_forward">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
      </TactileCard>
    </div>
  );
}
