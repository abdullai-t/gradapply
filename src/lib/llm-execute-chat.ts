import Anthropic from "@anthropic-ai/sdk";

import type { LlmProvider } from "@/lib/llm-provider";
import {
  orderedFallbackProviders,
  parseAffordableMaxTokens,
  shouldFallbackToAlternateProvider,
} from "@/lib/llm-credits";
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

  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (!key) throw new Error("ANTHROPIC_API_KEY is not configured");

    const client = new Anthropic({ apiKey: key });
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
    return textBlock && textBlock.type === "text" ? textBlock.text : "";
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
    return typeof content === "string" ? content : "";
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
  return typeof content === "string" ? content : "";
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
}): Promise<{
  text: string;
  provider: LlmProvider;
  model?: string;
  creditFallback: boolean;
}> {
  const { preferredProvider, preferredModel, system, turns, maxTokens } = opts;
  const chain = orderedFallbackProviders(preferredProvider);
  let lastErr: unknown;

  for (const provider of chain) {
    let tokens = maxTokens;
    const useModel =
      provider === preferredProvider ? preferredModel : undefined;

    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        const text = await executeChatTurn({
          provider,
          model: useModel,
          system,
          turns,
          maxTokens: tokens,
        });
        return {
          text,
          provider,
          model: useModel,
          creditFallback: provider !== preferredProvider,
        };
      } catch (e) {
        lastErr = e;
        if (!shouldFallbackToAlternateProvider(e)) throw e;
        const affordable = parseAffordableMaxTokens(e);
        if (affordable !== null) {
          tokens = Math.min(tokens, affordable);
          continue;
        }
        if (tokens > 512) {
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
