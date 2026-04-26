import { EmailStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import {
  assertProfEmailLlmAllowed,
  markProfEmailLlmAttempt,
  markProfEmailLlmSuccess,
  type ProfEmailLlmDenial,
} from "@/lib/prof-email-llm-rate-limit";
import { prisma } from "@/lib/prisma";
import { fetchProfilePagePlainText } from "@/lib/profile-page-fetch";
import { extractProfessorAndDraftFromPage } from "@/lib/professor-from-url-ai";

import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { fromUrlBodySchema } from "./schemas";

export const fromUrl = withAuth(async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = fromUrlBodySchema.safeParse(json);
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

  const rawUrl = parsed.data.profileUrl.trim();

  let fetchedPage: { url: string; text: string };
  let profile: Awaited<ReturnType<typeof prisma.profile.findUnique>>;
  try {
    [fetchedPage, profile] = await Promise.all([
      fetchProfilePagePlainText(rawUrl),
      prisma.profile.findUnique({ where: { userId } }),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load page";
    return bad(msg, 422);
  }

  let result;
  try {
    result = await extractProfessorAndDraftFromPage({
      profile,
      profilePageUrl: fetchedPage.url,
      profilePageText: fetchedPage.text,
      userId,
    });
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }

  const row = await prisma.profEmail.create({
    data: {
      userId,
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
    finalizeAiConsumption(userId),
    markProfEmailLlmSuccess(userId),
  ]);
  return ok(row);
});
