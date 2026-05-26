"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  RewriteSelectionRequest,
  RewriteSelectionResponse,
} from "@/server/sop-rewrite/schemas";
import type { SopScoreResponse } from "@/server/sop-score/schemas";

export const sopStudioKeys = {
  variant: (schoolId: string) => ["sop-variant", schoolId] as const,
  score: (schoolId: string | null) => ["sop-score", schoolId ?? null] as const,
};

export type SopVariantRow = {
  id: string;
  schoolId: string;
  title: string;
  body: string;
  sourceMasterId: string | null;
  masterText: string | null;
  updatedAt: string;
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/** GET /api/sop/variants?schoolId=<id> */
export function useSopVariant(schoolId: string) {
  return useQuery({
    queryKey: sopStudioKeys.variant(schoolId),
    enabled: Boolean(schoolId),
    queryFn: async () => {
      const data = await jsonOrThrow<{ variant: SopVariantRow | null }>(
        await fetch(
          `/api/sop/variants?schoolId=${encodeURIComponent(schoolId)}`,
        ),
      );
      return data.variant;
    },
  });
}

/**
 * POST /api/sop/variants — generates the first tailored draft from a
 * pasted master OR a library document. Server upserts the SopVariant row
 * for this school and persists `masterText` so we can show "View original"
 * later without re-asking.
 */
export function useGenerateVariant(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      masterText?: string;
      masterDocumentId?: string;
      title?: string;
    }) =>
      jsonOrThrow<{ variant: SopVariantRow }>(
        await fetch("/api/sop/variants", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schoolId, ...input }),
        }),
      ),
    onSuccess: (data) => {
      qc.setQueryData(sopStudioKeys.variant(schoolId), data.variant);
    },
  });
}

/**
 * PATCH /api/sop/variants/[id] — saves manual edits made in the editor.
 * Body and/or title can be updated; whatever is omitted stays as-is.
 */
export function useUpdateVariant(schoolId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      title?: string;
      body?: string;
    }) => {
      const { id, ...patch } = input;
      return jsonOrThrow<SopVariantRow>(
        await fetch(`/api/sop/variants/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }),
      );
    },
    onSuccess: (variant) => {
      qc.setQueryData(sopStudioKeys.variant(schoolId), variant);
    },
  });
}

/**
 * POST /api/sop/rewrite — selection or whole-document rewrite. Returns the
 * new text only; the editor is responsible for showing it as a pending
 * suggestion the user can accept or reject. The server never writes to
 * the variant on its own.
 */
export function useRewriteSelection() {
  return useMutation({
    mutationFn: async (input: RewriteSelectionRequest) =>
      jsonOrThrow<RewriteSelectionResponse>(
        await fetch("/api/sop/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
      ),
  });
}

/**
 * Whole-document rewrite — same endpoint, scope locked to "document". The
 * caller passes the current draft as plain text (paragraphs separated by
 * blank lines) and gets the new draft back the same way. The editor opens
 * a paragraph-by-paragraph review surface around the response.
 */
export function useRewriteDocument() {
  return useMutation({
    mutationFn: async (input: {
      originalText: string;
      prompt: string;
      schoolId?: string;
    }) =>
      jsonOrThrow<RewriteSelectionResponse>(
        await fetch("/api/sop/rewrite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, scope: "document" } satisfies RewriteSelectionRequest),
        }),
      ),
  });
}

export {
  bodyToEditorHtml,
  paragraphsToHtml,
  splitParagraphs,
  stripHtmlToPlain,
} from "@/lib/sop-paragraphs";

/**
 * POST /api/sop/score — debounce-driven LLM scoring for the Insights
 * sidebar (persuasiveness, clarity, tone, checklist).
 */
export function useScoreSop(schoolId: string | null) {
  return useMutation({
    mutationKey: sopStudioKeys.score(schoolId),
    mutationFn: async (body: string) =>
      jsonOrThrow<SopScoreResponse>(
        await fetch("/api/sop/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body, schoolId: schoolId ?? undefined }),
        }),
      ),
  });
}
