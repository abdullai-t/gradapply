"use client";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export interface StreakCardProps {
  /** Total active days in the current streak. */
  streakDays: number;
  /** Goal in days for current streak (visual only). */
  goalDays?: number;
  /** Bitmap of the last 7 days (Sun..Sat) — true = active. Today is the entry at JS Date.getDay(). */
  weekActivity?: boolean[];
  /** Index of "today" within `weekActivity` (Date.getDay()). */
  todayIndex?: number;
  /** Compact single-row layout for below-the-fold placement. */
  compact?: boolean;
}

/**
 * StreakCard — gamification card that mirrors the design's 7-day tracker.
 * `weekActivity` is derived server-side from the new `UserActivityDay` model
 * (or falls back to all-false when the user has no recorded activity yet).
 */
export function StreakCard({
  streakDays,
  goalDays = 15,
  weekActivity,
  todayIndex,
  compact = false,
}: StreakCardProps) {
  const today = todayIndex ?? new Date().getDay();
  const week = Array.from({ length: 7 }, (_, i) => weekActivity?.[i] ?? false);
  const hasWeekActivity = week.some(Boolean);

  if (!compact && streakDays === 0 && !hasWeekActivity) {
    return null;
  }

  return (
    <div
      className={cn(
        "tactile-card flex flex-col rounded-3xl border-2 border-[var(--outline-variant)]",
        compact ? "gap-4 p-4" : "gap-7 p-6",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <div
            className={cn(
              "grid shrink-0 place-items-center rounded-2xl border-2 border-[#fed7aa] bg-[var(--streak-orange-soft)] dark:border-[#5c4a2a]",
              compact ? "h-12 w-12" : "h-16 w-16",
            )}
          >
            <Icon
              name="local_fire_department"
              fill
              className="flame"
              size={compact ? 26 : 34}
            />
          </div>
          <div className="flex flex-col justify-center gap-1.5">
            <div
              className={cn(
                "font-extrabold leading-none tracking-tight text-[var(--on-surface)]",
                compact ? "text-lg" : "text-2xl",
              )}
            >
              {streakDays} {streakDays === 1 ? "Day" : "Days"} streak
            </div>
            <div className="text-[11px] font-extrabold uppercase leading-none tracking-[0.1em] text-[var(--outline)]">
              Activity this week · goal {goalDays} days
            </div>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-7 gap-3 rounded-3xl border border-[var(--surface-container)] bg-[color-mix(in_srgb,var(--surface-container-low)_50%,transparent)]",
          compact ? "p-3" : "p-4",
        )}
      >
        {DAY_LABELS.map((label, i) => (
          <StreakDay
            key={label}
            label={label}
            done={week[i] === true}
            isToday={i === today}
            delay={0.3 + i * 0.07}
          />
        ))}
      </div>
    </div>
  );
}

function StreakDay({
  label,
  done,
  isToday,
  delay,
}: {
  label: string;
  done: boolean;
  isToday: boolean;
  delay: number;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className={cn(
          "text-[10px] font-extrabold tracking-[0.05em]",
          isToday
            ? "text-[var(--primary)]"
            : done
              ? "text-[var(--on-surface-variant)]"
              : "text-[var(--outline-variant)]",
        )}
      >
        {label}
      </span>
      <div
        className="fill-up grid h-11 w-11 place-items-center rounded-full"
        style={{
          background: done
            ? "var(--primary)"
            : isToday
              ? "color-mix(in srgb, var(--primary-container) 30%, transparent)"
              : "var(--surface-container)",
          boxShadow: done ? "var(--tactile-primary)" : "none",
          border: isToday
            ? "2px dashed var(--primary)"
            : done
              ? "none"
              : "2px solid var(--outline-variant)",
          animationDelay: `${delay}s`,
        }}
      >
        {done ? (
          <Icon name="check" fill style={{ color: "#fff" }} size={20} />
        ) : isToday ? (
          <Icon
            name="play_arrow"
            fill
            className="bob"
            style={{ color: "var(--primary)" }}
            size={18}
          />
        ) : null}
      </div>
    </div>
  );
}
