"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

export interface DailyMissionProps {
  /** Title of the suggested next action. */
  title: string;
  /** Supporting copy explaining why this is the mission today. */
  body: string;
  /** Where the CTA navigates (e.g. /schools, /emails). */
  href: string;
  /** CTA label (defaults to "Start mission"). */
  cta?: string;
}

/**
 * Daily Mission — gradient-blue card with shine-sweep, aura pulse, and CTA.
 * The mission is derived server-side: top open task = nearest deadline /
 * stalest draft / empty profile field, in priority order.
 */
export function DailyMission({
  title,
  body,
  href,
  cta = "Start mission",
}: DailyMissionProps) {
  return (
    <div
      className="aura shine-sweep tactile-card relative flex min-h-[280px] flex-col justify-between overflow-hidden rounded-3xl p-8 text-white"
      style={{
        background: "linear-gradient(135deg, var(--primary), #004a77)",
        borderBottom: "8px solid #003354",
        borderColor: "transparent",
      }}
    >
      {/* Decorative blobs */}
      <div
        className="float-blob pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full"
        style={{
          background: "rgba(0,163,255,0.35)",
          filter: "blur(60px)",
        }}
        aria-hidden
      />
      <div
        className="float-blob pointer-events-none absolute -left-8 top-0 h-30 w-30 rounded-full"
        style={{
          background: "rgba(255,255,255,0.1)",
          filter: "blur(40px)",
          animationDelay: "1.5s",
          width: "120px",
          height: "120px",
        }}
        aria-hidden
      />

      <div className="relative">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-[10px] font-extrabold tracking-[0.2em] backdrop-blur-md">
          <span
            className="dot-blink h-2 w-2 rounded-full bg-white"
            aria-hidden
          />
          DAILY MISSION
        </span>
        <h2 className="m-0 text-[1.75rem] font-extrabold leading-[1.15]">
          {title}
        </h2>
        <p className="mt-2.5 text-[15px] leading-[1.55] text-white/85">
          {body}
        </p>
      </div>

      <Link
        href={href}
        className="relative mt-6 flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-4 text-[15px] font-extrabold text-[var(--primary)] shadow-[0_8px_24px_rgba(0,0,0,0.2)] transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(0,0,0,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        {cta}
        <Icon name="arrow_forward" className="arrow-nudge" size={18} />
      </Link>
    </div>
  );
}
