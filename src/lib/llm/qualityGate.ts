import { log } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

import { callOpenRouter, logCost } from "./client";
import { MODELS } from "./models";

const GATE_PROMPT = `You are a strict quality judge for a graduate admissions AI tool.
Rate AI output quality from 0.0 to 1.0:
- 0.0–0.4: Off-topic, hallucinated, or missing key content
- 0.5–0.7: Partial — addresses task but lacks depth or specificity
- 0.8–0.9: Good — accurate, relevant, useful
- 1.0: Excellent — specific, structured, actionable

Respond ONLY with valid JSON: { "score": 0.85, "reason": "one sentence" }
No preamble, no markdown fences.`;

export type QualityScoreResult = {
  score: number;
  reason: string | null;
};

function clampScore(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseJudgeResponse(raw: string | null): QualityScoreResult {
  if (!raw) return { score: 1.0, reason: null };
  try {
    const parsed = JSON.parse(raw) as { score?: unknown; reason?: unknown };
    const s =
      typeof parsed.score === "number"
        ? parsed.score
        : parseFloat(String(parsed.score ?? ""));
    const score = Number.isFinite(s) ? clampScore(s) : 1.0;
    const reason =
      typeof parsed.reason === "string" && parsed.reason.trim()
        ? parsed.reason.trim()
        : null;
    return { score, reason };
  } catch {
    return { score: 1.0, reason: null };
  }
}

/**
 * Judge model output quality (0–1). Optionally logs judge LLM cost when `userId` is set.
 */
export async function scoreOutput(
  task: string,
  output: string,
  opts?: { userId?: string },
): Promise<QualityScoreResult> {
  try {
    const res = await callOpenRouter({
      model: MODELS.nano.id,
      maxTokens: 80,
      responseFormat: { type: "json_object" },
      messages: [
        { role: "system", content: GATE_PROMPT },
        {
          role: "user",
          content: JSON.stringify({ task, output: output.slice(0, 600) }),
        },
      ],
    });

    if (opts?.userId && res.usage) {
      await logCost({
        userId: opts.userId,
        feature: `quality_gate:${task}`,
        model: MODELS.nano.id,
        usage: res.usage,
      });
    }

    return parseJudgeResponse(res.choices[0]?.message?.content ?? null);
  } catch {
    return { score: 1.0, reason: null };
  }
}

/**
 * Score an LLM output and persist quality to logs + `LlmCostLog` (cost row optional).
 */
export async function recordLlmOutputQuality(opts: {
  userId: string;
  feature: string;
  model: string;
  output: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}): Promise<QualityScoreResult> {
  const judged = await scoreOutput(opts.feature, opts.output, {
    userId: opts.userId,
  });

  log.info("llm.quality", {
    userId: opts.userId,
    feature: opts.feature,
    model: opts.model,
    qualityScore: judged.score,
    qualityReason: judged.reason,
  });

  if (opts.usage) {
    await logCost({
      userId: opts.userId,
      feature: opts.feature,
      model: opts.model,
      usage: opts.usage,
      qualityScore: judged.score,
    });
  } else {
    void prisma.llmCostLog
      .create({
        data: {
          userId: opts.userId,
          feature: opts.feature,
          model: opts.model,
          inputCost: 0,
          outputCost: 0,
          qualityScore: judged.score,
        },
      })
      .catch(() => {});
  }

  return judged;
}

/** Fire-and-forget quality scoring (agent paths). */
export function scheduleLlmOutputQuality(opts: {
  userId: string;
  feature: string;
  model: string;
  output: string;
}): void {
  void recordLlmOutputQuality(opts).catch((e) => {
    log.warn("llm.quality.failed", {
      feature: opts.feature,
      reason: e instanceof Error ? e.message : String(e),
    });
  });
}
