"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type GoogleDocLinkSummary = {
  id: string;
  entityType: string;
  entityId: string;
  googleDocUrl: string;
  lastSyncedAt: string | null;
  lastSyncSource: string | null;
  lastSyncError: string | null;
  watchExpiresAt: string | null;
};

export const googleDocsKeys = {
  all: ["google-docs"] as const,
  link: (entityType: string, entityId: string) =>
    [...googleDocsKeys.all, entityType, entityId] as const,
};

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { error?: string; code?: string }
      | null;
    const err = new Error(body?.error ?? `Request failed (${res.status})`);
    (err as Error & { code?: string }).code = body?.code;
    throw err;
  }
  return (await res.json()) as T;
}

export function useGoogleDocLink(
  entityType: string,
  entityId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: googleDocsKeys.link(entityType, entityId),
    enabled: enabled && Boolean(entityId),
    queryFn: async () =>
      jsonOrThrow<{ link: GoogleDocLinkSummary | null }>(
        await fetch(
          `/api/google-docs/link?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`,
        ),
      ),
  });
}

export function useCreateGoogleDocLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { entityType: string; entityId: string }) =>
      jsonOrThrow<{ link: GoogleDocLinkSummary }>(
        await fetch("/api/google-docs/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: googleDocsKeys.link(vars.entityType, vars.entityId),
      });
    },
  });
}
