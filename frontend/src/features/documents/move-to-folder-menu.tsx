"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icon";

import type { FolderSummary } from "./types";

/**
 * Per-row "drive_file_move" button that opens a small popover listing the
 * user's folders. Clicking a folder calls `onMove(folderId)`; clicking
 * "Uncategorized" calls `onMove(null)`. Closes on outside click + Esc.
 *
 * Pure CSS popover — avoids dragging in a headless-ui dependency for a single
 * dropdown. The button is keyboard-focusable; arrow-key nav inside the menu
 * is browser-default (Tab).
 */
export function MoveToFolderMenu({
  folders,
  currentFolderId,
  onMove,
}: {
  folders: FolderSummary[];
  currentFolderId: string | null;
  onMove: (folderId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Move to folder"
        aria-haspopup="menu"
        aria-expanded={open}
        className="grid h-9 w-9 place-items-center rounded-lg text-[var(--outline)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--primary)]"
      >
        <Icon name="drive_file_move" size={18} />
      </button>

      {open ? (
        <div
          role="menu"
          className="tactile-card absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] shadow-lg"
        >
          <div className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--on-surface-variant)]">
            Move to
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onMove(null);
              setOpen(false);
            }}
            className={
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-container)]" +
              (currentFolderId === null
                ? " font-bold text-[var(--primary)]"
                : " text-[var(--on-surface)]")
            }
          >
            <Icon name="folder_off" size={18} />
            <span className="flex-1">Uncategorized</span>
            {currentFolderId === null ? (
              <Icon name="check" size={16} />
            ) : null}
          </button>
          {folders.length === 0 ? (
            <div className="px-3 py-3 text-xs text-[var(--on-surface-variant)]">
              No folders yet — create one from the Folders bar.
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto border-t border-[var(--outline-variant)]">
              {folders.map((f) => {
                const isCurrent = currentFolderId === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onMove(isCurrent ? null : f.id);
                      setOpen(false);
                    }}
                    className={
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--surface-container)]" +
                      (isCurrent
                        ? " font-bold text-[var(--primary)]"
                        : " text-[var(--on-surface)]")
                    }
                  >
                    <Icon name={f.icon ?? "folder"} size={18} />
                    <span className="flex-1 truncate">{f.name}</span>
                    {isCurrent ? <Icon name="check" size={16} /> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
