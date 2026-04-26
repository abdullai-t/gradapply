import { EmailStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { analyzeProfessorReplyEmail } from "@/lib/analyze-prof-reply";
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
        return NextResponse.json(
          { error: denial.message },
          { status: denial.status, headers },
        );
      }
      throw e;
    }

    await markProfEmailLlmAttempt(userId);

    const { replyText } = parsed.data;

    const [row, profile] = await Promise.all([
      prisma.profEmail.findFirst({
        where: { id: idParsed.data, userId },
      }),
      prisma.profile.findUnique({ where: { userId } }),
    ]);
    if (!row) return notFound();

    let intent;
    let rationale;
    let suggestedReply;
    try {
      const result = await analyzeProfessorReplyEmail({
        profile,
        originalSubject: row.emailSubject,
        originalBody: row.emailBody,
        replyText,
        professorName: row.profName,
        university: row.university,
        userId,
      });
      intent = result.intent;
      rationale = result.rationale;
      suggestedReply = result.suggestedReply;
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
