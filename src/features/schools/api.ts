"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import type { SchoolRow } from "@/features/schools/types";

export const schoolsKeys = {
  all: ["schools"] as const,
  list: (sort?: string) => ["schools", { sort }] as const,
  detail: (id: string) => ["schools", "detail", id] as const,
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

/** Write a saved school into TanStack Query after the API succeeds. */
export function syncSchoolInCache(qc: QueryClient, saved: SchoolRow) {
  qc.setQueryData(schoolsKeys.detail(saved.id), saved);
  qc.setQueriesData<SchoolRow[]>(
    { queryKey: schoolsKeys.all },
    (old) => {
      if (!Array.isArray(old)) return old;
      const idx = old.findIndex((s) => s.id === saved.id);
      if (idx === -1) return old;
      const next = [...old];
      next[idx] = saved;
      return next;
    },
  );
}

/** Remove a school from list + detail caches (call after DELETE succeeds). */
export function removeSchoolFromCache(qc: QueryClient, id: string) {
  qc.removeQueries({ queryKey: schoolsKeys.detail(id) });
  qc.setQueriesData<SchoolRow[]>({ queryKey: schoolsKeys.all }, (old) => {
    if (!Array.isArray(old)) return old;
    return old.filter((s) => s.id !== id);
  });
}

export function useSchool(id: string) {
  return useQuery({
    queryKey: schoolsKeys.detail(id),
    enabled: Boolean(id),
    queryFn: async () =>
      jsonOrThrow<SchoolRow>(await fetch(`/api/schools/${encodeURIComponent(id)}`)),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useSchools(opts?: { sort?: string }) {
  const sort = opts?.sort;
  return useQuery({
    queryKey: schoolsKeys.list(sort),
    queryFn: async () =>
      jsonOrThrow<SchoolRow[]>(
        await fetch(sort ? `/api/schools?sort=${sort}` : "/api/schools"),
      ),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<SchoolRow>) =>
      jsonOrThrow<SchoolRow>(
        await fetch("/api/schools", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        }),
      ),
    onSuccess: (created) => {
      qc.setQueriesData<SchoolRow[]>({ queryKey: schoolsKeys.all }, (old) => {
        if (!Array.isArray(old)) return [created];
        return [created, ...old];
      });
      qc.setQueryData(schoolsKeys.detail(created.id), created);
    },
  });
}

export function useUpdateSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; data: Partial<SchoolRow> }) =>
      jsonOrThrow<SchoolRow>(
        await fetch(`/api/schools/${input.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input.data),
        }),
      ),
    onSuccess: (saved) => {
      syncSchoolInCache(qc, saved);
    },
  });
}

export function useDeleteSchool() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      jsonOrThrow<{ ok: true }>(
        await fetch(`/api/schools/${id}`, { method: "DELETE" }),
      ),
    onSuccess: (_data, id) => {
      removeSchoolFromCache(qc, id);
    },
  });
}

export function useClearReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      jsonOrThrow<SchoolRow>(
        await fetch(`/api/schools/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reminderAt: null, reminderNote: null }),
        }),
      ),
    onSuccess: (saved) => {
      syncSchoolInCache(qc, saved);
    },
  });
}
