import { EmailStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
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

const bodySchema = z.object({
  replyText: z.string().min(20).max(80000),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idParsed = zPrismaRecordId.safeParse(params.id);
  if (!idParsed.success)
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const quota = await billingPrecheckResponse(session.user.id);
  if (quota) return quota;

  try {
    await assertProfEmailLlmAllowed(session.user.id);
  } catch (e) {
    const denial = (
      e as Error & { denial?: ProfEmailLlmDenial }
    ).denial;
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

  await markProfEmailLlmAttempt(session.user.id);

  const { replyText } = parsed.data;

  const [row, profile] = await Promise.all([
    prisma.profEmail.findFirst({
      where: { id: idParsed.data, userId: session.user.id },
    }),
    prisma.profile.findUnique({
      where: { userId: session.user.id },
    }),
  ]);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
      userId: session.user.id,
    });
    intent = result.intent;
    rationale = result.rationale;
    suggestedReply = result.suggestedReply;
  } catch (e) {
    return NextResponse.json(
      { error: formatLlmFailureMessage(e) },
      { status: 500 },
    );
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
    finalizeAiConsumption(session.user.id),
    markProfEmailLlmSuccess(session.user.id),
  ]);
  return NextResponse.json({
    intent,
    rationale,
    suggestedReply,
    profEmail: updated,
  });
}
