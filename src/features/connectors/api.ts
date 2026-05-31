"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export const connectorsKeys = {
  all: ["connectors"] as const,
  list: () => ["connectors", "list"] as const,
};

export type ConnectorRow = {
  provider: "gmail" | "google_drive";
  connected: boolean;
  email: string | null;
  updatedAt: string | null;
  /** Drive only: true when OAuth scopes include Google Docs sync. */
  docsSyncReady: boolean | null;
};

export type ConnectorsResponse = {
  googleOAuthConfigured: boolean;
  connectors: ConnectorRow[];
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

export function useConnectors() {
  return useQuery({
    queryKey: connectorsKeys.list(),
    queryFn: async () =>
      jsonOrThrow<ConnectorsResponse>(await fetch("/api/connectors")),
  });
}

export function useDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (provider: "gmail" | "google-drive") =>
      jsonOrThrow<{ ok: true }>(
        await fetch(`/api/connectors/${provider}`, { method: "DELETE" }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: connectorsKeys.all });
    },
  });
}
