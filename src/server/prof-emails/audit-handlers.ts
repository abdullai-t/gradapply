import { NextResponse } from "next/server";

import { runTask } from "@/lib/agents";
import { sanitizeField } from "@/lib/agents/sanitize";
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
  if (!row.profileUrl?.trim()) {
    return bad("Add a professor profile URL before running audit.", 422);
  }

  let fetched;
  try {
    fetched = await fetchProfilePagePlainText(row.profileUrl.trim());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load profile page";
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

    const result = await runTask("email-drafter", prompt, userId, {
      profEmailId: id,
      url: fetched.url,
    });

    const latestResearch = parseAuditResearch(result.reply);
    await Promise.all([finalizeAiConsumption(userId), markProfEmailLlmSuccess(userId)]);

    return ok({
      latestResearch,
      auditedAt: new Date().toISOString(),
      sourceUrl: fetched.url,
    });
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});
