// @ts-nocheck
import OpenAI from "openai";
/** Native OpenAI API (not OpenRouter). Requires `OPENAI_API_KEY`. */
export function createDirectOpenAIClient() {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey)
        throw new Error("OPENAI_API_KEY is not configured");
    return new OpenAI({ apiKey });
}
export function openAiDefaultModel() {
    return process.env.OPENAI_MODEL?.trim() || "gpt-4o";
}
export function openAiGrammarModel() {
    return process.env.OPENAI_MODEL_GRAMMAR?.trim() || "gpt-4o-mini";
}
