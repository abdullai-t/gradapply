"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export const profEmailsKeys = {
  all: ["prof-emails"] as const,
  list: () => ["prof-emails", "list"] as const,
};

export const contentVersionsKeys = {
  all: ["content-versions"] as const,
  list: (entityType: string, entityId: string) =>
    ["content-versions", entityType, entityId] as const,
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

// ---- prof-emails: list / mutate -------------------------------------

export function useProfEmails() {
  return useQuery({
    queryKey: profEmailsKeys.list(),
    queryFn: async () =>
      jsonOrThrow<unknown[]>(await fetch("/api/prof-emails")),
  });
}

export function useUpdateProfEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; data: Record<string, unknown> }) =>
      jsonOrThrow<unknown>(
        await fetch(`/api/prof-emails/${input.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input.data),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profEmailsKeys.all });
    },
  });
}

export function useDeleteProfEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      jsonOrThrow<{ ok: true }>(
        await fetch(`/api/prof-emails/${id}`, { method: "DELETE" }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profEmailsKeys.all });
    },
  });
}

// ---- AI flows -------------------------------------------------------

export function useDraftProfEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      jsonOrThrow<unknown>(
        await fetch(`/api/prof-emails/${id}/draft`, { method: "POST" }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profEmailsKeys.all });
    },
  });
}

export function useFromUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (profileUrl: string) =>
      jsonOrThrow<unknown>(
        await fetch("/api/prof-emails/from-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profileUrl }),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profEmailsKeys.all });
    },
  });
}

export function useDiscoverBySchools() {
  return useMutation({
    mutationFn: async (schoolIds: string[]) =>
      jsonOrThrow<{ candidates: unknown[] }>(
        await fetch("/api/prof-emails/discover-by-schools", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ schoolIds }),
        }),
      ),
  });
}

export function useDiscover() {
  return useMutation({
    mutationFn: async (input: { profileUrl: string; schoolIds: string[] }) =>
      jsonOrThrow<unknown>(
        await fetch("/api/prof-emails/discover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        }),
      ),
  });
}

export function useAnalyzeReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; replyText: string }) =>
      jsonOrThrow<unknown>(
        await fetch(`/api/prof-emails/${input.id}/analyze-reply`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ replyText: input.replyText }),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profEmailsKeys.all });
    },
  });
}

export function useSendViaGmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      attachmentDocumentIds?: string[];
    }) =>
      jsonOrThrow<unknown>(
        await fetch(`/api/prof-emails/${input.id}/send-via-gmail`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            attachmentDocumentIds: input.attachmentDocumentIds ?? [],
          }),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profEmailsKeys.all });
    },
  });
}

// ---- content-versions ----------------------------------------------

export function useVersions(input: { entityType: string; entityId: string }) {
  return useQuery({
    queryKey: contentVersionsKeys.list(input.entityType, input.entityId),
    queryFn: async () =>
      jsonOrThrow<unknown[]>(
        await fetch(
          `/api/content-versions?entityType=${encodeURIComponent(
            input.entityType,
          )}&entityId=${encodeURIComponent(input.entityId)}`,
        ),
      ),
    enabled: Boolean(input.entityId),
  });
}

export function useSaveVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      entityType: string;
      entityId: string;
      label: string;
      body: string;
    }) =>
      jsonOrThrow<unknown>(
        await fetch("/api/content-versions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        }),
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: contentVersionsKeys.list(vars.entityType, vars.entityId),
      });
    },
  });
}

export function useRestoreVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) =>
      jsonOrThrow<unknown>(
        await fetch(`/api/content-versions/${versionId}/restore`, {
          method: "POST",
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: contentVersionsKeys.all });
      void qc.invalidateQueries({ queryKey: profEmailsKeys.all });
    },
  });
}
