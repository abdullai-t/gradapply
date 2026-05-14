import OpenAI from "openai";

import { llmClientOptions } from "@/lib/llm-fetch";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

/** Groq via OpenAI-compatible API. Requires `GROQ_API_KEY`. */
export function createGroqClient(): OpenAI {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");
  return new OpenAI({
    apiKey,
    baseURL: GROQ_BASE_URL,
    ...llmClientOptions,
  });
}

export function groqDefaultModel(): string {
  return process.env.GROQ_MODEL?.trim() || "llama-3.3-70b-versatile";
}

export function groqGrammarModel(): string {
  return process.env.GROQ_MODEL_GRAMMAR?.trim() || groqDefaultModel();
}
