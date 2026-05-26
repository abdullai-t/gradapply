import { cn } from "@/lib/utils";

import { Icon } from "./icon";

type Props = {
  /** Discovery fit score 1–5; omit or null when not scored yet. */
  score: number | null | undefined;
  className?: string;
  /** "fit" (school hub) vs "match" (emails discovery copy). */
  label?: "fit" | "match";
};

const TONE: Record<"high" | "mid" | "low" | "none", string> = {
  high: "bg-[var(--tertiary-fixed)]/50 text-[var(--tertiary)] border-[var(--tertiary)]/25",
  mid: "bg-[var(--primary-fixed)] text-[var(--primary)] border-[var(--primary-container)]/30",
  low: "bg-[#fff7ed] text-[#c2410c] border-[#fed7aa] dark:bg-[#2a1f10] dark:text-[var(--streak-orange)] dark:border-[#5c4a2a]",
  none: "bg-[var(--surface-container)] text-[var(--outline)] border-[var(--outline-variant)]",
};

function toneForScore(score: number): keyof typeof TONE {
  if (score >= 4) return "high";
  if (score >= 3) return "mid";
  return "low";
}

/**
 * Compact pill for professor discovery fit (1–5 scale).
 */
export function FitScoreBadge({
  score,
  className,
  label = "fit",
}: Props) {
  if (score == null || !Number.isFinite(score)) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em]",
          TONE.none,
          className,
        )}
      >
        No fit score
      </span>
    );
  }

  const clamped = Math.max(1, Math.min(5, Math.round(score)));
  const word = label === "match" ? "Match" : "Fit";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.06em]",
        TONE[toneForScore(clamped)],
        className,
      )}
      title={`${word} score ${clamped} out of 5`}
    >
      <Icon name="target" size={12} aria-hidden />
      {word} {clamped}/5
    </span>
  );
}

/**
 * Five-segment meter for list rows (school hub).
 */
export function FitScoreMeter({
  score,
  className,
}: {
  score: number | null | undefined;
  className?: string;
}) {
  if (score == null || !Number.isFinite(score)) return null;
  const clamped = Math.max(1, Math.min(5, Math.round(score)));

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      aria-label={`Fit score ${clamped} out of 5`}
      role="img"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-3 rounded-full",
            i < clamped
              ? clamped >= 4
                ? "bg-[var(--tertiary)]"
                : clamped >= 3
                  ? "bg-[var(--primary)]"
                  : "bg-[var(--streak-orange)]"
              : "bg-[var(--surface-container-high)]",
          )}
        />
      ))}
    </div>
  );
}
