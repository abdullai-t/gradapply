"use client";

import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";

export type ChatMode = "general" | "grammar" | "sop" | "email" | "feedback";

const MODES: { id: ChatMode; label: string; icon: string }[] = [
  { id: "general", label: "General", icon: "smart_toy" },
  { id: "grammar", label: "Grammar", icon: "spellcheck" },
  { id: "sop", label: "SOP editor", icon: "edit_note" },
  { id: "email", label: "Email", icon: "mail" },
  { id: "feedback", label: "Feedback", icon: "psychology_alt" },
];

/**
 * Pill bar that switches between the 5 chat modes. Each mode owns its own
 * server-side history (see `/api/chat?mode=…`), so swapping is just a state
 * change.
 */
export function AgentChips({
  value,
  onChange,
}: {
  value: ChatMode;
  onChange: (m: ChatMode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Assistant mode"
      className="flex flex-wrap gap-2 overflow-x-auto"
    >
      {MODES.map((m) => {
        const active = value === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-all",
              active
                ? "bg-[var(--primary-container)] text-[var(--on-primary-container)] [box-shadow:0_2px_0_0_rgba(0,98,157,0.25)]"
                : "border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]",
            )}
          >
            <Icon name={m.icon} fill={active} size={18} />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
