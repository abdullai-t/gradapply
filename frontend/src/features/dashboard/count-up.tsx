"use client";

import * as React from "react";

interface CountUpProps {
  to: number;
  suffix?: string;
  duration?: number;
  delay?: number;
  className?: string;
  decimals?: number;
}

/**
 * Animated number ticker — eases from 0 to `to` over `duration` ms.
 * Honors prefers-reduced-motion (renders the final value immediately).
 */
export function CountUp({
  to,
  suffix = "",
  duration = 1200,
  delay = 0,
  className,
  decimals = 0,
}: CountUpProps) {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(to);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const elapsed = Math.max(0, now - start);
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, delay]);

  const display =
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
  return (
    <span className={className}>
      {display}
      {suffix}
    </span>
  );
}
