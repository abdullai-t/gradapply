import Link from "next/link";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import type { UpcomingDeadlineRow } from "./compute";

type Props = {
  rows: UpcomingDeadlineRow[];
};

export function UpcomingDeadlinesList({ rows }: Props) {
  if (rows.length === 0) return null;

  return (
    <section className="tactile-card rounded-3xl border border-[var(--outline-variant)] p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="m-0 text-base font-bold text-[var(--on-surface)]">
          Upcoming deadlines
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link href="/timeline">View timeline</Link>
        </Button>
      </div>
      <ul className="m-0 list-none divide-y divide-[var(--outline-variant)] p-0">
        {rows.map((row) => (
          <li key={row.id}>
            <Link
              href={`/schools/${row.id}`}
              className="flex flex-wrap items-center justify-between gap-2 py-3 transition-colors hover:bg-[var(--surface-container-low)]/50"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-[var(--on-surface)]">
                  {row.name}
                </div>
                <div className="truncate text-xs text-[var(--on-surface-variant)]">
                  {row.program}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-right">
                <span
                  className={
                    row.overdue
                      ? "text-xs font-bold text-[var(--error)]"
                      : row.daysUntil <= 14
                        ? "text-xs font-bold text-[var(--streak-orange)]"
                        : "text-xs font-semibold text-[var(--on-surface-variant)]"
                  }
                >
                  {row.overdue
                    ? "Overdue"
                    : row.daysUntil === 0
                      ? "Due today"
                      : `In ${row.daysUntil}d`}
                </span>
                <span className="text-xs font-bold text-[var(--on-surface)]">
                  {format(row.deadline, "MMM d")}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
