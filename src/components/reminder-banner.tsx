"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

type ReminderSchool = {
  id: string;
  name: string;
  reminderAt: string | null;
  reminderNote: string | null;
};

export function ReminderBanner() {
  const [items, setItems] = useState<ReminderSchool[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const res = await fetch("/api/reminders");
      if (!res.ok || !active) return;
      const data = (await res.json()) as ReminderSchool[];
      if (!active) return;
      setItems(data);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const banner = useMemo(() => {
    const reminders = items
      .filter((i) => i.reminderAt != null)
      .map((i) => ({ ...i, at: new Date(i.reminderAt!) }))
      .sort((a, b) => a.at.getTime() - b.at.getTime());

    if (reminders.length === 0) return null;

    const now = Date.now();
    const overdue = reminders.filter((r) => r.at.getTime() < now);
    const upcoming = reminders.filter((r) => r.at.getTime() >= now);

    if (overdue.length > 0) {
      const oldest = overdue[0]!;
      const extra = overdue.length - 1;
      return {
        tone: "warn" as const,
        text:
          overdue.length === 1
            ? `1 reminder is overdue`
            : `${overdue.length} reminders are overdue`,
        schoolDetail:
          overdue.length === 1
            ? oldest.name
            : `Oldest: ${oldest.name}${extra > 0 ? ` (+${extra} more)` : ""}`,
      };
    }

    const next = upcoming[0]!;
    return {
      tone: "normal" as const,
      text: `Next reminder: ${format(next.at, "EEE, MMM d")}`,
      schoolDetail: next.name,
    };
  }, [items]);

  if (!banner || dismissed) return null;

  return (
    <div
      className={cn(
        "mx-6 mt-4 flex flex-col gap-3 rounded-2xl border-2 px-4 py-3 sm:flex-row sm:items-center md:mx-8",
        banner.tone === "warn"
          ? "border-[var(--error)]/30 bg-[var(--error-container)] text-[var(--on-error-container)]"
          : "border-[var(--streak-orange)]/40 bg-[var(--streak-orange-soft)] text-[#7a3a08] dark:text-[var(--streak-orange)]",
      )}
      role="status"
    >
      <Icon
        name="notifications_active"
        fill
        className={
          banner.tone === "warn"
            ? "text-[var(--error)]"
            : "text-[var(--streak-orange)]"
        }
        size={20}
      />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-bold">{banner.text}</span>
        <span className="opacity-80"> — {banner.schoolDetail}</span>
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Button size="sm" variant="secondary" asChild>
          <Link href="/timeline">Open timeline</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss reminder banner"
          icon="close"
        />
      </div>
    </div>
  );
}
