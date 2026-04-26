"use client";

import { useCallback, useRef } from "react";
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
    staleTime: 30000, // Consider data fresh for 30s - shows cached instantly
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
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

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "agent"; agentId: string }
  | { type: "done"; agentId: string }
  | { type: "error"; message: string };

/**
 * Streaming send hook.
 *
 * Design: the optimistic assistant entry is created with role "assistant"
 * from the start (same role as server-persisted messages).  Tokens are
 * written directly into the cache entry's `content` via RAF batching, so
 * the same React key / same MarkdownBody instance simply receives updated
 * props — no unmount/remount, no flash.
 *
 * The caller receives `streamingMsgId` so it can append a blinking cursor
 * to that specific message while streaming is active.
 */
export function useSendMessageStreaming() {
  const qc = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  /** ID of the cache entry currently being streamed into. */
  const streamingIdRef = useRef<string | null>(null);

  const send = useCallback(
    async (input: { message: string; mode: ChatMode; schoolId?: string | null }) => {
      if (sendingRef.current) return;
      sendingRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      const key = chatKeys.history(input.mode, input.schoolId ?? null);
      const previous = qc.getQueryData<ChatMessage[]>(key) ?? [];
      const ts = Date.now();
      const assistantId = `optimistic-assistant-${ts}`;
      streamingIdRef.current = assistantId;

      // Optimistic: user message + empty assistant message (same "assistant"
      // role that persisted messages use — no role swap later).
      qc.setQueryData<ChatMessage[]>(key, [
        ...previous,
        {
          id: `optimistic-user-${ts}`,
          role: "user",
          content: input.message,
          mode: input.mode,
          schoolId: input.schoolId ?? null,
        },
        {
          id: assistantId,
          role: "assistant",
          content: "",
          mode: input.mode,
          schoolId: input.schoolId ?? null,
        },
      ]);

      let accumulated = "";
      let error: string | null = null;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, stream: true }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(body?.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let rafPending = false;

        const flushToCache = (text: string) => {
          const cur = qc.getQueryData<ChatMessage[]>(key);
          if (!cur) return;
          qc.setQueryData<ChatMessage[]>(
            key,
            cur.map((m) =>
              m.id === assistantId ? { ...m, content: text } : m,
            ),
          );
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;

            try {
              const event = JSON.parse(payload) as StreamEvent;
              if (event.type === "token") {
                accumulated += event.content;
                if (!rafPending) {
                  rafPending = true;
                  const snapshot = accumulated;
                  requestAnimationFrame(() => {
                    rafPending = false;
                    flushToCache(snapshot);
                  });
                }
              } else if (event.type === "error") {
                error = event.message;
              }
            } catch {
              // Ignore malformed SSE lines
            }
          }
        }

        // Final synchronous flush so no tokens are lost
        flushToCache(accumulated);

        if (error) throw new Error(error);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        qc.setQueryData(key, previous);
        throw e;
      } finally {
        sendingRef.current = false;
        streamingIdRef.current = null;
        abortRef.current = null;
        // Smart reconciliation: after streaming completes, server still needs
        // to persist the new turn (it does so AFTER closing the stream), so
        // we poll for fresh data and merge it into the cache while preserving
        // React keys for messages that already match by content.
        //
        // Plain `invalidateQueries` would cause React Query to refetch and
        // replace the array — the optimistic IDs we used during streaming
        // would be swapped for real DB IDs, React would see new keys and
        // unmount/remount the streamed assistant bubble, producing a visible
        // flash where the markdown re-parses from scratch.
        //
        // The retry loop is critical because the persistence transaction can
        // race the smart-merge fetch. If we naively replace the cache with a
        // shorter `fresh` array (server hasn't written the new turn yet), we
        // drop the optimistic user message and the streamed assistant reply
        // from the UI even though they're correct.
        const reconcile = async () => {
          const qs = new URLSearchParams({ mode: input.mode });
          if (input.schoolId) qs.set("schoolId", input.schoolId);
          // Bypass the 10s browser cache from the API's Cache-Control header,
          // otherwise the first poll often returns the pre-turn snapshot.
          const fresh = await jsonOrThrow<ChatMessage[]>(
            await fetch(`/api/chat?${qs.toString()}`, { cache: "no-store" }),
          );
          let persisted = false;
          qc.setQueryData<ChatMessage[]>(key, (oldData) => {
            if (!oldData) {
              persisted = fresh.length > 0;
              return fresh;
            }
            // If the server hasn't persisted the new turn yet, `fresh` is
            // shorter than the optimistic cache. Keep the cache untouched —
            // dropping the user message + streamed reply would be visible.
            // We'll retry; on the next attempt fresh should match or exceed
            // oldData and we can safely swap in the real IDs.
            if (fresh.length < oldData.length) return oldData;
            persisted = true;
            // For each fresh message, if there's an old message at the same
            // position with the same role and content, keep the old ID so
            // React reuses the same DOM node (no unmount/remount).
            return fresh.map((freshMsg, idx) => {
              const oldMsg = oldData[idx];
              if (
                oldMsg &&
                oldMsg.role === freshMsg.role &&
                oldMsg.content === freshMsg.content
              ) {
                return { ...freshMsg, id: oldMsg.id };
              }
              return freshMsg;
            });
          });
          return persisted;
        };

        // Initial delay matches typical persistence latency (~1.5s). If the
        // first poll comes up short, retry a couple more times before giving
        // up — the optimistic cache stays correct in the meantime.
        setTimeout(async () => {
          try {
            for (let attempt = 0; attempt < 4; attempt++) {
              const ok = await reconcile();
              if (ok) break;
              await new Promise((r) => setTimeout(r, 1000));
            }
          } catch {
            // If the manual fetch failed entirely, fall back to standard
            // invalidation so the cache still gets refreshed eventually.
            void qc.invalidateQueries({ queryKey: key });
          }
          void qc.invalidateQueries({ queryKey: chatKeys.stats() });
        }, 1500);
      }
    },
    [qc],
  );

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Current streaming message ID — use in render to show cursor */
  const getStreamingId = useCallback(() => streamingIdRef.current, []);

  return { send, abort, getStreamingId };
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
