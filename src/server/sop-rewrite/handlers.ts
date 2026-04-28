import { runTask } from "@/lib/agents";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { prisma } from "@/lib/prisma";

import { sanitizeField, wrapUserContent } from "@/lib/agents/sanitize";
import { bad, ok } from "../_responses";
import { withPlanGate } from "../_with-plan-gate";

import {
  rewriteSelectionSchema,
  type RewriteSelectionResponse,
} from "./schemas";

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
        `Target school: ${sanitizeField(school.name)}`,
        school.program && `Program: ${sanitizeField(school.program)}`,
        school.degree && `Degree: ${sanitizeField(school.degree)}`,
        school.country && `Country: ${sanitizeField(school.country)}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  try {
    const agentMessage = [
      schoolContext ? `${schoolContext}\n` : "",
      `Rewrite the following text based on this instruction: ${sanitizeField(parsed.data.prompt, 500)}`,
      "",
      "Return ONLY the rewritten text — no preamble, no markdown fences, no explanation.",
      "",
      wrapUserContent("original text", parsed.data.originalText),
    ].filter(Boolean).join("\n");

    const result = await runTask("sop-writer", agentMessage, userId, {
      ...(parsed.data.schoolId ? { schoolId: parsed.data.schoolId } : {}),
    });

    const newText = stripWrapping(result.reply);
    await finalizeAiConsumption(userId);

    const response: RewriteSelectionResponse = {
      newText,
      unchanged: normalize(newText) === normalize(parsed.data.originalText),
    };
    return ok(response);
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
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
