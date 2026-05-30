import Link from "next/link";

import { Button } from "@/components/ui/button";

type Props = {
  activeCount: number;
  materialsDone: number;
  materialsTotal: number;
  lettersDone: number;
  lettersTotal: number;
};

export function AggregateTrackerProgress({
  activeCount,
  materialsDone,
  materialsTotal,
  lettersDone,
  lettersTotal,
}: Props) {
  if (activeCount === 0) return null;

  const matPct =
    materialsTotal > 0
      ? Math.round((materialsDone / materialsTotal) * 100)
      : 0;
  const letterPct =
    lettersTotal > 0 ? Math.round((lettersDone / lettersTotal) * 100) : 0;

  return (
    <section className="tactile-card rounded-3xl border border-[var(--outline-variant)] p-5">
      <h2 className="m-0 text-base font-bold text-[var(--on-surface)]">
        Application progress
      </h2>
      <p className="m-0 mt-1 text-xs text-[var(--on-surface-variant)]">
        Across {activeCount} active{" "}
        {activeCount === 1 ? "school" : "schools"} on your list.
      </p>
      <div className="mt-5 space-y-4">
        <ProgressRow
          label="Required materials"
          done={materialsDone}
          total={materialsTotal}
          pct={matPct}
        />
        <ProgressRow
          label="Letters of recommendation"
          done={lettersDone}
          total={lettersTotal}
          pct={letterPct}
        />
      </div>
      <Button asChild variant="secondary" size="sm" className="mt-4">
        <Link href="/schools">Open schools</Link>
      </Button>
    </section>
  );
}

function ProgressRow({
  label,
  done,
  total,
  pct,
}: {
  label: string;
  done: number;
  total: number;
  pct: number;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-semibold text-[var(--on-surface)]">{label}</span>
        <span className="font-bold text-[var(--on-surface-variant)]">
          {total > 0 ? `${done}/${total}` : "Not started"}
        </span>
      </div>
      {total > 0 ? (
        <div
          className="h-2 overflow-hidden rounded-full bg-[var(--surface-container)]"
          role="progressbar"
          aria-valuenow={done}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div
            className="h-full rounded-full bg-[var(--tertiary)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="h-2 rounded-full bg-[var(--surface-container)]" />
      )}
    </div>
  );
}
