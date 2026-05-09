// @ts-nocheck
import { NextResponse } from "next/server";

import { runTask } from "@/lib/agents";
import {
  billingPrecheckResponse,
  canUseFreeLifetimeEmailGeneration,
  finalizeAiConsumptionForAction,
  markFreeLifetimeEmailGenerationUsed,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { prisma } from "@/lib/prisma";
import { zPrismaRecordId } from "@/lib/prisma-record-id-zod";
import {
  assertProfEmailLlmAllowed,
  markProfEmailLlmAttempt,
  markProfEmailLlmSuccess,
  type ProfEmailLlmDenial,
} from "@/lib/prof-email-llm-rate-limit";
import { sanitizeField } from "@/lib/agents/sanitize";
import { requireWritableAccount } from "@/lib/plan-gates";
import { fetchProfilePagePlainText } from "@/lib/profile-page-fetch";
import { bad, notFound, ok } from "../_responses";
import { withAuth } from "../_with-auth";

export const draft = withAuth<{ id: string }>(
  async (_req, { userId, params }) => {
    const idParsed = zPrismaRecordId.safeParse(params.id);
    if (!idParsed.success) return bad("Invalid id.");

    const id = idParsed.data;

    const readOnly = await requireWritableAccount(userId);
    if (readOnly) return readOnly;
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

    const row = await prisma.profEmail.findFirst({
      where: { id, userId },
    });
    if (!row) return notFound();

    if (row.profileUrl?.trim()) {
      let fetched;
      try {
        fetched = await fetchProfilePagePlainText(row.profileUrl.trim());
      } catch (e) {
        const msg =
          e instanceof Error ? e.message : "Failed to load profile page";
        return bad(msg, 422);
      }

      try {
        const message = [
          `Extract professor info and draft a cold email from this faculty page.`,
          `URL: ${sanitizeField(fetched.url, 2000)}`,
          `\nReturn JSON: { "profName", "profEmail", "university", "researchArea", "emailSubject", "emailBody" }`,
        ].join("\n");

        const agentResult = await runTask("email-drafter", message, userId, {
          url: fetched.url,
        });

        const raw = agentResult.reply.trim();
        const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
        const agentCandidate = fenced ? fenced[1] : raw;
        const parsed2 = JSON.parse(agentCandidate) as Record<string, string>;

        const updated = await prisma.profEmail.update({
          where: { id },
          data: {
            profName: parsed2.profName ?? row.profName,
            profEmail: parsed2.profEmail ?? row.profEmail,
            university: parsed2.university ?? row.university,
            researchArea: parsed2.researchArea ?? row.researchArea,
            emailSubject: parsed2.emailSubject ?? row.emailSubject,
            emailBody: parsed2.emailBody ?? row.emailBody,
            profileUrl: fetched.url,
          },
        });
        await Promise.all([
          canUseFree
            ? markFreeLifetimeEmailGenerationUsed(userId)
            : finalizeAiConsumptionForAction(userId, "cold_email"),
          markProfEmailLlmSuccess(userId),
        ]);
        return ok(updated);
      } catch (e) {
        return bad(formatLlmFailureMessage(e), 500);
      }
    }

    try {
      const message = [
        `Draft a cold email to ${sanitizeField(row.profName) || "a professor"} at ${sanitizeField(row.university) || "their university"}.`,
        row.researchArea ? `Research area: ${sanitizeField(row.researchArea)}` : "",
        row.notes ? `Notes: ${sanitizeField(row.notes, 1000)}` : "",
        `\nReturn JSON: { "emailSubject": string, "emailBody": string }`,
      ].filter(Boolean).join("\n");

      const agentResult = await runTask("email-drafter", message, userId, {
        profEmailId: id,
      });

      const raw = agentResult.reply.trim();
      const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      const agentCandidate = fenced ? fenced[1] : raw;
      const parsed2 = JSON.parse(agentCandidate) as Record<string, string>;

      const updated = await prisma.profEmail.update({
        where: { id },
        data: {
          emailSubject: parsed2.emailSubject ?? parsed2.subject,
          emailBody: parsed2.emailBody ?? parsed2.body,
        },
      });

      await Promise.all([
        canUseFree
          ? markFreeLifetimeEmailGenerationUsed(userId)
          : finalizeAiConsumptionForAction(userId, "cold_email"),
        markProfEmailLlmSuccess(userId),
      ]);
      return ok(updated);
    } catch (e) {
      return bad(formatLlmFailureMessage(e), 500);
    }
  },
);
