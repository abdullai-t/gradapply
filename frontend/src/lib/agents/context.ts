import { randomUUID } from "crypto";

import type { AgentContext } from "./types";

export function buildAgentContext(userId: string, traceId?: string): AgentContext {
  return {
    userId,
    traceId: traceId ?? randomUUID(),
    toolCache: new Map(),
    trace: [],
    handoffDepth: 0,
  };
}
