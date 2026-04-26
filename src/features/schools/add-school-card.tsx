"use client";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

/**
 * Dashed-border placeholder card at the end of the schools grid — clicking it
 * opens the AddSchoolModal. Mirrors the FAB's affordance for users who would
 * sooner click a tile than chase a floating button.
 */
export function AddSchoolCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-2xl",
        "border-[3px] border-dashed border-[var(--outline-variant)]",
        "bg-transparent p-12 transition-all duration-200",
        "hover:border-[var(--primary-container)] hover:bg-[var(--primary-fixed)]/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-container)]",
      )}
      aria-label="Add a new school"
    >
      <div
        className={cn(
          "grid h-16 w-16 place-items-center rounded-full transition-colors duration-200",
          "bg-[var(--surface-container)] text-[var(--outline)]",
          "group-hover:bg-[var(--primary-container)]/20 group-hover:text-[var(--primary)]",
        )}
      >
        <Icon name="add_business" size={32} />
      </div>
      <div className="text-center">
        <div className="font-extrabold text-[var(--on-surface-variant)] transition-colors group-hover:text-[var(--primary)]">
          Add new school
        </div>
        <div className="mt-1 text-xs text-[var(--outline)]">
          Start your next application
        </div>
      </div>
    </button>
  );
}
