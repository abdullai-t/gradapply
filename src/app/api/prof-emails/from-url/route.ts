import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EmailStatus } from "@prisma/client";
import { fetchProfilePagePlainText } from "@/lib/profile-page-fetch";
import { extractProfessorAndDraftFromPage } from "@/lib/professor-from-url-ai";
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

const bodySchema = z.object({
  profileUrl: z.string().url().max(2000),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const rawUrl = parsed.data.profileUrl.trim();

  let fetchedPage: { url: string; text: string };
  let profile: Awaited<ReturnType<typeof prisma.profile.findUnique>>;
  try {
    [fetchedPage, profile] = await Promise.all([
      fetchProfilePagePlainText(rawUrl),
      prisma.profile.findUnique({
        where: { userId: session.user.id },
      }),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load page";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  let result;
  try {
    result = await extractProfessorAndDraftFromPage({
      profile,
      profilePageUrl: fetchedPage.url,
      profilePageText: fetchedPage.text,
      userId: session.user.id,
    });
  } catch (e) {
    return NextResponse.json(
      { error: formatLlmFailureMessage(e) },
      { status: 500 },
    );
  }

  const row = await prisma.profEmail.create({
    data: {
      userId: session.user.id,
      profName: result.profName,
      profEmail: result.profEmail,
      university: result.university,
      profileUrl: fetchedPage.url,
      researchArea: result.researchArea,
      emailSubject: result.emailSubject,
      emailBody: result.emailBody,
      status: EmailStatus.DRAFT,
    },
  });

  await Promise.all([
    finalizeAiConsumption(session.user.id),
    markProfEmailLlmSuccess(session.user.id),
  ]);
  return NextResponse.json(row);
}
