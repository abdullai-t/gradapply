"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { FreePlanGate } from "@/components/free-plan-gate";
import { Icon } from "@/components/icon";
import { PageLoader } from "@/components/page-loader";

// Upload modal lives behind the "+" gesture; defer its bundle until then.
const AddDocumentModal = dynamic(
  () =>
    import("@/components/add-document-modal").then((m) => ({
      default: m.AddDocumentModal,
    })),
  { ssr: false },
);

import { StorageHealth } from "@/features/documents/storage-health";
import {
  DocumentsTable,
  type DocRow,
} from "@/features/documents/documents-table";
import { QuickAccess } from "@/features/documents/quick-access";
import {
  CategoryCards,
  bucketByKind,
  type CategoryCounts,
} from "@/features/documents/category-cards";
import { FoldersBar } from "@/features/documents/folders-bar";
import {
  documentsKeys,
  foldersKeys,
  useCreateFolder,
  useDeleteDocument,
  useDocumentExtractionStatuses,
  useDeleteFolder,
  useDocuments,
  useDocumentsSummary,
  useFolders,
  useMoveDocument,
  useRenameFolder,
} from "@/features/documents/api";
import { useFabClick } from "@/hooks/use-fab-click";
import { usePlanTier } from "@/hooks/use-plan-tier";

