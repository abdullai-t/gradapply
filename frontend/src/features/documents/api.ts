"use client";

import { apiFetch } from "@/lib/api-fetch";
/**
 * Client API surface for the documents + folders feature.
 *
 * Co-located query keys + typed fetch wrappers + TanStack Query hooks.
 * Schemas come from `src/server/documents/schemas.ts` so client and server
 * stay in lock-step.
 */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { DocRow } from "@/features/documents/documents-table";
import type { FolderSummary } from "@/features/documents/types";

// ---- Keys -----------------------------------------------------------

export const documentsKeys = {
  all: ["documents"] as const,
  list: (folderId: string | "none" | null) =>
    ["documents", "list", folderId] as const,
  summary: () => ["documents", "summary"] as const,
};

export const foldersKeys = {
  all: ["folders"] as const,
  list: () => ["folders"] as const,
};

// ---- Types -----------------------------------------------------------

export type DocumentsSummary = {
  total: number;
  uncategorized: number;
  bytesUsed: number;
  byKind: Record<string, number>;
};

export type DocumentsPage = {
  items: DocRow[];
  nextCursor: string | null;
};

export type ExtractionStatusRow = {
  id: string;
  name: string;
  status: "extracted" | "download_failed" | "unsupported";
  extractedChars: number;
  detail?: string;
};

export type ParsedTextPayload = {
  id: string;
  name: string;
  extracted: boolean;
  chars: number;
  text: string;
};

// ---- Fetch helpers --------------------------------------------------

function buildDocsUrl(opts: {
  folderId?: string | "none" | null;
  take?: number;
  cursor?: string | null;
}): string {
  const params = new URLSearchParams();
  if (opts.take != null) params.set("take", String(opts.take));
  if (opts.folderId === "none") params.set("folderId", "none");
  else if (opts.folderId) params.set("folderId", opts.folderId);
  if (opts.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return qs ? `/api/documents?${qs}` : "/api/documents";
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string | { formErrors?: string[] } }
      | null;
    const msg =
      typeof body?.error === "string"
        ? body.error
        : body?.error?.formErrors?.[0] ?? `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// ---- Documents ------------------------------------------------------

/**
 * Cursor-paginated documents list. Backed by `useInfiniteQuery` so the UI
 * can call `fetchNextPage()` to append additional pages without refetching
 * the existing rows. The flattened items live at `data?.pages.flatMap(p => p.items)`.
 */
export function useDocuments(opts: {
  folderId?: string | "none" | null;
  pageSize?: number;
}) {
  const folderId = opts.folderId ?? null;
  const pageSize = opts.pageSize ?? 50;
  return useInfiniteQuery({
    queryKey: documentsKeys.list(folderId),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      jsonOrThrow<DocumentsPage>(
        await apiFetch(
          buildDocsUrl({ folderId, take: pageSize, cursor: pageParam }),
        ),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useDocumentsSummary() {
  return useQuery({
    queryKey: documentsKeys.summary(),
    queryFn: async () =>
      jsonOrThrow<DocumentsSummary>(await apiFetch("/api/documents/summary")),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useDocumentExtractionStatuses(opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...documentsKeys.all, "extraction-status"] as const,
    queryFn: async () =>
      jsonOrThrow<{ statuses: ExtractionStatusRow[] }>(
        await apiFetch("/api/documents/extraction-status?take=10", {
          cache: "no-store",
        }),
      ),
    staleTime: 10000,
    enabled: opts?.enabled ?? true,
    refetchOnWindowFocus: false,
  });
}

export async function fetchParsedDocumentText(
  id: string,
): Promise<ParsedTextPayload> {
  return jsonOrThrow<ParsedTextPayload>(
    await apiFetch(`/api/documents/${id}/parsed-text`, { cache: "no-store" }),
  );
}

export function useDeleteDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      jsonOrThrow<{ ok: true }>(
        await apiFetch(`/api/documents/${id}`, { method: "DELETE" }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: documentsKeys.all });
      void qc.invalidateQueries({ queryKey: foldersKeys.all });
    },
  });
}

export function useMoveDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { docId: string; folderId: string | null }) =>
      jsonOrThrow<DocRow>(
        await apiFetch(`/api/documents/${input.docId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ folderId: input.folderId }),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: documentsKeys.all });
      void qc.invalidateQueries({ queryKey: foldersKeys.all });
    },
  });
}

// ---- Folders --------------------------------------------------------

export function useFolders() {
  return useQuery({
    queryKey: foldersKeys.list(),
    queryFn: async () =>
      jsonOrThrow<FolderSummary[]>(await apiFetch("/api/folders")),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      jsonOrThrow<FolderSummary>(
        await apiFetch("/api/folders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: foldersKeys.all });
    },
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name: string }) =>
      jsonOrThrow<FolderSummary>(
        await apiFetch(`/api/folders/${input.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: input.name }),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: foldersKeys.all });
    },
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      jsonOrThrow<{ ok: true }>(
        await apiFetch(`/api/folders/${id}`, { method: "DELETE" }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: foldersKeys.all });
      void qc.invalidateQueries({ queryKey: documentsKeys.all });
    },
  });
}
