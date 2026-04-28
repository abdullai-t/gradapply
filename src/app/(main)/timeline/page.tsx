"use client";

import { ActiveReminderHero } from "@/features/timeline/active-reminder-hero";
import { MonthTimeline } from "@/features/timeline/month-timeline";
import { RemindersList } from "@/features/timeline/reminders-list";
import { TimelineAside } from "@/features/timeline/timeline-aside";
import { useClearReminder, useSchools } from "@/features/schools/api";
import { PageLoader } from "@/components/page-loader";
import type { TimelineSchool } from "@/features/timeline/types";

export default function TimelinePage() {
  const { data, isLoading } = useSchools({ sort: "timeline" });
  const clear = useClearReminder();
  const schools = (data ?? []) as TimelineSchool[];
  const handleClear = (id: string) => void clear.mutate(id);

  return (
    <div className="slide-in space-y-10 pb-8">
      <header>
        <h1 className="t-headline-lg m-0 text-[var(--on-surface)]">
          Timeline &amp; deadlines
        </h1>
        <p className="mt-1.5 text-[15px] text-[var(--on-surface-variant)]">
          Active reminders at the top, deadlines grouped by month, overdue
          highlighted.
        </p>
      </header>

      <ActiveReminderHero schools={schools} onClearReminder={handleClear} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          <RemindersList
            schools={schools}
            onClear={handleClear}
            loading={isLoading}
          />
          <section>
            <h2 className="t-headline-md m-0 mb-5 text-[var(--on-surface)]">
              Application journey
            </h2>
            {isLoading ? (
              <PageLoader label="Loading deadlines…" />
            ) : (
              <MonthTimeline schools={schools} />
            )}
          </section>
        </div>
        <aside>
          <TimelineAside schools={schools} />
        </aside>
      </div>
    </div>
  );
}
