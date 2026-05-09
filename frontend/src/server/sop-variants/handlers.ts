// @ts-nocheck
import { NextResponse } from "next/server";

import { runTask } from "@/lib/agents";
import {
  billingPrecheckResponse,
  canUseFreeLifetimeSopPreview,
  finalizeAiConsumptionForAction,
  markFreeLifetimeSopPreviewUsed,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { extractPlainTextFromStoredDocument } from "@/lib/llm-user-context";
import { prisma } from "@/lib/prisma";
import {
  assertSopGenerateAllowed,
  markSopGenerateAttempt,
  markSopGenerateSuccess,
} from "@/lib/sop-generate-rate-limit";
import { sanitizeField, wrapUserContent } from "@/lib/agents/sanitize";
import { requireWritableAccount } from "@/lib/plan-gates";
import { bad, notFound, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { createSopVariantSchema, updateSopVariantSchema } from "./schemas";

export const GET = withAuth(async (req, { userId }) => {
  const schoolId = new URL(req.url).searchParams.get("schoolId");
  if (!schoolId?.trim()) return bad("schoolId required");

  const school = await prisma.school.findFirst({
    where: { id: schoolId, userId },
  });
  if (!school) return notFound("School not found");

  const variant = await prisma.sopVariant.findFirst({
    where: { schoolId, userId },
  });

  return ok({ variant });
});

export const POST = withAuth(async (req, { userId }) => {
  const readOnly = await requireWritableAccount(userId);
  if (readOnly) return readOnly;
  const json = await req.json().catch(() => null);
  const parsed = createSopVariantSchema.safeParse(json);
  if (!parsed.success) return bad({ error: parsed.error.flatten() });

  const school = await prisma.school.findFirst({
    where: { id: parsed.data.schoolId, userId },
  });
  if (!school) return notFound("School not found");

  const canUseFree = await canUseFreeLifetimeSopPreview(userId);
  if (!canUseFree) {
    const quota = await billingPrecheckResponse(userId, "sop_session");
    if (quota) return quota;
  }

  try {
    await assertSopGenerateAllowed(userId);
  } catch (e) {
    const denial = (
      e as Error & {
        denial?: { status: number; message: string; retryAfterSec?: number };
      }
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

  await markSopGenerateAttempt(userId);

  let masterSopText: string | null = null;
  let sourceMasterId: string | null = null;

  if (parsed.data.masterDocumentId?.trim()) {
    const doc = await prisma.document.findFirst({
      where: {
        id: parsed.data.masterDocumentId.trim(),
        userId,
        type: "sop_draft",
      },
    });
    if (!doc)
      return bad(
        "Master document not found or is not a statement-of-purpose draft.",
      );
    masterSopText = await extractPlainTextFromStoredDocument(doc);
    if (!masterSopText)
      return bad(
        "Could not read text from that file (scan-only PDF, expired URL, or unsupported format). Paste plain text or upload a selectable PDF.",
      );
    sourceMasterId = doc.id;
  } else if (parsed.data.masterText?.trim()) {
    masterSopText = parsed.data.masterText.trim();
  }

  if (!masterSopText || masterSopText.length < 80)
    return bad("Master SOP text is too short.");

  let bodyText: string;

  try {
    const message = [
      `Tailor this master SOP for ${sanitizeField(school.name)}.`,
      school.program ? `Program: ${sanitizeField(school.program)}` : "",
      school.degree ? `Degree: ${sanitizeField(school.degree)}` : "",
      school.country ? `Country: ${sanitizeField(school.country)}` : "",
      "",
      "Return ONLY the tailored SOP text — no preamble, no markdown fences.",
      "",
      wrapUserContent("master SOP", masterSopText),
    ].filter(Boolean).join("\n");

    const result = await runTask("sop-writer", message, userId, {
      schoolId: school.id,
    });
    bodyText = result.reply;
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }

  const title = parsed.data.title?.trim() || `${school.name} — tailored SOP`;

  const variant = await prisma.sopVariant.upsert({
    where: { schoolId: school.id },
    create: {
      userId,
      schoolId: school.id,
      title,
      body: bodyText.trim(),
      sourceMasterId,
    },
    update: {
      body: bodyText.trim(),
      sourceMasterId,
      ...(parsed.data.title?.trim()
        ? { title: parsed.data.title.trim() }
        : {}),
    },
  });

  if (!canUseFree) {
    await finalizeAiConsumptionForAction(userId, "sop_session");
  } else {
    await markFreeLifetimeSopPreviewUsed(userId);
  }
  await markSopGenerateSuccess(userId);

  return ok({ variant });
});

export const PATCH = withAuth<{ id: string }>(
  async (req, { userId, params }) => {
    const readOnly = await requireWritableAccount(userId);
    if (readOnly) return readOnly;

    const { id } = params;
    const json = await req.json().catch(() => null);
    const parsed = updateSopVariantSchema.safeParse(json);
    if (!parsed.success) return bad({ error: parsed.error.flatten() });

    if (parsed.data.title === undefined && parsed.data.body === undefined)
      return bad("Nothing to update");

    const existing = await prisma.sopVariant.findFirst({
      where: { id, userId },
    });
    if (!existing) return notFound();

    const variant = await prisma.sopVariant.update({
      where: { id },
      data: {
        ...(parsed.data.title !== undefined
          ? { title: parsed.data.title }
          : {}),
        ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
      },
    });

    return ok(variant);
  },
);
