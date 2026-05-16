import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { runTask } from "@/lib/agents";
import { sanitizeField } from "@/lib/agents/sanitize";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { formatPageFetchError } from "@/lib/page-fetch-errors";
import { resolveFacultyPage } from "@/lib/resolve-faculty-page";
import { classifyLlmErrorClass, stringifyLlmError } from "@/lib/llm-credits";
import { log } from "@/lib/logger";
import { requirePlusForFeature } from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";
import { zPrismaRecordId } from "@/lib/prisma-record-id-zod";
import {
  assertProfEmailLlmAllowed,
  markProfEmailLlmAttempt,
  markProfEmailLlmSuccess,
  type ProfEmailLlmDenial,
} from "@/lib/prof-email-llm-rate-limit";
import { bad, notFound, ok } from "../_responses";
import { withAuth } from "../_with-auth";

type AuditResearch = {
  title: string;
  year: string | null;
  summary: string;
  evidence: string | null;
};

function parseAuditResearch(reply: string): AuditResearch[] {
  const raw = reply.trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  const candidate = fenced ? fenced[1] : raw;
  const parsed = JSON.parse(candidate) as {
    latestResearch?: Array<{
      title?: unknown;
      year?: unknown;
      summary?: unknown;
      evidence?: unknown;
    }>;
  };

  const rows = Array.isArray(parsed.latestResearch) ? parsed.latestResearch : [];
  return rows
    .map((r) => ({
      title: typeof r.title === "string" ? r.title.trim() : "",
      year: typeof r.year === "string" ? r.year.trim() : null,
      summary: typeof r.summary === "string" ? r.summary.trim() : "",
      evidence: typeof r.evidence === "string" ? r.evidence.trim() : null,
    }))
    .filter((r) => r.title.length > 0)
    .slice(0, 3);
}

export const audit = withAuth<{ id: string }>(async (_req, { userId, params }) => {
  const plusOnly = await requirePlusForFeature(userId, "priority_generation");
  if (plusOnly) return plusOnly;

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
      if (denial.retryAfterSec != null) headers.RetryAfter = String(denial.retryAfterSec);
      return NextResponse.json({ error: denial.message }, { status: denial.status, headers });
    }
    throw e;
  }

  await markProfEmailLlmAttempt(userId);

  const row = await prisma.profEmail.findFirst({
    where: { id, userId },
  });
  if (!row) return notFound();

  let fetched: { url: string; text: string };
  try {
    fetched = await resolveFacultyPage({
      profileUrl: row.profileUrl,
      profName: row.profName,
      university: row.university,
    });
  } catch (e) {
    const msg = formatPageFetchError(e, "Failed to load profile page");
    log.warn("prof-emails/audit.page-resolve-error", {
      userId,
      profEmailId: id,
      profileUrl: row.profileUrl?.trim() ?? null,
      hasNameUni: Boolean(row.profName?.trim() && row.university?.trim()),
      reason: e instanceof Error ? e.message : String(e),
    });
    return bad(msg, 422);
  }

  try {
    const prompt = [
      "Task: extract exactly 3 latest research items for the professor from the provided faculty page text.",
      "Rules:",
      "- Use only facts that appear in the provided text; do not hallucinate.",
      "- Prefer publication/project entries with explicit years.",
      "- Sort newest to oldest when year/date is available.",
      '- Return strict JSON only: { "latestResearch": [{ "title": string, "year": string|null, "summary": string, "evidence": string|null }] }',
      "- Keep summary to one sentence each.",
      `Professor name (if known): ${sanitizeField(row.profName) || "unknown"}`,
      `University (if known): ${sanitizeField(row.university) || "unknown"}`,
      `Source URL: ${sanitizeField(fetched.url, 2000)}`,
      "",
      "Faculty page plain text:",
      sanitizeField(fetched.text, 18_000),
    ].join("\n");

    const result = await runTask("professor-audit", prompt, userId, {
      profEmailId: id,
      url: fetched.url,
    });

    const latestResearch = parseAuditResearch(result.reply);
    await Promise.all([finalizeAiConsumption(userId), markProfEmailLlmSuccess(userId)]);

    const auditedAt = new Date().toISOString();
    const researchAudit = {
      latestResearch,
      sourceUrl: fetched.url,
      auditedAt,
    } satisfies Record<string, unknown>;

    await prisma.profEmail.update({
      where: { id },
      data: { researchAudit: researchAudit as Prisma.InputJsonValue },
    });

    return ok({
      latestResearch,
      auditedAt,
      sourceUrl: fetched.url,
    });
  } catch (e) {
    const raw = stringifyLlmError(e);
    log.warn("prof-emails/audit.llm-or-parse-error", {
      userId,
      profEmailId: id,
      profileUrl: fetched.url,
      errorClass: classifyLlmErrorClass(e),
      reason: e instanceof Error ? e.message : String(e),
      detail: raw.slice(0, 2000),
    });
    return bad(formatLlmFailureMessage(e), 500);
  }
});
