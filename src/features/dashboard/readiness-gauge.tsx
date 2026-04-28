"use client";

import { CountUp } from "./count-up";

export function ReadinessGauge({ pct }: { pct: number }) {
  const safe = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="gauge-sweep relative grid h-48 w-48 shrink-0 place-items-center rounded-full"
      style={
        {
          "--gauge-pct": `${safe}%`,
          boxShadow: "inset 0 4px 12px rgba(0,0,0,0.08)",
        } as React.CSSProperties
      }
      aria-label={`Application readiness: ${safe} percent`}
      role="img"
    >
      <div className="flex h-[85%] w-[85%] flex-col items-center justify-center rounded-full bg-[var(--surface-container-lowest)] shadow-[0_6px_20px_rgba(0,0,0,0.06)]">
        <div className="text-5xl font-extrabold leading-none text-[var(--primary)]">
          <CountUp to={safe} suffix="%" duration={1400} delay={300} />
        </div>
        <div className="t-label-lg mt-1.5">Readiness</div>
      </div>
    </div>
  );
}
