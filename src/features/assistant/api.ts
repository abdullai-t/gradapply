"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import type { ChatMode } from "@/features/assistant/agent-chips";

export const chatKeys = {
  all: ["chat"] as const,
  history: (mode: ChatMode, schoolId?: string | null) =>
    ["chat", "history", mode, schoolId ?? null] as const,
  stats: () => ["chat", "stats"] as const,
};

export type ChatMessage = {
  id: string;
  /// "user" / "assistant" from the server. The client may also seed
  /// "assistant-pending" entries optimistically to render a thinking
  /// bubble while a send is in flight; those are removed on
  /// invalidation when the real reply arrives.
  role: string;
  content: string;
  mode: string | null;
  schoolId: string | null;
};

export const ASSISTANT_PENDING_ROLE = "assistant-pending";

export type AgentMeta = {
  tabMode: string;
  effectiveMode: string;
  label: string;
  provider: string;
  model: string | null;
  routedFromGeneral: boolean;
  creditFallback: boolean;
};

export type ChatStats = {
  totalsByMode: Record<string, number>;
  userMessages7d: number;
  userMessages30d: number;
  words7d: number;
  days7d: { date: string; count: number }[];
  dayStreak: number;
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

export function useChatHistory(mode: ChatMode, schoolId?: string | null) {
  return useQuery({
    queryKey: chatKeys.history(mode, schoolId ?? null),
    queryFn: async () => {
      const qs = new URLSearchParams({ mode });
      if (schoolId) qs.set("schoolId", schoolId);
      return jsonOrThrow<ChatMessage[]>(await fetch(`/api/chat?${qs.toString()}`));
    },
  });
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      message: string;
      mode: ChatMode;
      schoolId?: string | null;
    }) =>
      jsonOrThrow<{ agent?: AgentMeta }>(
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }),
      ),
    onMutate: (vars) => {
      // Optimistic update: drop the user message and a pending placeholder
      // straight into the cache so any mounted chat panel renders the new
      // turn immediately, without waiting for the LLM round trip.
      const key = chatKeys.history(vars.mode, vars.schoolId ?? null);
      const previous = qc.getQueryData<ChatMessage[]>(key) ?? [];
      const ts = Date.now();
      const next: ChatMessage[] = [
        ...previous,
        {
          id: `optimistic-user-${ts}`,
          role: "user",
          content: vars.message,
          mode: vars.mode,
          schoolId: vars.schoolId ?? null,
        },
        {
          id: `optimistic-pending-${ts}`,
          role: ASSISTANT_PENDING_ROLE,
          content: "",
          mode: vars.mode,
          schoolId: vars.schoolId ?? null,
        },
      ];
      qc.setQueryData(key, next);
      return { previous, key };
    },
    onError: (_err, _vars, ctx) => {
      // Roll back the optimistic insert if the send failed.
      if (ctx) qc.setQueryData(ctx.key, ctx.previous);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({
        queryKey: chatKeys.history(vars.mode, vars.schoolId ?? null),
      });
      void qc.invalidateQueries({ queryKey: chatKeys.stats() });
    },
  });
}

export function useChatStats() {
  return useQuery({
    queryKey: chatKeys.stats(),
    queryFn: async () =>
      jsonOrThrow<ChatStats>(
        await fetch("/api/chat/stats", { cache: "no-store" }),
      ),
  });
}
