/**
 * Cloudflare AI Gateway — single OpenAI-compatible entry for all LLM providers.
 *
 * Configure:
 * - `CF_AI_GATEWAY_ACCOUNT_ID` — Cloudflare account id
 * - `CF_AI_GATEWAY_TOKEN` or `CLOUDFLARE_API_TOKEN` — API token (AI Gateway Read/Edit)
 * - `CF_AI_GATEWAY_NAME` — gateway slug (default: `default`)
 * - `CF_AI_GATEWAY_BYOK=1` — pass upstream provider API keys (BYOK); otherwise use stored keys in the dashboard
 *
 * @see https://developers.cloudflare.com/ai-gateway/usage/chat-completion/
 */
import OpenAI from "openai";
import type { z } from "zod";

import type { LlmProvider } from "@/lib/llm-provider";
import { llmClientOptions } from "@/lib/llm-fetch";
import { parseJsonFromLlmText } from "@/lib/parse-llm-json";

import { cacheGet, cacheSet, stableKey } from "./cache";
import { AGENT_MODEL_FEATURE, MODELS, type FeatureKey } from "./models";

export { MODELS, AGENT_MODEL_FEATURE, type FeatureKey };
export { cacheGet, cacheSet, stableKey } from "./cache";

function gatewayToken(): string | undefined {
  return (
    process.env.CF_AI_GATEWAY_TOKEN?.trim() ||
    process.env.CLOUDFLARE_API_TOKEN?.trim()
  );
}

export function isAiGatewayEnabled(): boolean {
  return !!(
    process.env.CF_AI_GATEWAY_ACCOUNT_ID?.trim() && gatewayToken()
  );
}

export function isAiGatewayByok(): boolean {
  const raw = process.env.CF_AI_GATEWAY_BYOK?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function aiGatewayBaseUrl(): string {
  const accountId = process.env.CF_AI_GATEWAY_ACCOUNT_ID!.trim();
  const gatewayName =
    process.env.CF_AI_GATEWAY_NAME?.trim() ||
    process.env.CF_AI_GATEWAY_ID?.trim() ||
    "default";
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayName}/compat`;
}

function upstreamApiKey(provider: LlmProvider): string | undefined {
  switch (provider) {
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY?.trim();
    case "openai":
      return process.env.OPENAI_API_KEY?.trim();
    case "gemini":
      return process.env.GEMINI_API_KEY?.trim();
    case "groq":
      return process.env.GROQ_API_KEY?.trim();
    case "openrouter":
      return process.env.OPENROUTER_API_KEY?.trim();
    default:
      return undefined;
  }
}

function isAiGatewayAuthenticated(): boolean {
  const raw = process.env.CF_AI_GATEWAY_AUTHENTICATED?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return isAiGatewayByok();
}

function gatewayProviderFromModel(model: string): LlmProvider | null {
  const prefix = model.split("/")[0]?.toLowerCase();
  if (prefix === "openrouter") return "openrouter";
  if (prefix === "anthropic") return "anthropic";
  if (prefix === "openai") return "openai";
  if (prefix === "google-ai-studio" || prefix === "google") return "gemini";
  if (prefix === "groq") return "groq";
  return null;
}

/**
 * Resolve the API key sent to the gateway compat endpoint.
 * BYOK: upstream provider key. Stored keys: Cloudflare token.
 */
export function resolveGatewayApiKey(provider: LlmProvider, model: string): string {
  if (isAiGatewayByok()) {
    const inferred = model.includes("/")
      ? gatewayProviderFromModel(model)
      : provider;
    const key = upstreamApiKey(inferred ?? provider);
    if (!key) {
      throw new Error(
        `CF_AI_GATEWAY_BYOK is enabled but no API key is set for provider "${inferred ?? provider}"`,
      );
    }
    return key;
  }

  const token = gatewayToken();
  if (!token) throw new Error("CF_AI_GATEWAY_TOKEN is not configured");
  return token;
}

export function createAiGatewayClient(
  provider: LlmProvider,
  model: string,
): OpenAI {
  const gatewayModel = toGatewayModel(provider, model);
  const apiKey = resolveGatewayApiKey(provider, gatewayModel);
  const headers: Record<string, string> = {};
  const cfToken = gatewayToken();

  if (cfToken && isAiGatewayAuthenticated()) {
    headers["cf-aig-authorization"] = `Bearer ${cfToken}`;
  }

  return new OpenAI({
    apiKey,
    baseURL: aiGatewayBaseUrl(),
    defaultHeaders: Object.keys(headers).length > 0 ? headers : undefined,
    ...llmClientOptions,
  });
}

/** Map GradApply provider + native model id to a gateway unified model slug. */
export function toGatewayModel(provider: LlmProvider, model: string): string {
  if (provider === "openrouter") {
    if (model.startsWith("openrouter/")) return model;
    return model.includes("/") ? `openrouter/${model}` : `openrouter/${model}`;
  }

  if (model.includes("/")) {
    const [prefix, ...rest] = model.split("/");
    if (prefix === "google" || prefix === "google-ai-studio") {
      return `google/${rest.join("/")}`;
    }
    return model;
  }

  switch (provider) {
    case "anthropic":
      return `anthropic/${model}`;
    case "openai":
      return `openai/${model}`;
    case "gemini":
      return `google/${model}`;
    case "groq":
      return `groq/${model}`;
    default:
      return model;
  }
}

export function gatewayModelForAgent(
  agentId: string | undefined,
  provider: LlmProvider,
  model: string,
): string {
  if (agentId) {
    const feature = AGENT_MODEL_FEATURE[agentId];
    if (feature) return MODELS[feature];
  }
  return toGatewayModel(provider, model);
}

export type GatewayChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function gatewayChatCompletion(opts: {
  provider: LlmProvider;
  model: string;
  messages: GatewayChatMessage[];
  maxTokens: number;
}): Promise<string> {
  const gatewayModel = toGatewayModel(opts.provider, opts.model);
  const client = createAiGatewayClient(opts.provider, gatewayModel);
  const completion = await client.chat.completions.create({
    model: gatewayModel,
    messages: opts.messages,
    max_tokens: opts.maxTokens,
  });
  const content = completion.choices[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

export async function* gatewayChatCompletionStream(opts: {
  provider: LlmProvider;
  model: string;
  messages: GatewayChatMessage[];
  maxTokens: number;
}): AsyncGenerator<string, string, unknown> {
  const gatewayModel = toGatewayModel(opts.provider, opts.model);
  const client = createAiGatewayClient(opts.provider, gatewayModel);
  const stream = await client.chat.completions.create({
    model: gatewayModel,
    messages: opts.messages,
    max_tokens: opts.maxTokens,
    stream: true,
  });

  let accumulated = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) {
      accumulated += delta;
      yield delta;
    }
  }
  return accumulated;
}

export async function aiGenerate(
  feature: FeatureKey,
  system: string,
  prompt: string,
  maxTokens = 4096,
): Promise<string> {
  const model = MODELS[feature];
  const provider = gatewayProviderFromModel(model) ?? "openai";
  return gatewayChatCompletion({
    provider,
    model,
    maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
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
  throw new Error(`Could not parse JSON from gateway output for ${feature}`);
}

const FALLBACKS: Partial<Record<FeatureKey, FeatureKey>> = {
  cold_email: "profile_fit",
  sop_review: "sop_writer",
  school_intel: "navigator",
};

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
