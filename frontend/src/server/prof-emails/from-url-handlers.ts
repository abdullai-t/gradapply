import { EmailStatus } from "@/types/enums";
import { NextResponse } from "next/server";

import { runTask } from "@/lib/agents";
import {
  billingPrecheckResponse,
  canUseFreeLifetimeEmailGeneration,
  finalizeAiConsumptionForAction,
  markFreeLifetimeEmailGenerationUsed,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import {
  assertProfEmailLlmAllowed,
  markProfEmailLlmAttempt,
  markProfEmailLlmSuccess,
  type ProfEmailLlmDenial,
} from "@/lib/prof-email-llm-rate-limit";
import { prisma } from "@/lib/prisma";
import { sanitizeField } from "@/lib/agents/sanitize";
import { fetchProfilePagePlainText } from "@/lib/profile-page-fetch";
import { requireWritableAccount } from "@/lib/plan-gates";
import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { fromUrlBodySchema } from "./schemas";

export const fromUrl = withAuth(async (req, { userId }) => {
  const readOnly = await requireWritableAccount(userId);
  if (readOnly) return readOnly;
  const json = await req.json().catch(() => null);
  const parsed = fromUrlBodySchema.safeParse(json);
  if (!parsed.success) return bad(parsed.error.flatten());

  const canUseFree = await canUseFreeLifetimeEmailGeneration(userId);
  if (!canUseFree) {
    const quota = await billingPrecheckResponse(userId, "cold_email");
    if (quota) return quota;
  }

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
  try {
    fetchedPage = await fetchProfilePagePlainText(rawUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not load page";
    return bad(msg, 422);
  }

  try {
    const message = [
      `Extract professor info and draft a cold email from this faculty page.`,
      `URL: ${sanitizeField(fetchedPage.url, 2000)}`,
      `\nReturn JSON: { "profName", "profEmail", "university", "researchArea", "emailSubject", "emailBody" }`,
    ].join("\n");

    const agentResult = await runTask("email-drafter", message, userId, {
      url: fetchedPage.url,
    });

    const raw = agentResult.reply.trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    const candidate = fenced ? fenced[1] : raw;
    const parsed2 = JSON.parse(candidate) as {
      profName?: string;
      profEmail?: string;
      university?: string;
      researchArea?: string;
      emailSubject?: string;
      emailBody?: string;
    };

    const row = await prisma.profEmail.create({
      data: {
        userId,
        profName: parsed2.profName ?? null,
        profEmail: parsed2.profEmail ?? null,
        university: parsed2.university ?? null,
        profileUrl: fetchedPage.url,
        researchArea: parsed2.researchArea ?? null,
        emailSubject: parsed2.emailSubject ?? null,
        emailBody: parsed2.emailBody ?? null,
        status: EmailStatus.DRAFT,
      },
    });

    await Promise.all([
      canUseFree
        ? markFreeLifetimeEmailGenerationUsed(userId)
        : finalizeAiConsumptionForAction(userId, "cold_email"),
      markProfEmailLlmSuccess(userId),
    ]);
    return ok(row);
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});
