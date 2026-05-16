import fs from "node:fs";
import path from "node:path";

import { cacheGet, cacheSet } from "./cache";
import { callOpenRouter, logCost, type OpenRouterMessage } from "./client";
import { MODELS, TASK_CONFIG, type ModelTier, type TaskName } from "./models";
import { scoreOutput } from "./qualityGate";

function loadSystemPrompt(task: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), "prompts", "system", `${task}.txt`),
    "utf8",
  );
}

function buildMessages(
  systemPrompt: string,
  staticContext: string,
  dynamicContent: string,
  supportsCache: boolean,
): OpenRouterMessage[] {
  const staticText = `${systemPrompt}\n\n${staticContext}`.trim();

  if (supportsCache) {
    return [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: staticText,
            cache_control: { type: "ephemeral" },
          },
        ],
      },
      { role: "user", content: dynamicContent },
    ];
  }

  return [
    { role: "system", content: staticText },
    { role: "user", content: dynamicContent },
  ];
}

function parseJsonContent(raw: string | null): unknown {
  if (!raw) throw new Error("Empty model output");
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  }
}

export interface OrchestrateOptions {
  task: TaskName;
  staticContext: string;
  dynamicContent: string;
  userId: string;
  forceTier?: ModelTier;
}

export async function orchestrate({
  task,
  staticContext,
  dynamicContent,
  userId,
  forceTier,
}: OrchestrateOptions): Promise<{
  result: unknown;
  source: "cache" | "llm";
  score?: number;
  tier?: ModelTier;
}> {
  const config = TASK_CONFIG[task];

  const cacheKey = dynamicContent.slice(0, 200);
  const cached = await cacheGet(task, cacheKey);
  if (cached !== null) return { result: cached, source: "cache" };

  const tier = forceTier ?? config.defaultTier;
  const model = MODELS[tier];
  const messages = buildMessages(
    loadSystemPrompt(task),
    staticContext,
    dynamicContent,
    model.supportsCache,
  );

  const response = await callOpenRouter({
    model: model.id,
    maxTokens: config.maxTokens,
    messages,
    responseFormat: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "";
  let parsed: unknown = parseJsonContent(raw);

  const judged = await scoreOutput(task, raw, { userId });
  const score = judged.score;
  let finalTier: ModelTier = tier;
  let finalScore = score;

  if (score < config.qualityThreshold && tier !== config.escalateTo) {
    const escalateTo = config.escalateTo;
    if (escalateTo !== tier) {
      console.log(`[escalate] ${task}: ${score.toFixed(2)} → ${escalateTo}`);

      const escalateModel = MODELS[escalateTo];
      const escalated = await callOpenRouter({
        model: escalateModel.id,
        maxTokens: config.maxTokens,
        messages: [
          ...messages,
          { role: "assistant", content: raw },
          {
            role: "user",
            content: `Score: ${score.toFixed(2)}/1.0. Improve this — be more specific and actionable.`,
          },
        ],
        responseFormat: { type: "json_object" },
      });

      const escalatedRaw = escalated.choices[0]?.message?.content ?? "";
      parsed = parseJsonContent(escalatedRaw);
      finalTier = escalateTo;
      const escalatedJudged = await scoreOutput(task, escalatedRaw, { userId });
      finalScore = escalatedJudged.score;
      await logCost({
        userId,
        feature: `${task}_escalated`,
        model: escalateModel.id,
        usage: escalated.usage ?? { prompt_tokens: 0, completion_tokens: 0 },
        qualityScore: escalatedJudged.score,
      });
    }
  }

  await logCost({
    userId,
    feature: task,
    model: model.id,
    usage: response.usage ?? { prompt_tokens: 0, completion_tokens: 0 },
    qualityScore: finalTier === tier ? finalScore : score,
  });

  await cacheSet(task, cacheKey, parsed);

  return { result: parsed, source: "llm", score: finalScore, tier: finalTier };
}
