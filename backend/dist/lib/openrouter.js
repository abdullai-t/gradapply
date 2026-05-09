// @ts-nocheck
import OpenAI from "openai";
/** OpenRouter model slug, e.g. `anthropic/claude-sonnet-4` — see https://openrouter.ai/models */
export function openRouterModel() {
    return (process.env.OPENROUTER_MODEL?.trim() || "anthropic/claude-sonnet-4");
}
export function createOpenRouterClient() {
    const apiKey = process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey)
        throw new Error("OPENROUTER_API_KEY is not configured");
    const referer = process.env.OPENROUTER_SITE_URL?.trim() ||
        process.env.AUTH_URL?.trim() ||
        process.env.NEXTAUTH_URL?.trim() ||
        "http://localhost:3000";
    const title = process.env.OPENROUTER_SITE_TITLE?.trim() || "GradApply";
    return new OpenAI({
        apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
            "HTTP-Referer": referer,
            "X-OpenRouter-Title": title,
        },
    });
}
