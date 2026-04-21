import OpenAI from "openai";

/**
 * Gemini via Google AI Studio OpenAI-compatible endpoint.
 * Requires `GEMINI_API_KEY`.
 */
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";

export function createGeminiClient(): OpenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new OpenAI({
    apiKey,
    baseURL: GEMINI_BASE_URL,
  });
}

export function geminiDefaultModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
}

export function geminiGrammarModel(): string {
  return process.env.GEMINI_MODEL_GRAMMAR?.trim() || geminiDefaultModel();
}
