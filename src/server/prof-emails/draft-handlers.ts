import { NextResponse } from "next/server";

import { draftProfessorEmail } from "@/lib/ai";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
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
import { fetchProfilePagePlainText } from "@/lib/profile-page-fetch";
import { extractProfessorAndDraftFromPage } from "@/lib/professor-from-url-ai";

import { bad, notFound, ok } from "../_responses";
import { withAuth } from "../_with-auth";

export const draft = withAuth<{ id: string }>(
  async (_req, { userId, params }) => {
    const idParsed = zPrismaRecordId.safeParse(params.id);
    if (!idParsed.success) return bad("Invalid id.");

    const id = idParsed.data;

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

    const [row, profile] = await Promise.all([
      prisma.profEmail.findFirst({
        where: { id, userId },
      }),
      prisma.profile.findUnique({
        where: { userId },
      }),
    ]);
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
        const result = await extractProfessorAndDraftFromPage({
          profile,
          profilePageUrl: fetched.url,
          profilePageText: fetched.text,
          userId,
        });

        const updated = await prisma.profEmail.update({
          where: { id },
          data: {
            profName: result.profName,
            profEmail: result.profEmail,
            university: result.university,
            researchArea: result.researchArea,
            emailSubject: result.emailSubject,
            emailBody: result.emailBody,
            profileUrl: fetched.url,
          },
        });
        await Promise.all([
          finalizeAiConsumption(userId),
          markProfEmailLlmSuccess(userId),
        ]);
        return ok(updated);
      } catch (e) {
        return bad(formatLlmFailureMessage(e), 500);
      }
    }

    let draftResult;
    try {
      draftResult = await draftProfessorEmail({
        profile,
        profName: row.profName ?? "Professor",
        university: row.university ?? "",
        researchArea: row.researchArea,
        userNotes: row.notes,
        profilePageUrl: null,
        profilePageText: null,
        userId,
      });
    } catch (e) {
      return bad(formatLlmFailureMessage(e), 500);
    }

    const updated = await prisma.profEmail.update({
      where: { id },
      data: {
        emailSubject: draftResult.subject,
        emailBody: draftResult.body,
      },
    });

    await Promise.all([
      finalizeAiConsumption(userId),
      markProfEmailLlmSuccess(userId),
    ]);
    return ok(updated);
  },
);
