import Anthropic from "@anthropic-ai/sdk";

import type { LlmProvider } from "@/lib/llm-provider";
import {
  classifyLlmErrorClass,
  orderedFallbackProviders,
  parseAffordableMaxTokens,
  shouldFallbackToAlternateProvider,
} from "@/lib/llm-credits";
import { log } from "@/lib/logger";
import {
  gatewayChatCompletion,
  gatewayChatCompletionStream,
  isAiGatewayByok,
  isAiGatewayEnabled,
} from "@/lib/ai/gateway";
import { llmClientOptions } from "@/lib/llm-fetch";
import { createGeminiClient, geminiDefaultModel } from "@/lib/gemini";
import { createGroqClient, groqDefaultModel } from "@/lib/groq";
import {
  acquireProviderLease,
  getProviderRuntimeStatus,
  recordProviderFailure,
  recordProviderSuccess,
  reduceTokensForProviderLoad,
  releaseProviderLease,
} from "@/lib/llm-router";
import { createDirectOpenAIClient } from "@/lib/openai-direct";
import { createOpenRouterClient } from "@/lib/openrouter";

export type ChatTurn = { role: "user" | "assistant"; content: string };

function anthropicDefaultModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";
}

function openRouterDefaultModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || "anthropic/claude-sonnet-4";
}

function openAiFallbackModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o";
}
function geminiFallbackModel(): string {
  return geminiDefaultModel();
}

function groqFallbackModel(): string {
  return groqDefaultModel();
}

function defaultModelForProvider(provider: LlmProvider): string {
  switch (provider) {
    case "anthropic":
      return anthropicDefaultModel();
    case "openrouter":
      return openRouterDefaultModel();
    case "gemini":
      return geminiFallbackModel();
    case "groq":
      return groqFallbackModel();
    default:
      return openAiFallbackModel();
  }
}

/**
 * Runs one assistant turn using the chosen provider + model.
 */
