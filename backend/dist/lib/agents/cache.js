/**
 * Per-request tool result cache. Keyed by `toolName:stableJSON(input)`.
 * Avoids redundant DB / network calls within a single orchestrator run.
 */
function stableKey(toolName, input) {
    try {
        return `${toolName}:${JSON.stringify(input, Object.keys(input).sort())}`;
    }
    catch {
        return `${toolName}:${String(input)}`;
    }
}
export function getCached(ctx, toolName, input) {
    const key = stableKey(toolName, input);
    return ctx.toolCache.get(key);
}
export function setCached(ctx, toolName, input, value) {
    const key = stableKey(toolName, input);
    ctx.toolCache.set(key, value);
}
