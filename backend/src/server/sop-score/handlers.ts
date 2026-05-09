// @ts-nocheck
import { runTask } from "@/lib/agents";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { requirePlusForFeature } from "@/lib/plan-gates";

import { bad, ok } from "../_responses";
import { withPlanGate } from "../_with-plan-gate";

import { scoreSopSchema, type SopScoreResponse } from "./schemas";

const FALLBACK_SCORE: SopScoreResponse = {
  persuasiveness: 0,
  clarity: 0,
  tone: [
    { label: "Academic", active: false },
    { label: "Ambitious", active: false },
    { label: "Structured", active: false },
    { label: "Personal", active: false },
  ],
  checklist: [
    { label: "Academic goals stated", done: false },
    { label: "Research background", done: false },
    { label: "Why this school? (specifics)", done: false },
    { label: "Career objectives", done: false },
  ],
};

export const POST = withPlanGate("assistant", async (req, { userId }) => {
  const plusOnly = await requirePlusForFeature(userId, "advanced_sop_feedback");
  if (plusOnly) return plusOnly;

  const json = await req.json().catch(() => null);
  const parsed = scoreSopSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const quota = await billingPrecheckResponse(userId);
  if (quota) return quota;

  try {
    const userPrompt = `Score this SOP draft:\n\n"""\n${parsed.data.body}\n"""`;
    const result = await runTask("sop-scorer", userPrompt, userId, {
      schoolId: parsed.data.schoolId ?? undefined,
    });

    const score = parseScoreResponse(result.reply);
    if (!score) {
      console.warn("[sop-score] failed to parse agent response", {
        userId,
        length: result.reply.length,
        preview: result.reply.slice(0, 200),
      });
      return ok(FALLBACK_SCORE);
    }

    await finalizeAiConsumption(userId);
    return ok(score);
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});

/** Parse the LLM JSON output, tolerating fenced or padded responses. */
function parseScoreResponse(raw: string): SopScoreResponse | null {
  const trimmed = raw.trim();
  // Strip ```json ... ``` fences if the model added them despite instructions.
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    const obj = JSON.parse(candidate) as Partial<SopScoreResponse>;
    if (
      typeof obj.persuasiveness !== "number" ||
      typeof obj.clarity !== "number" ||
      !Array.isArray(obj.tone) ||
      !Array.isArray(obj.checklist)
    ) {
      return null;
    }
    return {
      persuasiveness: clamp(obj.persuasiveness),
      clarity: clamp(obj.clarity),
      tone: obj.tone
        .filter((t): t is { label: string; active: boolean } =>
          typeof t?.label === "string" && typeof t?.active === "boolean",
        )
        .slice(0, 8),
      checklist: obj.checklist
        .filter((c): c is { label: string; done: boolean } =>
          typeof c?.label === "string" && typeof c?.done === "boolean",
        )
        .slice(0, 8),
    };
  } catch {
    return null;
  }
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
