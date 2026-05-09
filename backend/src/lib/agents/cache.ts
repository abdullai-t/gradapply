// @ts-nocheck
import type { AgentContext } from "./types";

/**
 * Per-request tool result cache. Keyed by `toolName:stableJSON(input)`.
 * Avoids redundant DB / network calls within a single orchestrator run.
 */

function stableKey(toolName: string, input: unknown): string {
  try {
    return `${toolName}:${JSON.stringify(input, Object.keys(input as Record<string, unknown>).sort())}`;
  } catch {
    return `${toolName}:${String(input)}`;
  }
}

export function getCached<T>(ctx: AgentContext, toolName: string, input: unknown): T | undefined {
  const key = stableKey(toolName, input);
  return ctx.toolCache.get(key) as T | undefined;
}

export function setCached<T>(ctx: AgentContext, toolName: string, input: unknown, value: T): void {
  const key = stableKey(toolName, input);
  ctx.toolCache.set(key, value);
}
