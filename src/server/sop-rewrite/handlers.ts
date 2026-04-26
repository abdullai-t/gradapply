import { completeOneShotLlm } from "@/lib/ai";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { prisma } from "@/lib/prisma";

import { bad, ok } from "../_responses";
import { withPlanGate } from "../_with-plan-gate";

import {
  rewriteSelectionSchema,
  type RewriteSelectionResponse,
} from "./schemas";

const SELECTION_SYSTEM_PROMPT = `You are an admissions writing assistant. The applicant will give you a SHORT extract from their statement of purpose plus an instruction.

Return ONLY the rewritten extract. No preamble, no markdown fences, no explanation, no surrounding quotes — just the new text that will replace the original verbatim. Keep paragraph structure compatible with the original (one paragraph in → one paragraph out; multi-paragraph → multi-paragraph).

If the instruction is unclear, ambiguous, or you decide no change is warranted, return the original text unchanged.`;

const DOCUMENT_SYSTEM_PROMPT = `You are an admissions writing assistant. The applicant will give you a FULL draft of their statement of purpose plus an instruction.

Return ONLY the rewritten draft. No preamble, no markdown fences, no explanation, no surrounding quotes — just the new full draft. Preserve paragraph breaks (use blank lines between paragraphs). Maintain the applicant's voice and factual claims; do not invent new facts about programs, faculty, or labs.`;

/**
 * POST /api/sop/rewrite
 *
 * Returns a rewritten chunk of SOP text — selection-scoped or whole-doc.
 * Strictly text-in, text-out: the client decides whether to apply it.
 * No conversation, no follow-up suggestions in the response body.
 */
export const POST = withPlanGate("assistant", async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = rewriteSelectionSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const quota = await billingPrecheckResponse(userId);
  if (quota) return quota;

  let schoolContext = "";
  if (parsed.data.schoolId) {
    const school = await prisma.school.findFirst({
      where: { id: parsed.data.schoolId, userId },
      select: { name: true, program: true, degree: true, country: true },
    });
    if (school) {
      schoolContext = [
        `Target school: ${school.name}`,
        school.program && `Program: ${school.program}`,
        school.degree && `Degree: ${school.degree}`,
        school.country && `Country: ${school.country}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  const system =
    parsed.data.scope === "document"
      ? DOCUMENT_SYSTEM_PROMPT
      : SELECTION_SYSTEM_PROMPT;

  const userPrompt = [
    schoolContext ? `${schoolContext}\n` : "",
    `Instruction: ${parsed.data.prompt}`,
    "",
    "Original text:",
    `"""\n${parsed.data.originalText}\n"""`,
  ]
    .filter(Boolean)
    .join("\n");

  let raw: string;
  try {
    raw = await completeOneShotLlm({
      system,
      user: userPrompt,
      // Allow generous headroom — selection rewrites are tiny but a full-doc
      // rewrite can be a few thousand tokens. The chat path uses 8k for SOP;
      // we mirror that for "document" scope.
      maxTokens: parsed.data.scope === "document" ? 8192 : 2048,
      qualityMode: "high",
    });
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }

  const newText = stripWrapping(raw);
  await finalizeAiConsumption(userId);

  const response: RewriteSelectionResponse = {
    newText,
    unchanged: normalize(newText) === normalize(parsed.data.originalText),
  };

  return ok(response);
});

/**
 * The system prompt forbids preambles and fences but models occasionally
 * disobey ("Sure, here's the rewrite:" or wrapping in ```). Strip the most
 * common offenders so the client gets a clean replacement.
 */
function stripWrapping(raw: string): string {
  let text = raw.trim();
  // Strip surrounding triple-backticks (with optional language tag).
  const fenced = text.match(/^```(?:\w+)?\s*([\s\S]+?)\s*```$/);
  if (fenced) text = fenced[1].trim();
  // Strip a chatty preamble like "Here's the revised text:" or
  // "Sure, here is your rewrite —" if it's followed by the actual content.
  const preambled = text.match(
    /^(?:sure[,!.]?\s*)?(?:here(?:'s| is| are)\s+(?:the\s+)?(?:revised|rewritten|updated|new)?\s*(?:text|version|paragraph|draft|sentence)?\s*[:\-—.]?\s*)\n+([\s\S]+)/i,
  );
  if (preambled) text = preambled[1].trim();
  // Strip surrounding quotes if the model echoed the """ delimiter style.
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}
