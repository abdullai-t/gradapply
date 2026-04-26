import * as React from "react";
import { cn } from "@/lib/utils";

export type IconProps = {
  /** Material Symbols Outlined name, e.g. "school", "calendar_today", "smart_toy". */
  name: string;
  /** Render the filled variant. */
  fill?: boolean;
  /** Pixel size (sets font-size); defaults to 20. */
  size?: number;
  /** Variation weight, 100..700. Defaults to 400 (or 500 when filled). */
  weight?: number;
  /** Hide from screen readers (decorative). Defaults to true. */
  decorative?: boolean;
  /** Optional accessible label when not decorative. */
  label?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "aria-label" | "aria-hidden">;

/**
 * Material Symbols Outlined wrapper. Single source of truth for app icons.
 *
 * Usage: <Icon name="school" /> · <Icon name="check" fill /> · <Icon name="alarm" size={28} />
 */
export const Icon = React.forwardRef<HTMLSpanElement, IconProps>(function Icon(
  {
    name,
    fill = false,
    size = 20,
    weight,
    decorative = true,
    label,
    className,
    style,
    ...rest
  },
  ref,
) {
  const w = weight ?? (fill ? 500 : 400);
  return (
    <span
      ref={ref}
      className={cn(
        "material-symbols-outlined select-none align-middle leading-none",
        className,
      )}
      style={{
        fontSize: `${size}px`,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${w}, 'GRAD' 0, 'opsz' ${Math.min(48, Math.max(20, size))}`,
        ...style,
      }}
      aria-hidden={decorative ? true : undefined}
      aria-label={!decorative ? label : undefined}
      role={!decorative ? "img" : undefined}
      {...rest}
    >
      {name}
    </span>
  );
});
