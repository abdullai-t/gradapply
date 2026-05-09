import * as React from "react";
import { cn } from "@/lib/utils";

const SEAL_PALETTE = [
  "#0f4d92",
  "#8a1a1a",
  "#c1272d",
  "#003262",
  "#c41230",
  "#1f5100",
  "#004a77",
  "#5b21b6",
];

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return SEAL_PALETTE[Math.abs(hash) % SEAL_PALETTE.length] ?? "#004a77";
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return (parts[0]?.slice(0, 2) || "??").toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export interface SealAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** School/org name — drives initials and deterministic color. */
  name: string;
  /** Outer frame size in px. */
  size?: number;
  /** Override the seal color. */
  color?: string;
}

/**
 * Two-layer seal avatar — outer rounded frame on a tinted surface,
 * inner rounded color block with white initials. Used for school logos.
 */
export function SealAvatar({
  name,
  size = 64,
  color,
  className,
  style,
  ...props
}: SealAvatarProps) {
  const c = color ?? pickColor(name);
  const inner = Math.round(size * 0.625);
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-low)]",
        className,
      )}
      style={{ width: size, height: size, ...style }}
      aria-hidden
      {...props}
    >
      <div
        className="grid place-items-center rounded-xl text-white font-extrabold tracking-tight"
        style={{
          width: inner,
          height: inner,
          background: c,
          fontSize: Math.round(inner * 0.42),
        }}
      >
        {initials(name)}
      </div>
    </div>
  );
}
