"use client";

import { apiFetch } from "@/lib/api-fetch";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export const profileKeys = {
  all: ["profile"] as const,
  detail: () => ["profile", "detail"] as const,
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

export function useProfile() {
  return useQuery({
    queryKey: profileKeys.detail(),
    queryFn: async () =>
      jsonOrThrow<Record<string, unknown>>(await apiFetch("/api/profile")),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) =>
      jsonOrThrow<Record<string, unknown>>(
        await apiFetch("/api/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data),
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: profileKeys.all });
    },
  });
}
