import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const progressTrackVariants = cva(
  "relative w-full overflow-hidden rounded-full bg-[var(--surface-container-high)]",
  {
    variants: {
      size: {
        sm: "h-1.5",
        default: "h-2.5",
        lg: "h-3",
      },
    },
    defaultVariants: { size: "default" },
  },
);

const progressFillVariants = cva("h-full transition-[width] duration-500 ease-out", {
  variants: {
    tone: {
      primary:
        "bg-gradient-to-r from-[var(--primary)] to-[var(--primary-container)]",
      tertiary:
        "bg-gradient-to-r from-[var(--tertiary)] to-[var(--tertiary-container)]",
      secondary:
        "bg-gradient-to-r from-[var(--secondary)] to-[var(--secondary-fixed-dim)]",
      warning: "bg-[var(--streak-orange)]",
      destructive: "bg-[var(--error)]",
    },
  },
  defaultVariants: { tone: "primary" },
});

interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof progressTrackVariants>,
    VariantProps<typeof progressFillVariants> {
  value?: number | null;
}

function Progress({
  className,
  value,
  size,
  tone,
  ...props
}: ProgressProps) {
  const v = Math.min(100, Math.max(0, value ?? 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(progressTrackVariants({ size }), className)}
      {...props}
    >
      <div
        className={cn(progressFillVariants({ tone }))}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export { Progress };
