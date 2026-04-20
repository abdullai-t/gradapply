"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
        "mx-4 mt-4 flex flex-col gap-3 rounded-xl border px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3 md:mx-10",
        banner.tone === "warn"
          ? "border-red-500/40 bg-red-950/25"
          : "border-amber-500/35 bg-amber-500/10",
      )}
    >
      <Bell
        className={cn(
          "h-4 w-4 shrink-0 sm:mt-0.5",
          banner.tone === "warn" ? "text-red-200" : "text-amber-200",
        )}
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium">{banner.text}</span>
        <span className="text-muted-foreground">
          {" "}
          — {banner.schoolDetail}
        </span>
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        <Button size="sm" variant="outline" className="h-8 border-dashed" asChild>
          <Link href="/timeline">Open timeline</Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss reminder banner"
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
