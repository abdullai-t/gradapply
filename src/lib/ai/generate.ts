import type { z } from "zod";

import { executeChatTurn } from "@/lib/llm-execute-chat";
import { parseJsonFromLlmText } from "@/lib/parse-llm-json";

import { cacheGet, cacheSet, stableKey } from "./cache";
import { MODELS, type FeatureKey } from "./models";
import { providerModelFromUnifiedSlug } from "./unified-model";

const FALLBACKS: Partial<Record<FeatureKey, FeatureKey>> = {
  cold_email: "profile_fit",
  sop_review: "sop_writer",
  school_intel: "navigator",
};

export async function aiGenerate(
  feature: FeatureKey,
  system: string,
  prompt: string,
  maxTokens = 4096,
): Promise<string> {
  const slug = MODELS[feature];
  const { provider, model } = providerModelFromUnifiedSlug(slug);
  return executeChatTurn({
    provider,
    model,
    system,
    turns: [{ role: "user", content: prompt }],
    maxTokens,
  });
}

export async function aiExtract<T extends z.ZodTypeAny>(
  feature: FeatureKey,
  system: string,
  prompt: string,
  schema: T,
  maxTokens = 4096,
): Promise<z.infer<T>> {
  const text = await aiGenerate(feature, system, prompt, maxTokens);
  const parsed = schema.safeParse(parseJsonFromLlmText(text));
  if (parsed.success) return parsed.data;
  throw new Error(`Could not parse JSON from LLM output for ${feature}`);
}

export async function aiGenerateWithFallback(
  feature: FeatureKey,
  system: string,
  prompt: string,
  maxTokens = 4096,
): Promise<string> {
  try {
    return await aiGenerate(feature, system, prompt, maxTokens);
  } catch (err) {
    const fallback = FALLBACKS[feature];
    if (!fallback) throw err;
    return aiGenerate(fallback, system, prompt, maxTokens);
  }
}

export async function cachedAiGenerate(
  feature: FeatureKey,
  cacheNamespace: string,
  cacheInput: Record<string, unknown>,
  system: string,
  prompt: string,
  maxTokens = 4096,
): Promise<string> {
  const key = stableKey({ feature, ...cacheInput });
  const hit = await cacheGet<string>(cacheNamespace, key);
  if (hit) return hit;
  const text = await aiGenerate(feature, system, prompt, maxTokens);
  await cacheSet(cacheNamespace, key, text);
  return text;
}
