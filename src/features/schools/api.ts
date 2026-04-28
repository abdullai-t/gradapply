"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { SchoolRow } from "@/features/schools/types";

export const schoolsKeys = {
  all: ["schools"] as const,
  list: (sort?: string) => ["schools", { sort }] as const,
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: schoolsKeys.all });
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: schoolsKeys.all });
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: schoolsKeys.all });
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
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: schoolsKeys.all });
    },
  });
}
