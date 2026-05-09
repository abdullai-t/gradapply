import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * TactileCard — the signature card surface with hard offset shadow + hover lift.
 * Equivalent to <Card variant="tactile">, exposed standalone for ergonomics.
 */
export const TactileCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(function TactileCard({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      className={cn("tactile-card p-6", className)}
      {...props}
    />
  );
});
