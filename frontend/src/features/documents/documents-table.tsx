"use client";

import { format } from "date-fns";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/utils";
import { DOCUMENT_KIND_LABEL } from "@/components/add-document-modal";

import { MoveToFolderMenu } from "./move-to-folder-menu";
import type { FolderSummary } from "./types";
import type { ExtractionStatusRow } from "./api";

export type DocRow = {
  id: string;
  name: string;
  type: string;
  url: string;
  size: number | null;
  createdAt: string;
  folderId?: string | null;
  folder?: { id: string; name: string } | null;
};

/**
 * "All documents" table — name + type icon, status pill, date, size, actions.
 * Open / delete are the only mutations exposed (no v1 status field yet).
 */
export function DocumentsTable({
  rows,
  onDelete,
  folders = [],
  onMove,
  extractionById,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  totalLabel,
}: {
  rows: DocRow[];
  onDelete: (id: string) => void;
  folders?: FolderSummary[];
  onMove?: (docId: string, folderId: string | null) => void;
  extractionById?: Record<string, ExtractionStatusRow>;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /// Optional override for the "n files" header (e.g. "12 of 250 files" when
  /// the page total comes from the summary endpoint, not the local rows).
  totalLabel?: string;
}) {
  return (
    <div className="overflow-visible rounded-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)]">
      <div className="flex items-center justify-between border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-5">
        <h4 className="m-0 text-lg font-bold tracking-tight text-[var(--on-surface)]">
          All documents
        </h4>
        <span className="text-xs font-bold text-[var(--on-surface-variant)]">
          {totalLabel ?? `${rows.length} ${rows.length === 1 ? "file" : "files"}`}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[var(--surface-container-low)]">
              <Th>Name</Th>
              <Th>Type</Th>
              <Th>Date uploaded</Th>
              <Th>Size</Th>
              <Th>Extraction</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-[var(--on-surface-variant)]"
                >
                  No documents yet — tap the upload button to add your first
                  file.
                </td>
              </tr>
            ) : (
              rows.map((doc) => (
                <DocumentRow
                  key={doc.id}
                  doc={doc}
                  onDelete={onDelete}
                  folders={folders}
                  onMove={onMove}
                  extraction={extractionById?.[doc.id]}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
      {hasMore && onLoadMore ? (
        <div className="flex justify-center border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] p-3">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] px-4 py-2 text-[12px] font-extrabold uppercase tracking-[0.06em] text-[var(--on-surface)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)] disabled:opacity-60"
          >
            <Icon
              name={loadingMore ? "progress_activity" : "expand_more"}
              size={16}
              className={loadingMore ? "animate-spin" : ""}
            />
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-5 py-3.5 text-left text-[10px] font-extrabold uppercase tracking-[0.08em] text-[var(--on-surface-variant)] ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

const TYPE_TONE: Record<string, { tint: string; fg: string; icon: string }> = {
  cv: {
    tint: "rgba(0,98,157,0.08)",
    fg: "var(--primary)",
    icon: "description",
  },
  sop_draft: {
    tint: "rgba(43,108,0,0.08)",
    fg: "var(--tertiary)",
    icon: "edit_note",
  },
  transcript: {
    tint: "rgba(186,26,26,0.08)",
    fg: "var(--error)",
    icon: "school",
  },
  gre: {
    tint: "rgba(83,250,194,0.18)",
    fg: "var(--on-secondary-container)",
    icon: "calculate",
  },
  other: {
    tint: "var(--surface-container-high)",
    fg: "var(--on-surface-variant)",
    icon: "draft",
  },
};

function DocumentRow({
  doc,
  onDelete,
  folders,
  onMove,
  extraction,
}: {
  doc: DocRow;
  onDelete: (id: string) => void;
  folders: FolderSummary[];
  onMove?: (docId: string, folderId: string | null) => void;
  extraction?: ExtractionStatusRow;
}) {
  const tone = TYPE_TONE[doc.type] ?? TYPE_TONE.other!;
  const label =
    DOCUMENT_KIND_LABEL[doc.type as keyof typeof DOCUMENT_KIND_LABEL] ??
    doc.type.replaceAll("_", " ");

  return (
    <tr className="border-t border-[var(--outline-variant)] transition-colors hover:bg-[var(--surface-container-low)]">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
            style={{ background: tone.tint, color: tone.fg }}
          >
            <Icon name={tone.icon} size={20} />
          </div>
          <span className="font-bold text-[var(--on-surface)]">{doc.name}</span>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="inline-flex items-center rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--on-surface-variant)]">
          {label}
        </span>
      </td>
      <td className="px-5 py-4 text-sm text-[var(--on-surface-variant)]">
        {format(new Date(doc.createdAt), "MMM d, yyyy")}
      </td>
      <td className="px-5 py-4 text-sm text-[var(--on-surface-variant)]">
        {doc.size != null ? formatBytes(doc.size) : "—"}
      </td>
      <td className="px-5 py-4">
        <span className="inline-flex items-center rounded-full border border-[var(--outline-variant)] bg-[var(--surface-container)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--on-surface-variant)]">
          {extraction
            ? extraction.status === "extracted"
              ? `Extracted (${extraction.extractedChars.toLocaleString()} chars)`
              : extraction.status === "download_failed"
                ? "Download failed"
                : "Unsupported/scan-only"
            : "Checking..."}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="flex justify-end gap-1">
          {onMove ? (
            <MoveToFolderMenu
              folders={folders}
              currentFolderId={doc.folderId ?? null}
              onMove={(folderId) => onMove(doc.id, folderId)}
            />
          ) : null}
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open file in new tab"
            className="grid h-9 w-9 place-items-center rounded-lg text-[var(--outline)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--primary)]"
          >
            <Icon name="visibility" size={18} />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove document"
            onClick={() => onDelete(doc.id)}
            icon="delete"
          />
        </div>
      </td>
    </tr>
  );
}
