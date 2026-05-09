import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Light glass panel — frosted surface for subtle floating elements.
 * Use for sticky headers, side rails, AI-insight cards over busy backgrounds.
 */
export const GlassPanel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function GlassPanel({ className, ...props }, ref) {
  return (
    <div ref={ref} className={cn("glass-panel p-6", className)} {...props} />
  );
});
