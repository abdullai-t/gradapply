import { format } from "date-fns";

import { StatTile } from "@/components/stat-tile";
import { ReadinessGauge } from "./readiness-gauge";
import { DossierChecklist } from "./dossier-checklist";
import type { DossierGap } from "./compute";

type Props = {
  complete: number;
  gaps: DossierGap[];
  schoolCount: number;
  inProgress: number;
  accepted: number;
  nextDeadline: Date | null | undefined;
};

/** Gauge, dossier gaps, and linked stat tiles in one balanced card. */
export function DashboardReadinessPanel({
  complete,
  gaps,
  schoolCount,
  inProgress,
  accepted,
  nextDeadline,
}: Props) {
  return (
    <div className="tactile-card flex h-full min-h-0 flex-col gap-6 rounded-3xl border-2 border-[var(--outline-variant)] p-6 md:gap-8 md:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <ReadinessGauge pct={complete} />
        <DossierChecklist pct={complete} gaps={gaps} />
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-[var(--outline-variant)] pt-6">
        <StatTile
          icon="school"
          tone="primary"
          value={schoolCount}
          label="Schools saved"
          href="/schools"
          delay={0.3}
        />
        <StatTile
          icon="pending_actions"
          tone="tertiary"
          value={inProgress}
          label="In progress"
          href="/schools"
          delay={0.35}
        />
        <StatTile
          icon="event"
          tone="destructive"
          value={nextDeadline ? format(nextDeadline, "MMM d") : "—"}
          label="Next deadline"
          href="/timeline"
          delay={0.4}
        />
        <StatTile
          icon="history_edu"
          tone="primary"
          value={schoolCount > 0 ? `${accepted}/${schoolCount}` : "—"}
          label="Acceptances"
          href="/schools"
          delay={0.45}
        />
      </div>
    </div>
  );
}
