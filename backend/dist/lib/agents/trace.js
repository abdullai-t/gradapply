export function emitTrace(ctx, agentId, event, data = {}, durationMs) {
    const entry = {
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
