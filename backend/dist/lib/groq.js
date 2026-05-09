// @ts-nocheck
import OpenAI from "openai";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
/** Groq via OpenAI-compatible API. Requires `GROQ_API_KEY`. */
export function createGroqClient() {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey)
        throw new Error("GROQ_API_KEY is not configured");
    return new OpenAI({
        apiKey,
        baseURL: GROQ_BASE_URL,
    });
}
export function groqDefaultModel() {
    return process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
}
export function groqGrammarModel() {
    return process.env.GROQ_MODEL_GRAMMAR?.trim() || groqDefaultModel();
}
