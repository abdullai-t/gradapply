/**
 * Cloudflare AI Gateway via the official `ai-gateway-provider` + Vercel AI SDK.
 *
 * Unified Billing (no BYOK) — match the Cloudflare dashboard snippet:
 *   CF_AI_GATEWAY_ACCOUNT_ID, CF_AIG_TOKEN, CF_AI_GATEWAY_NAME=mygradappy
 *
 * @see https://developers.cloudflare.com/ai-gateway/integrations/vercel-ai-sdk/
 */
import { createAiGateway } from "ai-gateway-provider";
import { createUnified } from "ai-gateway-provider/providers/unified";
import { generateText, streamText } from "ai";
import type { z } from "zod";

import type { LlmProvider } from "@/lib/llm-provider";
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
    "mygradappy"
  );
}

function accountId(): string | undefined {
  return process.env.CF_AI_GATEWAY_ACCOUNT_ID?.trim();
}

export function isAiGatewayEnabled(): boolean {
  return !!(accountId() && gatewayToken());
}

/** Legacy BYOK flag — when set, `llm-execute-chat` uses direct provider SDKs instead. */
export function isAiGatewayByok(): boolean {
  const raw = process.env.CF_AI_GATEWAY_BYOK?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

let gatewayInstance: ReturnType<typeof createAiGateway> | null = null;
const unified = createUnified();

function getAiGateway() {
  if (!gatewayInstance) {
    const id = accountId();
    const token = gatewayToken();
    if (!id || !token) {
      throw new Error(
        "CF_AI_GATEWAY_ACCOUNT_ID and CF_AIG_TOKEN are required for AI Gateway",
      );
    }
    gatewayInstance = createAiGateway({
      accountId: id,
      gateway: gatewayName(),
      apiKey: token,
    });
  }
  return gatewayInstance;
}

function gatewayModel(provider: LlmProvider, model: string): string {
  if (provider === "openrouter") {
    if (model.startsWith("openrouter/")) return model;
    return model.includes("/") ? `openrouter/${model}` : `openrouter/${model}`;
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

export function toGatewayModel(provider: LlmProvider, model: string): string {
  return gatewayModel(provider, model);
}

export type GatewayChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function buildPrompt(messages: GatewayChatMessage[]): {
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
} {
  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content);
  const system =
    systemParts.length > 0 ? systemParts.join("\n\n") : undefined;
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  return { system, messages: chatMessages };
}

export async function gatewayChatCompletion(opts: {
  provider: LlmProvider;
  model: string;
  messages: GatewayChatMessage[];
  maxTokens: number;
}): Promise<string> {
  const slug = gatewayModel(opts.provider, opts.model);
  const aigateway = getAiGateway();
  const { system, messages } = buildPrompt(opts.messages);

  const { text } = await generateText({
    model: aigateway(unified(slug)),
    system,
    messages,
    maxOutputTokens: opts.maxTokens,
  });

  return text;
}

export async function* gatewayChatCompletionStream(opts: {
  provider: LlmProvider;
  model: string;
  messages: GatewayChatMessage[];
  maxTokens: number;
}): AsyncGenerator<string, string, unknown> {
  const slug = gatewayModel(opts.provider, opts.model);
  const aigateway = getAiGateway();
  const { system, messages } = buildPrompt(opts.messages);

  const result = streamText({
    model: aigateway(unified(slug)),
    system,
    messages,
    maxOutputTokens: opts.maxTokens,
  });

  let accumulated = "";
  for await (const chunk of result.textStream) {
    accumulated += chunk;
    yield chunk;
  }
  return accumulated;
}

export async function aiGenerate(
  feature: FeatureKey,
  system: string,
  prompt: string,
  maxTokens = 4096,
): Promise<string> {
  const slug = MODELS[feature];
  const aigateway = getAiGateway();
  const { text } = await generateText({
    model: aigateway(unified(slug)),
    system,
    prompt,
    maxOutputTokens: maxTokens,
  });
  return text;
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

/** @deprecated use gateway via ai-gateway-provider */
export function aiGatewayBaseUrl(): string {
  const id = accountId() ?? "{account_id}";
  return `https://gateway.ai.cloudflare.com/v1/${id}/${gatewayName()}/compat`;
}

/** @deprecated */
export function resolveGatewayApiKey(): string {
  const token = gatewayToken();
  if (!token) throw new Error("CF_AIG_TOKEN is not configured");
  return token;
}

/** @deprecated */
export function createAiGatewayClient(): never {
  throw new Error("createAiGatewayClient is deprecated; use ai-gateway-provider");
}
