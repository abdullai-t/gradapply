import { EmailStatus } from "@prisma/client";

import { runTask } from "@/lib/agents";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { prisma } from "@/lib/prisma";
import { sanitizeField } from "@/lib/agents/sanitize";
import { fetchProfilePagePlainText } from "@/lib/profile-page-fetch";

import { bad, notFound, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { createEmailSchema, patchEmailSchema } from "./schemas";

export const list = withAuth(async (req, { userId }) => {
  const startedAt = Date.now();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const takeRaw = Number.parseInt(searchParams.get("take") ?? "", 10);
  const take =
    Number.isFinite(takeRaw) && takeRaw > 0 ? Math.min(takeRaw, 100) : 50;

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
    take,
  });
  console.info("[perf][prof-emails.list]", {
    userId,
    rows: emails.length,
    take,
    durationMs: Date.now() - startedAt,
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
    const row = await prisma.profEmail.findFirst({
      where: { id: params.id, userId },
    });
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
        const candidate = fenced ? fenced[1] : raw;
        const parsed2 = JSON.parse(candidate) as Record<string, string>;

        const updated = await prisma.profEmail.update({
          where: { id: params.id },
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
        await finalizeAiConsumption(userId);
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
        profEmailId: params.id,
      });

      const raw = agentResult.reply.trim();
      const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
      const candidate = fenced ? fenced[1] : raw;
      const parsed2 = JSON.parse(candidate) as Record<string, string>;

      const updated = await prisma.profEmail.update({
        where: { id: params.id },
        data: {
          emailSubject: parsed2.emailSubject ?? parsed2.subject,
          emailBody: parsed2.emailBody ?? parsed2.body,
        },
      });

      await finalizeAiConsumption(userId);
      return ok(updated);
    } catch (e) {
      return bad(formatLlmFailureMessage(e), 500);
    }
  },
);