export async function executeChatTurn(opts: {
  provider: LlmProvider;
  /** Provider-native model id */
  model?: string;
  system: string;
  turns: ChatTurn[];
  maxTokens: number;
}): Promise<string> {
  const { provider, model, system, turns, maxTokens } = opts;
  const lease = await acquireProviderLease(provider);
  const startedAt = Date.now();
  const done = (text: string): string => {
    recordProviderSuccess(provider, Date.now() - startedAt);
    return text;
  };
  try {
    if (isAiGatewayEnabled() && !isAiGatewayByok()) {
      const text = await gatewayChatCompletion({
        provider,
        model: model ?? defaultModelForProvider(provider),
        messages: [
          { role: "system", content: system },
          ...turns.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        maxTokens,
      });
      return done(text);
    }

    if (provider === "anthropic") {
      const key = process.env.ANTHROPIC_API_KEY?.trim();
      if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");

      const client = new Anthropic({ apiKey: key, ...llmClientOptions });
      const response = await client.messages.create({
        model: model ?? anthropicDefaultModel(),
        max_tokens: maxTokens,
        system,
        messages: turns.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const textBlock = response.content.find((b) => b.type === "text");
      return done(textBlock && textBlock.type === "text" ? textBlock.text : "");
    }

    if (provider === "openrouter") {
      const client = createOpenRouterClient();
      const completion = await client.chat.completions.create({
        model: model ?? openRouterDefaultModel(),
        messages: [
          { role: "system", content: system },
          ...turns.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        max_tokens: maxTokens,
      });
      const content = completion.choices[0]?.message?.content;
      return done(typeof content === "string" ? content : "");
    }

    if (provider === "gemini") {
      const client = createGeminiClient();
      const completion = await client.chat.completions.create({
        model: model ?? geminiFallbackModel(),
        messages: [
          { role: "system", content: system },
          ...turns.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        max_tokens: maxTokens,
      });
      const content = completion.choices[0]?.message?.content;
      return done(typeof content === "string" ? content : "");
    }

    if (provider === "groq") {
      const client = createGroqClient();
      const completion = await client.chat.completions.create({
        model: model ?? groqFallbackModel(),
        messages: [
          { role: "system", content: system },
          ...turns.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        max_tokens: maxTokens,
      });
      const content = completion.choices[0]?.message?.content;
      return done(typeof content === "string" ? content : "");
    }

    const client = createDirectOpenAIClient();
    const completion = await client.chat.completions.create({
      model: model ?? openAiFallbackModel(),
      messages: [
        { role: "system", content: system },
        ...turns.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      max_tokens: maxTokens,
    });
    const content = completion.choices[0]?.message?.content;
    return done(typeof content === "string" ? content : "");
  } catch (error) {
    recordProviderFailure(provider, classifyLlmErrorClass(error));
    throw error;
  } finally {
    releaseProviderLease(lease);
  }
}

/**
 * Streaming version of executeChatTurn. Yields text chunks as they arrive.
 * Returns the full concatenated text after the generator completes.
 */
export async function* executeChatTurnStream(opts: {
  provider: LlmProvider;
  model?: string;
  system: string;
  turns: ChatTurn[];
  maxTokens: number;
}): AsyncGenerator<string, string, unknown> {
  const { provider, model, system, turns, maxTokens } = opts;
  const lease = await acquireProviderLease(provider);
  const startedAt = Date.now();
  let accumulated = "";

  try {
    if (isAiGatewayEnabled() && !isAiGatewayByok()) {
      const gen = gatewayChatCompletionStream({
        provider,
        model: model ?? defaultModelForProvider(provider),
        messages: [
          { role: "system", content: system },
          ...turns.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ],
        maxTokens,
      });
      for await (const chunk of gen) {
        accumulated += chunk;
        yield chunk;
      }
      recordProviderSuccess(provider, Date.now() - startedAt);
      return accumulated;
    }

    if (provider === "anthropic") {
      const key = process.env.ANTHROPIC_API_KEY?.trim();
      if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");

      const client = new Anthropic({ apiKey: key, ...llmClientOptions });
      const stream = client.messages.stream({
        model: model ?? anthropicDefaultModel(),
        max_tokens: maxTokens,
        system,
        messages: turns.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          accumulated += event.delta.text;
          yield event.delta.text;
        }
      }

      recordProviderSuccess(provider, Date.now() - startedAt);
      return accumulated;
    }

    // OpenAI-compatible providers (openrouter, gemini, groq, openai)
    const client =
      provider === "openrouter"
        ? createOpenRouterClient()
        : provider === "gemini"
          ? createGeminiClient()
          : provider === "groq"
            ? createGroqClient()
            : createDirectOpenAIClient();

    const defaultModel =
      provider === "openrouter"
        ? openRouterDefaultModel()
        : provider === "gemini"
          ? geminiFallbackModel()
          : provider === "groq"
            ? groqFallbackModel()
            : openAiFallbackModel();

    const stream = await client.chat.completions.create({
      model: model ?? defaultModel,
      messages: [
        { role: "system" as const, content: system },
        ...turns.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      max_tokens: maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        accumulated += delta;
        yield delta;
      }
    }

    recordProviderSuccess(provider, Date.now() - startedAt);
    return accumulated;
  } catch (error) {
    recordProviderFailure(provider, classifyLlmErrorClass(error));
    throw error;
  } finally {
    releaseProviderLease(lease);
  }
}

/**
 * Retries with lower max_tokens when OpenRouter (etc.) returns 402, then tries other configured providers.
 */
export async function executeChatTurnWithCreditFallback(opts: {
  preferredProvider: LlmProvider;
  preferredModel?: string;
  system: string;
  turns: ChatTurn[];
  maxTokens: number;
  qualityMode?: "balanced" | "high";
}): Promise<{
  text: string;
  provider: LlmProvider;
  model?: string;
  creditFallback: boolean;
}> {
  const {
    preferredProvider,
    preferredModel,
    system,
    turns,
    maxTokens,
    qualityMode = "balanced",
  } = opts;
  const highQuality = qualityMode === "high";
  const chain = orderedFallbackProviders(preferredProvider);
  let lastErr: unknown;

  for (const provider of chain) {
    let tokens = maxTokens;
    const useModel =
      provider === preferredProvider ? preferredModel : undefined;

    for (let attempt = 0; attempt < 12; attempt++) {
      const status = getProviderRuntimeStatus(provider);
      const shapedTokens = highQuality
        ? tokens
        : reduceTokensForProviderLoad(provider, tokens);
      const startedAt = Date.now();
      try {
        const text = await executeChatTurn({
          provider,
          model: useModel,
          system,
          turns,
          maxTokens: shapedTokens,
        });
        log.debug("llm.attempt.ok", {
          provider,
          model: useModel ?? null,
          inFlight: status.inFlight,
          attempt: attempt + 1,
          fallbackUsed: provider !== preferredProvider,
          circuitState: status.circuitState,
          latencyMs: Date.now() - startedAt,
          maxTokens: shapedTokens,
          replyChars: text.length,
        });
        return {
          text,
          provider,
          model: useModel,
          creditFallback: provider !== preferredProvider,
        };
      } catch (e) {
        lastErr = e;
        const errorClass = classifyLlmErrorClass(e);
        log.warn("llm.attempt.failed", {
          provider,
          model: useModel ?? null,
          inFlight: status.inFlight,
          attempt: attempt + 1,
          fallbackUsed: provider !== preferredProvider,
          circuitState: status.circuitState,
          latencyMs: Date.now() - startedAt,
          errorClass,
          maxTokens: shapedTokens,
          reason: e instanceof Error ? e.message : String(e),
        });
        if (!shouldFallbackToAlternateProvider(e)) throw e;
        const affordable = parseAffordableMaxTokens(e);
        if (affordable !== null) {
          tokens = Math.min(tokens, affordable);
          continue;
        }
        if (!highQuality && tokens > 512) {
          tokens = Math.floor(tokens / 2);
          continue;
        }
        break;
      }
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("LLM request failed after credit fallbacks");
}
