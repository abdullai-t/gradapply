import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-extrabold tracking-[0.08em] uppercase transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary-container)]/15 text-[var(--primary)] border border-[var(--primary-container)]/30",
        secondary:
          "bg-[var(--secondary-container)]/30 text-[var(--on-secondary-container)] border border-[var(--secondary-container)]/40",
        destructive:
          "bg-[var(--error-container)] text-[var(--on-error-container)] border border-[var(--error)]/30",
        outline:
          "border border-[var(--outline-variant)] text-[var(--on-surface-variant)] bg-transparent",
        success:
          "bg-[var(--tertiary-container)]/15 text-[var(--tertiary)] border border-[var(--tertiary-container)]/30",
        warning:
          "bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] dark:bg-[#2a1f10] dark:text-[#ffb554] dark:border-[#5c4a2a]",
        muted:
          "bg-[var(--surface-container)] text-[var(--on-surface-variant)] border border-[var(--outline-variant)]",
        urgent:
          "bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] dark:bg-[#2a1f10] dark:text-[#ffb554] dark:border-[#5c4a2a]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
