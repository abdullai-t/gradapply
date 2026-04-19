import type { ReactNode } from "react";

import { BrandLogoMark } from "@/components/brand-logo";
import { cn } from "@/lib/utils";

type GlassSceneProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Full-viewport mesh gradient + floating blurs for glassmorphism surfaces.
 */
export function GlassScene({ children, className }: GlassSceneProps) {
  return (
    <div
      className={cn(
        "relative min-h-screen overflow-hidden bg-[hsl(230_35%_7%)] text-foreground",
        className,
      )}
    >
      <div className="pointer-events-none fixed inset-0 -z-10">
        {/* Base wash */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(230_40%_8%)] via-[hsl(235_38%_10%)] to-[hsl(245_32%_12%)]" />
        {/* Highlights */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_40%_-10%,hsl(var(--primary)/0.28),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_100%_35%,hsl(var(--primary)/0.14),transparent_52%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_45%_at_10%_85%,hsl(275_55%_45%/0.18),transparent_50%)]" />
        {/* Soft orbs */}
        <div className="absolute -left-[12%] top-[8%] h-[min(42vw,380px)] w-[min(42vw,380px)] rounded-full bg-primary/20 blur-[100px] motion-reduce:animate-none animate-glass-drift" />
        <div className="absolute -right-[8%] bottom-[12%] h-[min(38vw,340px)] w-[min(38vw,340px)] rounded-full bg-[hsl(265_70%_50%/0.2)] blur-[110px] motion-reduce:animate-none animate-glass-drift-reverse" />
        <div className="absolute left-1/2 top-1/2 h-[min(55vw,480px)] w-[min(55vw,480px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.1] blur-[130px]" />
        {/* Fine grid */}
        <div
          className="absolute inset-0 opacity-[0.22]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground) / 0.04) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.04) 1px, transparent 1px)`,
            backgroundSize: "48px 48px",
          }}
        />
      </div>
      {children}
    </div>
  );
}

export function GlassBrandMark({
  className,
  compact,
}: {
  className?: string;
  /** Hide tagline (e.g. auth screens). */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3",
        className,
      )}
    >
      <BrandLogoMark
        size={48}
        className="h-12 w-12 shrink-0 rounded-2xl shadow-[0_8px_32px_hsl(var(--primary)/0.45)] ring-1 ring-white/25 dark:ring-white/15"
      />
      <div className="text-left">
        <div className="font-display text-xl font-semibold tracking-tight">
          GradApply
        </div>
        {!compact ? (
          <div className="text-xs font-medium text-muted-foreground">
            Application companion
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Lighter gradient for logged-in shell (sidebar + content). */
export function MainShellBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(230_40%_7%)] via-[hsl(235_38%_9%)] to-[hsl(232_36%_11%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_85%_65%_at_75%_-5%,hsl(var(--primary)/0.18),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_5%_95%,hsl(275_50%_40%/0.12),transparent_48%)]" />
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: `linear-gradient(hsl(40 20% 98% / 0.06) 1px, transparent 1px), linear-gradient(90deg, hsl(40 20% 98% / 0.06) 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
}
