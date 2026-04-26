"use client";

import { useState } from "react";

import { Icon } from "@/components/icon";

import type { FolderSummary } from "./types";

/**
 * Folder taxonomy bar that lives between the Categories grid and the All-
 * documents table. Lets the user filter by folder, create new folders,
 * rename / delete existing ones.
 *
 * - Active filter pill is highlighted.
 * - "All documents" is the default state (no filter).
 * - "Uncategorized" filters to docs with `folderId = null`.
 * - Each folder pill has a hover-revealed kebab → rename / delete.
 */
export function FoldersBar({
  folders,
  active, // null = all, "none" = uncategorized, string = folder id
  onSelect,
  onCreate,
  onRename,
  onDelete,
  totalCount,
  uncategorizedCount,
}: {
  folders: FolderSummary[];
  active: string | "none" | null;
  onSelect: (next: string | "none" | null) => void;
  onCreate: (name: string) => Promise<void> | void;
  onRename: (id: string, name: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  totalCount: number;
  uncategorizedCount: number;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setAdding(false);
    setName("");
    setError(null);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      await onCreate(trimmed);
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create folder.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="t-label-lg m-0">Folders</h3>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.06em] text-[var(--on-surface-variant)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Icon name="create_new_folder" size={14} />
            New folder
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FolderChip
          icon="all_inbox"
          label="All documents"
          count={totalCount}
          active={active === null}
          onSelect={() => onSelect(null)}
        />
        <FolderChip
          icon="folder_off"
          label="Uncategorized"
          count={uncategorizedCount}
          active={active === "none"}
          onSelect={() => onSelect("none")}
        />
        {folders.map((f) => (
          <FolderChip
            key={f.id}
            icon={f.icon ?? "folder"}
            label={f.name}
            count={f.count}
            active={active === f.id}
            onSelect={() => onSelect(f.id)}
            onRename={async (next) => {
              await onRename(f.id, next);
            }}
            onDelete={async () => {
              await onDelete(f.id);
            }}
          />
        ))}
        {adding ? (
          <div className="flex items-center gap-2 rounded-full border-2 border-dashed border-[var(--primary)] bg-[var(--primary-container)]/40 px-3 py-1.5">
            <Icon
              name="folder"
              size={16}
              style={{ color: "var(--primary)" }}
            />
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
                if (e.key === "Escape") reset();
              }}
              maxLength={60}
              placeholder="Folder name"
              className="w-32 bg-transparent text-sm font-bold tracking-tight text-[var(--on-surface)] outline-none placeholder:text-[var(--on-surface-variant)]"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy || !name.trim()}
              aria-label="Create folder"
              className="grid h-6 w-6 place-items-center rounded-full bg-[var(--primary)] text-[var(--on-primary)] disabled:opacity-50"
            >
              <Icon name="check" size={14} />
            </button>
            <button
              type="button"
              onClick={reset}
              aria-label="Cancel"
              className="grid h-6 w-6 place-items-center rounded-full text-[var(--on-surface-variant)] hover:bg-[var(--surface-container)]"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-[var(--outline-variant)] px-3 py-1.5 text-[12px] font-bold text-[var(--on-surface-variant)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Icon name="add" size={14} />
            Add folder
          </button>
        )}
      </div>
      {error ? (
        <p className="mt-2 text-xs font-bold text-[var(--error)]">{error}</p>
      ) : null}
    </section>
  );
}

function FolderChip({
  icon,
  label,
  count,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  icon: string;
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  onRename?: (next: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  const editable = !!onRename && !!onDelete;

  if (editing && onRename) {
    return (
      <div className="flex items-center gap-2 rounded-full border-2 border-[var(--primary)] bg-[var(--primary-container)]/40 px-3 py-1.5">
        <Icon name={icon} size={16} style={{ color: "var(--primary)" }} />
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter" && draft.trim()) {
              await onRename(draft.trim());
              setEditing(false);
            }
            if (e.key === "Escape") {
              setDraft(label);
              setEditing(false);
            }
          }}
          maxLength={60}
          className="w-28 bg-transparent text-sm font-bold tracking-tight text-[var(--on-surface)] outline-none"
        />
      </div>
    );
  }

  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        onClick={onSelect}
        className={
          "inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-[12px] font-bold transition-all duration-150 " +
          (active
            ? "border-[var(--primary)] bg-[var(--primary-container)] text-[var(--on-primary-container)] [box-shadow:0_3px_0_0_var(--primary)]"
            : "border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] text-[var(--on-surface)] hover:border-[var(--outline)]")
        }
      >
        <Icon name={icon} size={14} />
        <span>{label}</span>
        <span
          className={
            "rounded-full px-1.5 text-[10px] font-extrabold tabular-nums " +
            (active
              ? "bg-[var(--primary)]/20 text-[var(--on-primary-container)]"
              : "bg-[var(--surface-container)] text-[var(--on-surface-variant)]")
          }
        >
          {count}
        </span>
      </button>
      {editable ? (
        <div className="absolute -right-1 -top-1 hidden gap-0.5 rounded-full bg-[var(--surface-container)] p-0.5 shadow-md group-hover:flex">
          <button
            type="button"
            onClick={() => {
              setDraft(label);
              setEditing(true);
            }}
            aria-label={`Rename ${label}`}
            className="grid h-5 w-5 place-items-center rounded-full text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--primary)]"
          >
            <Icon name="edit" size={12} />
          </button>
          <button
            type="button"
            onClick={async () => {
              if (
                count > 0
                  ? confirm(
                      `Delete "${label}"? The ${count} ${count === 1 ? "file" : "files"} inside will move to Uncategorized.`,
                    )
                  : confirm(`Delete "${label}"?`)
              ) {
                await onDelete?.();
              }
            }}
            aria-label={`Delete ${label}`}
            className="grid h-5 w-5 place-items-center rounded-full text-[var(--on-surface-variant)] hover:bg-[var(--surface-container-high)] hover:text-[var(--error)]"
          >
            <Icon name="delete" size={12} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
