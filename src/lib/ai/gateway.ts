/**
 * Cloudflare AI Gateway — single OpenAI-compatible entry for all LLM providers.
 *
 * Configure (Unified Billing — no BYOK):
 * - `CF_AI_GATEWAY_ACCOUNT_ID` — Cloudflare account id
 * - `CF_AIG_TOKEN` or `CF_AI_GATEWAY_TOKEN` — AI Gateway unified billing token
 * - `CF_AI_GATEWAY_NAME` — gateway slug (e.g. `mygradappy`)
 *
 * Optional BYOK (`CF_AI_GATEWAY_BYOK=1`): pass `GEMINI_API_KEY`, etc. as upstream keys.
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
    process.env.CF_AIG_TOKEN?.trim() ||
    process.env.CF_AI_GATEWAY_TOKEN?.trim() ||
    process.env.CLOUDFLARE_API_TOKEN?.trim()
  );
}

function gatewayName(): string {
  return (
    process.env.CF_AI_GATEWAY_NAME?.trim() ||
    process.env.CF_AI_GATEWAY_ID?.trim() ||
    "default"
  );
}

function gatewayRootUrl(): string {
  const accountId = process.env.CF_AI_GATEWAY_ACCOUNT_ID!.trim();
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayName()}`;
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

/** Unified OpenAI-compat endpoint (`{provider}/{model}` models). */
export function aiGatewayCompatBaseUrl(): string {
  return `${gatewayRootUrl()}/compat`;
}

/** Provider-native gateway paths — only used for BYOK OpenRouter. */
export function aiGatewayProviderBaseUrl(provider: LlmProvider): string {
  if (isAiGatewayByok() && provider === "openrouter") {
    return `${gatewayRootUrl()}/openrouter`;
  }
  return aiGatewayCompatBaseUrl();
}

/** @deprecated alias */
export function aiGatewayBaseUrl(): string {
  return aiGatewayCompatBaseUrl();
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
 * Unified Billing: always send the Cloudflare AI Gateway token as `apiKey`.
 * BYOK: upstream provider API key (+ optional `cf-aig-authorization`).
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
  if (!token) {
    throw new Error(
      "CF_AIG_TOKEN is not configured (Unified Billing AI Gateway token)",
    );
  }
  return token;
}

export function createAiGatewayClient(
  provider: LlmProvider,
  model: string,
): OpenAI {
  const apiKey = resolveGatewayApiKey(provider, model);
  const headers: Record<string, string> = {};
  const cfToken = gatewayToken();

  if (cfToken && isAiGatewayAuthenticated()) {
    headers["cf-aig-authorization"] = `Bearer ${cfToken}`;
  }

  return new OpenAI({
    apiKey,
    baseURL: aiGatewayProviderBaseUrl(provider),
    defaultHeaders: Object.keys(headers).length > 0 ? headers : undefined,
    ...llmClientOptions,
  });
}

/**
 * Map GradApply provider + native model id to the gateway request model field.
 * Compat API: `google-ai-studio/gemini-2.5-flash`, `openai/gpt-4o`, …
 * OpenRouter native: `anthropic/claude-sonnet-4` (no `openrouter/` prefix).
 */
export function toGatewayModel(provider: LlmProvider, model: string): string {
  if (provider === "openrouter") {
    if (model.startsWith("openrouter/")) {
      return model.slice("openrouter/".length);
    }
    return model;
  }

  if (model.includes("/")) {
    const [prefix, ...rest] = model.split("/");
    if (prefix === "google" || prefix === "google-ai-studio") {
      return `google-ai-studio/${rest.join("/")}`;
    }
    return model;
  }

  switch (provider) {
    case "anthropic":
      return `anthropic/${model}`;
    case "openai":
      return `openai/${model}`;
    case "gemini":
      return `google-ai-studio/${model}`;
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
