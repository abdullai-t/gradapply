import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/icon";

/**
 * Tactile button — the design system's signature press-down control.
 *
 * Variants follow Material 3 + the GradApply tactile shadow language.
 * Press behaviour is provided by the `.tactile` class (translateY + shadow drop).
 */
const buttonVariants = cva(
  [
    "tactile inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold",
    "rounded-xl ring-offset-background select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)] focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-60 disabled:saturate-50",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--primary)] text-[var(--on-primary)] shadow-tactile hover:brightness-105",
        secondary:
          "bg-[var(--surface-container-lowest)] text-[var(--primary)] border-2 border-[var(--primary)] shadow-tactile-active hover:bg-[var(--surface-container-low)]",
        outline:
          "bg-[var(--surface-container-lowest)] text-[var(--on-surface)] border border-[var(--outline-variant)] hover:bg-[var(--surface-container-low)] [box-shadow:0_2px_0_0_var(--outline-variant)]",
        ghost:
          "bg-transparent text-[var(--on-surface-variant)] [box-shadow:none] hover:bg-[var(--surface-container)]",
        link:
          "bg-transparent text-[var(--primary)] [box-shadow:none] underline-offset-4 hover:underline",
        destructive:
          "bg-[var(--error)] text-[var(--on-error)] shadow-tactile-error hover:brightness-105",
        // Legacy "default" for any callers we haven't migrated; alias of primary.
        default:
          "bg-[var(--primary)] text-[var(--on-primary)] shadow-tactile hover:brightness-105",
        // Glass variant used over busy backgrounds.
        glass:
          "glass-panel text-[var(--on-surface)] [box-shadow:none] hover:bg-[color-mix(in_srgb,var(--surface-container-lowest)_85%,transparent)]",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        default: "h-10 px-5 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Material Symbols icon name shown on the left. */
  icon?: string;
  /** Material Symbols icon name shown on the right. */
  iconRight?: string;
  /** Show a spinner and disable the button. */
  loading?: boolean;
  children?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      icon,
      iconRight,
      loading,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const iconSize = size === "lg" ? 22 : size === "sm" ? 16 : 18;
    const content = (
      <>
        {loading ? (
          <Loader2
            className="animate-spin"
            size={iconSize}
            aria-hidden
          />
        ) : icon ? (
          <Icon name={icon} size={iconSize} />
        ) : null}
        {/*
          inline-flex on the children wrapper so call sites that pass an icon
          element + text as JSX children (e.g. <Button><Send /> Send via Gmail</Button>)
          stay laid out horizontally. Tailwind's preflight applies `display:block`
          to <svg>, which would otherwise force the text onto a second line
          inside the span. gap-2 here mirrors the outer button spacing so a leading
          inline icon sits a consistent 8px from the label.
        */}
        {children ? (
          <span className="inline-flex items-center gap-2">{children}</span>
        ) : null}
        {!loading && iconRight ? (
          <Icon name={iconRight} size={iconSize} />
        ) : null}
      </>
    );
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {asChild ? (children as React.ReactElement) : content}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
