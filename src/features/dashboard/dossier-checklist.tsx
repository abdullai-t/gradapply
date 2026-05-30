import Link from "next/link";

import { Icon } from "@/components/icon";
import type { DossierGap } from "./compute";

type Props = {
  pct: number;
  gaps: DossierGap[];
};

export function DossierChecklist({ pct, gaps }: Props) {
  const missing = gaps.filter((g) => !g.done).slice(0, 4);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <p className="m-0 text-xs leading-relaxed text-[var(--on-surface-variant)]">
        Readiness reflects your profile, schools, and documents. Complete the
        items below to reach 100%.
      </p>
      {missing.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {missing.map((gap) => (
            <li key={gap.label}>
              <Link
                href={gap.href}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-1.5 text-xs font-bold text-[var(--primary)] transition-colors hover:border-[var(--primary)]"
              >
                <Icon name="add_circle" size={14} />
                {gap.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm font-semibold text-[var(--tertiary)]">
          Dossier looks complete — keep deadlines and materials current.
        </p>
      )}
      <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--outline)]">
        {pct}% readiness
      </p>
    </div>
  );
}