export default function DocumentsPage() {
  const qc = useQueryClient();
  const { planTier } = usePlanTier();

  const [activeFolder, setActiveFolder] = useState<string | "none" | null>(
    null,
  );
  const [addOpen, setAddOpen] = useState(false);

  // Cursor-paginated documents query. Pages are fetched on demand via
  // `fetchNextPage()` from the "Load more" button — the table receives
  // every loaded row flattened.
  const docsQuery = useDocuments({ folderId: activeFolder });
  const summaryQuery = useDocumentsSummary();
  const extractionStatusQuery = useDocumentExtractionStatuses({
    enabled: Boolean(docsQuery.data?.pages?.length),
  });
  const foldersQuery = useFolders();

  const deleteDocument = useDeleteDocument();
  const moveDocumentMutation = useMoveDocument();
  const createFolderMutation = useCreateFolder();
  const renameFolderMutation = useRenameFolder();
  const deleteFolderMutation = useDeleteFolder();

  // FAB ("+") on /documents opens the upload modal.
  useFabClick("documents", () => setAddOpen(true));

  // Flatten every loaded page into a single rows array.
  const pageRows: DocRow[] = useMemo(
    () =>
      (docsQuery.data?.pages ?? []).flatMap((p) => p.items as DocRow[]),
    [docsQuery.data],
  );
  const hasMore = Boolean(docsQuery.hasNextPage);
  const loadingMore = docsQuery.isFetchingNextPage;
  const loadMore = () => void docsQuery.fetchNextPage();
  const summary = summaryQuery.data;
  const folders = foldersQuery.data ?? [];

  const totalCount = summary?.total ?? pageRows.length;
  const uncategorizedCount = summary?.uncategorized ?? 0;
  const bytesUsed =
    summary?.bytesUsed ?? pageRows.reduce((s, d) => s + (d.size ?? 0), 0);
  const quotaBytes =
    planTier === "PRO"
      ? 100 * 1024 * 1024
      : planTier === "PLUS"
        ? 50 * 1024 * 1024
        : 10 * 1024 * 1024;
  const counts: CategoryCounts | undefined = summary
    ? bucketByKind(summary.byKind)
    : undefined;

  const showQuickAccess = activeFolder === null && pageRows.length > 0;

  const tableTotal = (() => {
    if (activeFolder === "none")
      return uncategorizedCount > 0 ? uncategorizedCount : null;
    if (activeFolder) return folders.find((f) => f.id === activeFolder)?.count;
    return totalCount;
  })();
  const totalLabel =
    typeof tableTotal === "number"
      ? pageRows.length === tableTotal
        ? `${tableTotal} ${tableTotal === 1 ? "file" : "files"}`
        : `${pageRows.length} of ${tableTotal} files`
      : undefined;
  const extractionById = useMemo(() => {
    const rows = extractionStatusQuery.data?.statuses ?? [];
    return Object.fromEntries(rows.map((r) => [r.id, r]));
  }, [extractionStatusQuery.data]);

  // The AddDocumentModal POSTs to /api/documents directly; we forward its
  // onSaved into our cache so docs list and summary stay in sync.
  const onUploaded = () => {
    void qc.invalidateQueries({ queryKey: documentsKeys.all });
    void qc.invalidateQueries({ queryKey: foldersKeys.all });
    void qc.invalidateQueries({
      queryKey: [...documentsKeys.all, "extraction-status"],
    });
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this document from your library?")) return;
    await deleteDocument.mutateAsync(id);
  };

  const move = (docId: string, folderId: string | null) =>
    moveDocumentMutation.mutate({ docId, folderId });

  const createFolder = async (name: string) => {
    await createFolderMutation.mutateAsync(name);
  };

  const renameFolder = async (id: string, name: string) => {
    await renameFolderMutation.mutateAsync({ id, name });
  };

  const deleteFolder = async (id: string) => {
    if (activeFolder === id) setActiveFolder(null);
    await deleteFolderMutation.mutateAsync(id);
  };

  const pendingDeleteId = deleteDocument.isPending
    ? (deleteDocument.variables ?? null)
    : null;
  const pendingDeleteFolderId = deleteFolderMutation.isPending
    ? (deleteFolderMutation.variables ?? null)
    : null;

  if (planTier === "FREE") {
    return (
      <FreePlanGate
        icon="folder_managed"
        title="Document library"
        body="Documents are available on Plus and Pro plans. Upgrade in Settings to start uploading SOP drafts, CVs, transcripts, and GRE files."
      />
    );
  }

  const loading = docsQuery.isLoading || summaryQuery.isLoading;

  return (
    <div className="slide-in space-y-10 pb-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="t-headline-lg m-0 text-[var(--on-surface)]">
            Documents library
          </h1>
          <p className="mt-1.5 text-[15px] text-[var(--on-surface-variant)]">
            Manage and organize your academic portfolio.
          </p>
        </div>
        <Button icon="cloud_upload" size="lg" onClick={() => setAddOpen(true)}>
          Upload new
        </Button>
      </header>

      {/* Storage health + quick access */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <StorageHealth bytesUsed={bytesUsed} quotaBytes={quotaBytes} />
        {showQuickAccess ? (
          <QuickAccess docs={pageRows} />
        ) : (
          <RecentBanner count={totalCount} loading={loading} />
        )}
      </div>

      {/* Categories — driven by summary endpoint when available */}
      {totalCount > 0 ? (
        <CategoryCards docs={pageRows} counts={counts} />
      ) : null}

      {/* Folders — user-defined taxonomy */}
      {totalCount > 0 || folders.length > 0 ? (
        <FoldersBar
          folders={folders}
          active={activeFolder}
          onSelect={setActiveFolder}
          onCreate={createFolder}
          onRename={renameFolder}
          onDelete={deleteFolder}
          pendingDeleteFolderId={pendingDeleteFolderId}
          totalCount={totalCount}
          uncategorizedCount={uncategorizedCount}
        />
      ) : null}

      {/* All documents */}
      {loading ? (
        <PageLoader label="Loading documents…" />
      ) : (
        <DocumentsTable
          rows={pageRows}
          onDelete={remove}
          pendingDeleteId={pendingDeleteId}
          folders={folders}
          onMove={move}
          extractionById={extractionById}
          hasMore={hasMore}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
          totalLabel={totalLabel}
        />
      )}

      {/* Add modal */}
      <AddDocumentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={onUploaded}
      />
    </div>
  );
}

function RecentBanner({ count, loading }: { count: number; loading: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-6"
      style={{
        background:
          "linear-gradient(135deg, var(--primary-container), var(--primary))",
        color: "white",
        boxShadow: "0 16px 40px -16px rgba(0,98,157,0.45)",
      }}
    >
      <div
        className="float-blob pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full"
        style={{
          background: "rgba(255,255,255,0.18)",
          filter: "blur(50px)",
        }}
        aria-hidden
      />
      <div className="relative flex items-start gap-4">
        <div
          className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20"
          aria-hidden
        >
          <Icon name="auto_awesome" fill size={24} />
        </div>
        <div className="flex-1">
          <h3 className="m-0 text-lg font-extrabold tracking-tight">
            Keep your dossier ready
          </h3>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-white/85">
            {loading
              ? "Loading…"
              : count === 0
                ? "Drop in your CV, SOP, transcripts, and GRE scores. The assistant uses them as context for every draft."
                : `${count} ${count === 1 ? "file" : "files"} on file. Add more so the assistant has the right context for each program.`}
          </p>
        </div>
      </div>
    </div>
  );
}
