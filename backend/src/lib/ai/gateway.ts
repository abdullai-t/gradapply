/**
 * Vercel AI Gateway — single entry for model IDs + AI SDK helpers.
 * Configure `VERCEL_AI_GATEWAY_URL` + `VERCEL_AI_GATEWAY_KEY` (see Vercel dashboard → AI).
 */
import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, streamText, zodSchema } from "ai";
import type { z } from "zod";

function envModel(envKey: string, fallback: string): string {
  const v = process.env[envKey]?.trim();
  return v || fallback;
}

const gatewayBase =
  process.env.VERCEL_AI_GATEWAY_URL?.trim() ||
  "https://ai-gateway.vercel.sh/v1";

const gatewayKey = process.env.VERCEL_AI_GATEWAY_KEY?.trim() || "";

export const gateway = createOpenAI({
  baseURL: gatewayBase,
  apiKey: gatewayKey,
});

/** Tiered routing — override any via `AI_MODEL_*` env (full gateway model id). */
export const MODELS = {
  deadline_extract: envModel(
    "AI_MODEL_DEADLINE_EXTRACT",
    "deepseek/deepseek-v4-flash",
  ),
  status_classify: envModel(
    "AI_MODEL_STATUS_CLASSIFY",
    "deepseek/deepseek-v4-flash",
  ),
  profile_fit: envModel(
    "AI_MODEL_PROFILE_FIT",
    "deepseek/deepseek-v4-pro",
  ),
  program_search: envModel(
    "AI_MODEL_PROGRAM_SEARCH",
    "google/gemini-3.1-flash-lite",
  ),
  professor_lookup: envModel(
    "AI_MODEL_PROFESSOR_LOOKUP",
    "google/gemini-3.1-flash-lite",
  ),
  cold_email: envModel(
    "AI_MODEL_COLD_EMAIL",
    "anthropic/claude-opus-4.7",
  ),
  sop_review: envModel(
    "AI_MODEL_SOP_REVIEW",
    "anthropic/claude-opus-4.7",
  ),
} as const;

export type FeatureKey = keyof typeof MODELS;

export async function aiExtract<T extends z.ZodTypeAny>(
  feature: FeatureKey,
  system: string,
  prompt: string,
  schema: T,
): Promise<z.infer<T>> {
  const { object } = await generateObject({
    model: gateway(MODELS[feature]),
    schema: zodSchema(schema),
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });
  return object as z.infer<T>;
}

export async function aiGenerate(
  feature: FeatureKey,
  system: string,
  prompt: string,
): Promise<string> {
  const { text } = await generateText({
    model: gateway(MODELS[feature]),
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });
  return text;
}

export function aiStream(feature: FeatureKey, system: string, prompt: string) {
  return streamText({
    model: gateway(MODELS[feature]),
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  });
}

const FALLBACKS: Partial<Record<FeatureKey, FeatureKey>> = {
  cold_email: "profile_fit",
  sop_review: "cold_email",
};

export async function aiExtractWithFallback<T extends z.ZodTypeAny>(
  feature: FeatureKey,
  system: string,
  prompt: string,
  schema: T,
): Promise<z.infer<T>> {
  try {
    return await aiExtract(feature, system, prompt, schema);
  } catch (err) {
    const fallback = FALLBACKS[feature];
    if (!fallback) throw err;
    console.warn(
      `[ai-gateway] ${feature} failed → fallback ${MODELS[fallback]}`,
      err,
    );
    return aiExtract(fallback, system, prompt, schema);
  }
}
