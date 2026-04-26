"use client";

import { Icon } from "@/components/icon";

/**
 * AI bubble — speech-bubble card with auto_awesome avatar to the left,
 * tactile shadow underneath, and bottom-left corner squared off.
 */
export function AIBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-[85%] gap-3.5">
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
        style={{
          background: "var(--primary)",
          boxShadow: "0 6px 16px -4px rgba(0,98,157,0.4)",
        }}
      >
        <Icon name="auto_awesome" fill size={22} className="text-white" />
      </div>
      <div className="flex flex-col gap-2.5">
        <div
          className="rounded-2xl rounded-bl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-5 py-4 text-[15px] leading-relaxed text-[var(--on-surface)]"
          style={{ boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * User bubble — primary-tinted on the right, with a primary-fixed avatar.
 */
export function UserBubble({
  initials,
  children,
}: {
  initials: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex max-w-[85%] flex-row-reverse items-start gap-3.5 self-end">
      <div
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-sm font-extrabold"
        style={{
          background:
            "linear-gradient(135deg, var(--primary-fixed), var(--primary-fixed-dim))",
          borderColor: "var(--primary-container)",
          color: "var(--primary)",
        }}
      >
        {initials || "?"}
      </div>
      <div className="flex flex-col items-end gap-2.5">
        <div
          className="rounded-2xl rounded-br border border-[var(--primary-container)]/30 bg-[var(--primary-container)] px-5 py-4 text-[15px] leading-relaxed text-[var(--on-primary-container)]"
          style={{ boxShadow: "0 4px 12px rgba(0, 163, 255, 0.15)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
