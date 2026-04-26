"use client";

import { Icon } from "@/components/icon";
import { useChatStats } from "@/features/assistant/api";

const MODE_META: Record<string, { label: string; icon: string }> = {
  general: { label: "General", icon: "chat" },
  grammar: { label: "Grammar", icon: "spellcheck" },
  sop: { label: "SOP", icon: "edit_note" },
  email: { label: "Email", icon: "mail" },
  feedback: { label: "Feedback", icon: "reviews" },
};

/**
 * Right-rail widget on /assistant. Surfaces a 7-day activity sparkline,
 * total user-authored words, mode distribution, and current writing streak.
 *
 * Driven by `useChatStats` from `src/features/assistant/api.ts`. The
 * `useSendMessage` mutation invalidates the same query key, so this
 * widget refreshes automatically after every send — no manual prop
 * threading required.
 */
export function WritingStatsAside() {
  const { data: stats, error } = useChatStats();

  if (error) {
    return (
      <aside className="rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5 text-sm text-[var(--on-surface-variant)]">
        {error instanceof Error ? error.message : "Could not load stats."}
      </aside>
    );
  }

  if (!stats) {
    return (
      <aside className="rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
        <h3 className="t-label-lg m-0 text-[var(--on-surface)]">
          Writing stats
        </h3>
        <div className="mt-3 h-32 animate-pulse rounded-2xl bg-[var(--surface-container)]" />
      </aside>
    );
  }

  const total7d = stats.userMessages7d;
  const peak = Math.max(1, ...stats.days7d.map((d) => d.count));
  const modes = Object.entries(stats.totalsByMode)
    .map(([k, v]) => ({ key: k, count: v }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const grandTotal = modes.reduce((s, m) => s + m.count, 0);

  return (
    <aside className="flex flex-col gap-5 rounded-3xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-5">
      <header className="flex items-center justify-between">
        <h3 className="t-label-lg m-0 text-[var(--on-surface)]">
          Writing stats
        </h3>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
          last 7 days
        </span>
      </header>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon="local_fire_department"
          label="Day streak"
          value={String(stats.dayStreak)}
          accent="var(--streak-orange)"
        />
        <StatTile
          icon="bar_chart"
          label="Messages"
          value={String(total7d)}
          accent="var(--primary)"
        />
        <StatTile
          icon="format_quote"
          label="Words"
          value={formatCompact(stats.words7d)}
          accent="var(--tertiary)"
        />
        <StatTile
          icon="calendar_month"
          label="30-day"
          value={String(stats.userMessages30d)}
          accent="var(--secondary)"
        />
      </div>

      {/* Sparkline */}
      <div>
        <div className="mb-1.5 flex items-end justify-between text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
          <span>Activity</span>
          {total7d === 0 ? <span>No messages yet</span> : null}
        </div>
        <div
          className="flex h-20 items-end justify-between gap-1.5 rounded-xl bg-[var(--surface-container)] px-3 py-2"
          aria-hidden
        >
          {stats.days7d.map((d) => {
            const h = (d.count / peak) * 100;
            return (
              <div
                key={d.date}
                className="w-2 shrink-0 rounded-sm transition-all sm:w-2.5"
                style={{
                  height: `${Math.max(h, d.count > 0 ? 12 : 6)}%`,
                  background:
                    d.count > 0
                      ? "var(--primary)"
                      : "var(--surface-container-high)",
                }}
                title={`${d.date}: ${d.count} ${d.count === 1 ? "message" : "messages"}`}
              />
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-[var(--on-surface-variant)]">
          {stats.days7d.map((d, i) => (
            <span key={d.date}>
              {i === 0 || i === stats.days7d.length - 1
                ? new Date(d.date).toLocaleDateString(undefined, {
                    weekday: "short",
                  })
                : ""}
            </span>
          ))}
        </div>
      </div>

      {/* Mode distribution */}
      <div>
        <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
          By agent
        </div>
        {modes.length === 0 ? (
          <p className="m-0 text-xs text-[var(--on-surface-variant)]">
            Send your first message to see a breakdown.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {modes.map((m) => {
              const meta = MODE_META[m.key] ?? {
                label: m.key.charAt(0).toUpperCase() + m.key.slice(1),
                icon: "chat",
              };
              const pct = grandTotal === 0 ? 0 : (m.count / grandTotal) * 100;
              return (
                <li key={m.key} className="flex items-center gap-2.5 text-sm">
                  <Icon
                    name={meta.icon}
                    size={16}
                    className="shrink-0 text-[var(--on-surface-variant)]"
                  />
                  <span className="w-16 shrink-0 truncate font-bold text-[var(--on-surface)]">
                    {meta.label}
                  </span>
                  <div className="flex-1 overflow-hidden rounded-full bg-[var(--surface-container)]">
                    <div
                      className="h-1.5 rounded-full bg-[var(--primary)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-7 shrink-0 text-right text-xs font-bold tabular-nums text-[var(--on-surface-variant)]">
                    {m.count}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function StatTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container)] p-3"
      style={{ borderBottom: `3px solid ${accent}` }}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
        <Icon name={icon} size={14} style={{ color: accent }} />
        {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--on-surface)] tabular-nums">
        {value}
      </div>
    </div>
  );
}

function formatCompact(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
