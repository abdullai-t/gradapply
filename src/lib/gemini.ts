import OpenAI from "openai";

import { llmClientOptions } from "@/lib/llm-fetch";

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
    ...llmClientOptions,
  });
}

/**
 * Default Gemini model for general-purpose calls.
 *
 * `gemini-2.5-flash` is the current flagship balanced-cost / high-quality
 * model (replaces the deprecated `gemini-2.0-flash`). Override via the
 * `GEMINI_MODEL` env var if you need pro / a specific snapshot.
 */
export function geminiDefaultModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
}

/**
 * Grammar-only calls can use the cheaper, faster lite tier.
 * Override via `GEMINI_MODEL_GRAMMAR`. Falls back to the general default
 * if not set, so existing deploys aren't downgraded silently.
 */
export function geminiGrammarModel(): string {
  return (
    process.env.GEMINI_MODEL_GRAMMAR?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    "gemini-2.5-flash-lite"
  );
}
