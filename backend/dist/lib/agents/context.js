// @ts-nocheck
import { randomUUID } from "crypto";
export function buildAgentContext(userId, traceId) {
    return {
        userId,
        traceId: traceId ?? randomUUID(),
        toolCache: new Map(),
        trace: [],
        handoffDepth: 0,
    };
}
