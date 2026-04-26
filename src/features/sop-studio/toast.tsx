"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/components/icon";

export type ToastSpec = {
  /** New id resets the auto-dismiss timer (so back-to-back toasts work). */
  id: string;
  message: string;
  /** Optional Undo button. Omit for purely informational toasts. */
  undo?: () => void;
  /** Override default 6s lifetime. */
  ttlMs?: number;
};

type Props = {
  toast: ToastSpec | null;
  onDismiss: () => void;
};

/**
 * Floating bottom-right toast for the SOP studio. Lives inside the editor
 * column so it doesn't conflict with global notifications.
 *
 * Lifecycle: appears with a fade+rise, sits for `ttlMs` (default 6s), then
 * fades and self-dismisses. Clicking Undo dismisses immediately and runs
 * the supplied callback. New toasts replace old ones (last-write-wins).
 */
export function StudioToast({ toast, onDismiss }: Props) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!toast) {
      setClosing(false);
      return;
    }
    setClosing(false);
    const ttl = toast.ttlMs ?? 6000;
    const fadeAt = setTimeout(() => setClosing(true), ttl - 220);
    const dismissAt = setTimeout(() => onDismiss(), ttl);
    return () => {
      clearTimeout(fadeAt);
      clearTimeout(dismissAt);
    };
    // toast.id is what makes a "new toast" reset the timers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast?.id]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-3 shadow-2xl ${
        closing ? "studio-toast-out" : "studio-toast-in"
      }`}
      style={{ minWidth: 260, maxWidth: 380 }}
    >
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--primary-container)] text-[var(--on-primary-container)]">
        <Icon name="check_circle" size={18} fill />
      </div>
      <div className="pointer-events-auto flex-1 text-sm text-[var(--on-surface)]">
        {toast.message}
      </div>
      {toast.undo ? (
        <button
          type="button"
          onClick={() => {
            toast.undo?.();
            onDismiss();
          }}
          className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container)] px-2.5 py-1 text-xs font-bold text-[var(--on-surface)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-container)]/40"
        >
          <Icon name="undo" size={12} />
          Undo
        </button>
      ) : null}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="pointer-events-auto grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--outline)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--on-surface)]"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
