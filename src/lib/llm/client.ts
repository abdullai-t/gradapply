import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import { MODELS } from "./models";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export type OpenRouterMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "system";
      content: Array<{
        type: "text";
        text: string;
        cache_control?: { type: "ephemeral" };
      }>;
    };

interface CallOptions {
  model: string;
  messages: OpenRouterMessage[];
  maxTokens: number;
  responseFormat?: { type: string; [key: string]: unknown };
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function callOpenRouter(
  options: CallOptions,
  retries = 3,
): Promise<{
  choices: Array<{ message: { content: string | null } }>;
  usage: { prompt_tokens: number; completion_tokens: number };
}> {
  const { model, messages, maxTokens, responseFormat } = options;
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages,
  };
  if (responseFormat) body.response_format = responseFormat;

  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER ?? "https://gradapply.app",
        "X-Title": process.env.OPENROUTER_APP_TITLE ?? "GradApply",
        "anthropic-beta": "prompt-caching-2024-07-31",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      return res.json() as Promise<{
        choices: Array<{ message: { content: string | null } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
      }>;
    }

    const status = res.status;
    if ((status === 429 || status >= 500) && attempt < retries - 1) {
      await sleep(2 ** attempt * 600 + Math.random() * 200);
      continue;
    }
    throw new Error(`OpenRouter ${status}: ${await res.text()}`);
  }

  throw new Error("OpenRouter: retries exhausted");
}

export async function logCost({
  userId,
  feature,
  model,
  usage,
  qualityScore,
}: {
  userId: string;
  feature: string;
  model: string;
  usage: { prompt_tokens: number; completion_tokens: number };
  qualityScore?: number | null;
}) {
  try {
    const tier = Object.values(MODELS).find((m) => m.id === model);
    if (!tier) return;
    const inputCost = (usage.prompt_tokens / 1e6) * tier.inputPer1M;
    const outputCost = (usage.completion_tokens / 1e6) * tier.outputPer1M;
    const score =
      qualityScore != null && Number.isFinite(qualityScore)
        ? Math.min(1, Math.max(0, qualityScore))
        : null;

    void prisma.llmCostLog
      .create({
        data: {
          userId,
          feature,
          model,
          inputCost,
          outputCost,
          qualityScore: score,
        },
      })
      .catch(() => {});

    log.info("llm.cost", {
      userId,
      feature,
      model,
      costUsd: Number((inputCost + outputCost).toFixed(6)),
      qualityScore: score,
    });
  } catch {
    // never crash a user request over logging
  }
}
