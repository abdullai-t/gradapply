import OpenAI from "openai";

import { llmClientOptions } from "@/lib/llm-fetch";

/** Native OpenAI API (not OpenRouter). Requires `OPENAI_API_KEY`. */
export function createDirectOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({ apiKey, ...llmClientOptions });
}

export function openAiDefaultModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o";
}

export function openAiGrammarModel(): string {
  return process.env.OPENAI_MODEL_GRAMMAR?.trim() || "gpt-4o-mini";
}
