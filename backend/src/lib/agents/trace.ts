// @ts-nocheck
import type { AgentContext, TraceEvent } from "./types";

export function emitTrace(
  ctx: AgentContext,
  agentId: string,
  event: TraceEvent["event"],
  data: Record<string, unknown> = {},
  durationMs?: number,
): void {
  const entry: TraceEvent = {
    timestamp: Date.now(),
    agentId,
    event,
    data,
    durationMs,
  };
  ctx.trace.push(entry);

  const enabled = process.env.AGENT_TRACE_ENABLED?.trim().toLowerCase();
  if (enabled === "true" || enabled === "1") {
    console.info("[agent-trace]", JSON.stringify(entry));
  }
}
