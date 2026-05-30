"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "gradapply_getting_started_dismissed";

export type GettingStartedItem = {
  icon: string;
  label: string;
  href: string;
  done: boolean;
};

export function GettingStartedCard({ items }: { items: GettingStartedItem[] }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  const dismiss = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }, []);

  const pending = items.filter((i) => !i.done);
  if (dismissed || pending.length === 0) return null;

  return (
    <section
      className="tactile-card rounded-3xl border border-[var(--outline-variant)] p-6"
      aria-labelledby="getting-started-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="getting-started-heading"
            className="m-0 text-lg font-bold text-[var(--on-surface)]"
          >
            Getting started
          </h2>
          <p className="m-0 mt-1 text-sm text-[var(--on-surface-variant)]">
            {pending.length} quick win{pending.length === 1 ? "" : "s"} left
            this week.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="text-xs font-bold uppercase tracking-wide text-[var(--outline)] hover:text-[var(--on-surface)]"
        >
          Dismiss
        </button>
      </div>
      <ul className="m-0 mt-4 grid list-none gap-2 p-0 sm:grid-cols-3">
        {items.map((item) => (
          <li key={item.href}>
            {item.done ? (
              <span className="flex items-center gap-2 rounded-xl border border-[var(--tertiary-container)]/50 bg-[var(--tertiary-container)]/15 px-3 py-2.5 text-sm font-semibold text-[var(--tertiary)]">
                <Icon name="check_circle" fill size={20} />
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="flex items-center gap-2 rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)] px-3 py-2.5 text-sm font-semibold text-[var(--on-surface)] transition-colors hover:border-[var(--primary)]"
              >
                <Icon
                  name={item.icon}
                  size={20}
                  className="text-[var(--primary)]"
                />
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Button type="button" variant="secondary" size="sm" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </section>
  );
}
