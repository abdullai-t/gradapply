// @ts-nocheck


import { runTask } from "@/lib/agents";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import {
  assertProfEmailLlmAllowed,
  markProfEmailLlmAttempt,
  markProfEmailLlmSuccess,
  type ProfEmailLlmDenial,
} from "@/lib/prof-email-llm-rate-limit";
import { prisma } from "@/lib/prisma";
import { zPrismaRecordId } from "@/lib/prisma-record-id-zod";

import { bad, notFound, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { sanitizeField, wrapUserContent } from "@/lib/agents/sanitize";
import { analyzeReplyBodySchema } from "./schemas";

export const analyzeReply = withAuth<{ id: string }>(
  async (req, { userId, params }) => {
    const idParsed = zPrismaRecordId.safeParse(params.id);
    if (!idParsed.success) return bad("Invalid id.");

    const json = await req.json().catch(() => null);
    const parsed = analyzeReplyBodySchema.safeParse(json);
    if (!parsed.success) return bad(parsed.error.flatten());

    const quota = await billingPrecheckResponse(userId);
    if (quota) return quota;

    try {
      await assertProfEmailLlmAllowed(userId);
    } catch (e) {
      const denial = (e as Error & { denial?: ProfEmailLlmDenial }).denial;
      if (denial) {
        const headers: Record<string, string> = {};
        if (denial.retryAfterSec != null)
          headers.RetryAfter = String(denial.retryAfterSec);
        return Response.json(
          { error: denial.message },
          { status: denial.status, headers },
        );
      }
      throw e;
    }

    await markProfEmailLlmAttempt(userId);

    const { replyText } = parsed.data;

    const row = await prisma.profEmail.findFirst({
      where: { id: idParsed.data, userId },
    });
    if (!row) return notFound();

    let intent: ReplyIntent;
    let rationale: string;
    let suggestedReply: string;

    const VALID_INTENTS: ReplyIntent[] = ["INTERESTED", "NEUTRAL", "DECLINED", "UNKNOWN"];

    try {
      const message = [
        `Analyze this professor's reply and classify their intent.`,
        row.profName ? `Professor: ${sanitizeField(row.profName)}` : "",
        row.university ? `University: ${sanitizeField(row.university)}` : "",
        row.emailSubject ? `Original subject: ${sanitizeField(row.emailSubject)}` : "",
        row.emailBody ? wrapUserContent("original email", row.emailBody) : "",
        wrapUserContent("professor reply", replyText),
        `\nReturn ONLY valid JSON: { "intent": "INTERESTED"|"NEUTRAL"|"DECLINED"|"UNKNOWN", "rationale": string, "suggestedReply": string }`,
      ].filter(Boolean).join("\n");

      const result = await runTask("reply-analyzer", message, userId, {
        profEmailId: row.id,
      });

      const raw = result.reply.trim();
      const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      const candidate = fenced ? fenced[1] : raw;
      const parsed2 = JSON.parse(candidate) as {
        intent?: string;
        rationale?: string;
        suggestedReply?: string;
      };
      const rawIntent = (parsed2.intent ?? "UNKNOWN").toUpperCase() as ReplyIntent;
      intent = VALID_INTENTS.includes(rawIntent) ? rawIntent : "UNKNOWN";
      rationale = parsed2.rationale ?? "";
      suggestedReply = parsed2.suggestedReply ?? "";
    } catch (e) {
      return bad(formatLlmFailureMessage(e), 500);
    }

    const snippet =
      replyText.trim().length > 2000
        ? `${replyText.trim().slice(0, 1997)}…`
        : replyText.trim();

    const updated = await prisma.profEmail.update({
      where: { id: row.id },
      data: {
        lastReplySnippet: snippet,
        replyIntent: intent,
        replyRationale: rationale,
        suggestedReplyDraft: suggestedReply,
        lastClassifiedAt: new Date(),
        repliedAt: row.repliedAt ?? new Date(),
        status: EmailStatus.REPLIED,
      },
    });

    await Promise.all([
      finalizeAiConsumption(userId),
      markProfEmailLlmSuccess(userId),
    ]);
    return ok({ intent, rationale, suggestedReply, profEmail: updated });
  },
);
