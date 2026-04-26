import { EmailStatus } from "@prisma/client";

import { draftProfessorEmail } from "@/lib/ai";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { prisma } from "@/lib/prisma";
import { fetchProfilePagePlainText } from "@/lib/profile-page-fetch";
import { extractProfessorAndDraftFromPage } from "@/lib/professor-from-url-ai";

import { bad, notFound, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { createEmailSchema, patchEmailSchema } from "./schemas";

export const list = withAuth(async (req, { userId }) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where = {
    userId,
    ...(status &&
    status !== "ALL" &&
    Object.values(EmailStatus).includes(status as EmailStatus)
      ? { status: status as EmailStatus }
      : {}),
  };

  const emails = await prisma.profEmail.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return ok(emails);
});

export const create = withAuth(async (req, { userId }) => {
  const parsed = createEmailSchema.safeParse(await req.json());
  if (!parsed.success) return bad(parsed.error.flatten());

  const body = parsed.data;
  const profEmail =
    body.professorEmail && body.professorEmail !== ""
      ? body.professorEmail
      : null;

  const row = await prisma.profEmail.create({
    data: {
      userId,
      profName: body.professorName ?? null,
      profEmail,
      university: body.university ?? null,
      profileUrl: body.profileUrl ?? null,
      researchArea: body.researchArea,
      emailSubject: body.emailSubject,
      emailBody: body.emailBody,
      status: body.status ?? EmailStatus.DRAFT,
      notes: body.notes ?? null,
      sentAt:
        body.status && body.status !== EmailStatus.DRAFT ? new Date() : null,
    },
  });

  return ok(row);
});

function parseDate(s: string | null | undefined) {
  if (s === undefined) return undefined;
  if (s === null || s === "") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const update = withAuth<{ id: string }>(
  async (req, { userId, params }) => {
    const parsed = patchEmailSchema.safeParse(await req.json());
    if (!parsed.success) return bad(parsed.error.flatten());

    const owned = await prisma.profEmail.findFirst({
      where: { id: params.id, userId },
    });
    if (!owned) return notFound();

    const body = parsed.data;
    const data: Record<string, unknown> = {};

    if (body.professorName !== undefined) data.profName = body.professorName;
    if (body.professorEmail !== undefined)
      data.profEmail =
        body.professorEmail === "" || body.professorEmail === null
          ? null
          : body.professorEmail;
    if (body.university !== undefined) data.university = body.university;
    if (body.profileUrl !== undefined) data.profileUrl = body.profileUrl;
    if (body.researchArea !== undefined) data.researchArea = body.researchArea;
    if (body.emailSubject !== undefined) data.emailSubject = body.emailSubject;
    if (body.emailBody !== undefined) data.emailBody = body.emailBody;
    if (body.status !== undefined) data.status = body.status;
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.followUpCount !== undefined)
      data.followUpCount = body.followUpCount;
    if (body.lastReplySnippet !== undefined)
      data.lastReplySnippet = body.lastReplySnippet;

    const sAt = parseDate(body.sentAt);
    if (sAt !== undefined) data.sentAt = sAt;
    const rAt = parseDate(body.repliedAt);
    if (rAt !== undefined) data.repliedAt = rAt;

    if (body.markReplied) {
      data.status = EmailStatus.REPLIED;
      data.repliedAt = new Date();
    }

    if (
      body.status === EmailStatus.SENT &&
      owned.status === EmailStatus.DRAFT &&
      !owned.sentAt
    ) {
      data.sentAt = new Date();
    }

    const row = await prisma.profEmail.update({
      where: { id: params.id },
      data,
    });

    return ok(row);
  },
);

export const remove = withAuth<{ id: string }>(
  async (_req, { userId, params }) => {
    const owned = await prisma.profEmail.findFirst({
      where: { id: params.id, userId },
    });
    if (!owned) return notFound();

    await prisma.profEmail.delete({ where: { id: params.id } });
    return ok({ ok: true });
  },
);

export const draft = withAuth<{ id: string }>(
  async (_req, { userId, params }) => {
    const [row, profile] = await Promise.all([
      prisma.profEmail.findFirst({ where: { id: params.id, userId } }),
      prisma.profile.findUnique({ where: { userId } }),
    ]);
    if (!row) return notFound();

    const quota = await billingPrecheckResponse(userId);
    if (quota) return quota;

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
          where: { id: params.id },
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
        await finalizeAiConsumption(userId);
        return ok(updated);
      } catch (e) {
        return bad(formatLlmFailureMessage(e), 500);
      }
    }

    let result;
    try {
      result = await draftProfessorEmail({
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
      where: { id: params.id },
      data: { emailSubject: result.subject, emailBody: result.body },
    });

    await finalizeAiConsumption(userId);

    return ok(updated);
  },
);
