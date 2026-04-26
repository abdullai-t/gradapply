import { completeOneShotLlm } from "@/lib/ai";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { prisma } from "@/lib/prisma";

import { bad, ok } from "../_responses";
import { withPlanGate } from "../_with-plan-gate";

import { scoreSopSchema, type SopScoreResponse } from "./schemas";

const SCORE_SYSTEM_PROMPT = `You are an admissions writing coach. Score a graduate-school statement of purpose (SOP) draft on persuasiveness, clarity, tone, and a structural checklist.

Return ONLY valid JSON matching this exact shape — no prose, no markdown fences:

{
  "persuasiveness": <integer 0-100>,
  "clarity": <integer 0-100>,
  "tone": [
    { "label": "Academic",   "active": <bool> },
    { "label": "Ambitious",  "active": <bool> },
    { "label": "Structured", "active": <bool> },
    { "label": "Personal",   "active": <bool> }
  ],
  "checklist": [
    { "label": "Academic goals stated",      "done": <bool> },
    { "label": "Research background",        "done": <bool> },
    { "label": "Why this school? (specifics)", "done": <bool> },
    { "label": "Career objectives",          "done": <bool> }
  ]
}

Persuasiveness: how compellingly the draft argues the applicant's fit and motivation.
Clarity: how readable and well-structured the prose is.
Tone: which descriptors apply (multiple may be active; at least one should be).
Checklist: whether each element is concretely present in the draft.`;

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
  const json = await req.json().catch(() => null);
  const parsed = scoreSopSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const quota = await billingPrecheckResponse(userId);
  if (quota) return quota;

  let schoolContext = "";
  if (parsed.data.schoolId) {
    const school = await prisma.school.findFirst({
      where: { id: parsed.data.schoolId, userId },
      select: { name: true, program: true, degree: true },
    });
    if (school) {
      schoolContext = `Target school: ${school.name}${school.program ? ` — ${school.program}` : ""}${school.degree ? ` (${school.degree})` : ""}.\n\n`;
    }
  }

  const userPrompt = `${schoolContext}Score this SOP draft:\n\n"""\n${parsed.data.body}\n"""`;

  let raw: string;
  try {
    raw = await completeOneShotLlm({
      system: SCORE_SYSTEM_PROMPT,
      user: userPrompt,
      maxTokens: 1500,
      qualityMode: "balanced",
    });
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }

  const score = parseScoreResponse(raw);
  if (!score) {
    console.warn("[sop-score] failed to parse LLM response", {
      userId,
      length: raw.length,
      preview: raw.slice(0, 200),
    });
    return ok(FALLBACK_SCORE);
  }

  await finalizeAiConsumption(userId);
  return ok(score);
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
