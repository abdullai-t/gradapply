"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useDocumentExtractionStatuses,
  useDocuments,
} from "@/features/documents/api";
import type { DocRow } from "@/features/documents/documents-table";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (documentId: string) => void;
  selecting?: boolean;
};

export function LibraryPickerDialog({
  open,
  onOpenChange,
  onSelect,
  selecting = false,
}: Props) {
  const docsQuery = useDocuments({ pageSize: 100 });
  const extractionQuery = useDocumentExtractionStatuses({ enabled: open });

  const [pendingId, setPendingId] = useState<string | null>(null);

  const sopDrafts = useMemo(() => {
    const rows = (docsQuery.data?.pages ?? []).flatMap((p) => p.items as DocRow[]);
    return rows
      .filter((d) => d.type === "sop_draft")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }, [docsQuery.data]);

  const extractionById = useMemo(() => {
    const map: Record<string, { status: string; extractedChars: number }> = {};
    for (const row of extractionQuery.data?.statuses ?? []) {
      map[row.id] = { status: row.status, extractedChars: row.extractedChars };
    }
    return map;
  }, [extractionQuery.data]);

  const handlePick = (doc: DocRow) => {
    const ext = extractionById[doc.id];
    if (ext && ext.status !== "extracted") return;
    setPendingId(doc.id);
    onSelect(doc.id);
  };

  const loading = docsQuery.isLoading;
  const hasMore = docsQuery.hasNextPage;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] p-0 gap-0 overflow-hidden">
        <DialogHeader className="border-b border-[var(--outline-variant)] px-6 py-5 text-left">
          <DialogTitle className="text-lg font-bold text-[var(--on-surface)]">
            Pick from your library
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--on-surface-variant)]">
            Choose a statement-of-purpose draft you already uploaded. We&apos;ll read the
            extracted text and tailor it for this school.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[min(60vh,420px)] px-4 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-[var(--on-surface-variant)]">
              Loading your documents…
            </p>
          ) : sopDrafts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--outline-variant)] bg-[var(--surface-container-low)]/80 px-6 py-10 text-center">
              <Icon name="folder_open" size={40} className="mx-auto text-[var(--outline)]" />
              <p className="mt-3 text-sm font-semibold text-[var(--on-surface)]">
                No SOP drafts in your library yet
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-[var(--on-surface-variant)]">
                Upload a PDF or DOCX on the documents page, tagged as &quot;Statement of
                purpose&quot;.
              </p>
              <Button className="mt-5" size="sm" asChild>
                <Link href="/documents">Go to document library</Link>
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {sopDrafts.map((doc) => {
                const ext = extractionById[doc.id];
                const ready = !ext || ext.status === "extracted";
                const isPending = pendingId === doc.id && selecting;

                return (
                  <li key={doc.id}>
                    <button
                      type="button"
                      disabled={!ready || selecting}
                      onClick={() => handlePick(doc)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition",
                        ready
                          ? "border-[var(--outline-variant)] bg-[var(--surface-container-low)] hover:border-[var(--primary)] hover:bg-[var(--primary-container)]/25"
                          : "cursor-not-allowed border-[var(--outline-variant)]/60 bg-[var(--surface-container)] opacity-70",
                        isPending && "border-[var(--primary)] ring-2 ring-[var(--primary)]/25",
                      )}
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-container)] text-[var(--primary)]">
                        <Icon name="description" size={22} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 font-semibold text-[var(--on-surface)]">
                          {doc.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--on-surface-variant)]">
                          {format(new Date(doc.createdAt), "MMM d, yyyy")}
                          {doc.size != null ? ` · ${formatBytes(doc.size)}` : ""}
                          {ext?.extractedChars
                            ? ` · ${ext.extractedChars.toLocaleString()} chars`
                            : ""}
                        </p>
                        {!ready ? (
                          <p className="mt-1 text-[11px] font-medium text-[var(--streak-orange)]">
                            Text not extracted — re-upload or pick another file
                          </p>
                        ) : null}
                      </div>
                      {isPending ? (
                        <span className="text-xs font-bold text-[var(--primary)]">
                          Using…
                        </span>
                      ) : (
                        <Icon
                          name="chevron_right"
                          size={20}
                          className="shrink-0 text-[var(--outline)]"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        {hasMore && sopDrafts.length > 0 ? (
          <div className="border-t border-[var(--outline-variant)] px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              disabled={docsQuery.isFetchingNextPage}
              onClick={() => void docsQuery.fetchNextPage()}
            >
              {docsQuery.isFetchingNextPage ? "Loading more…" : "Load more documents"}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
