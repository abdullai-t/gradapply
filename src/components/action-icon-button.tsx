"use client";

import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  /** Accessible name (required for icon-only controls). */
  label: string;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  variant?: "ghost" | "outline" | "secondary";
};

/** Icon-only action with built-in loading spinner (delete, etc.). */
export function ActionIconButton({
  label,
  icon = "delete",
  loading,
  disabled,
  onClick,
  className,
  variant = "ghost",
}: Props) {
  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      loading={loading}
      disabled={disabled}
      aria-label={label}
      icon={loading ? undefined : icon}
      onClick={onClick}
      className={cn(className)}
    />
  );
}
