import { NextResponse } from "next/server";

import { runTask } from "@/lib/agents";
import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { formatPageFetchError } from "@/lib/page-fetch-errors";
import {
  assertProfEmailLlmAllowed,
  markProfEmailLlmAttempt,
  markProfEmailLlmSuccess,
  type ProfEmailLlmDenial,
} from "@/lib/prof-email-llm-rate-limit";
import { prisma } from "@/lib/prisma";
import { sanitizeField } from "@/lib/agents/sanitize";
import { fetchProfilePageForDiscovery } from "@/lib/profile-page-fetch";

import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { discoverBodySchema } from "./schemas";

export const discover = withAuth(async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = discoverBodySchema.safeParse(json);
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

  let page: {
    url: string;
    text: string;
    links: { url: string; label: string }[];
  };
  try {
    page = await fetchProfilePageForDiscovery(rawUrl);
  } catch (e) {
    return bad(formatPageFetchError(e, "Failed to load faculty page."), 422);
  }

  const uniqueIds = Array.from(new Set(parsed.data.schoolIds));

  const schools = await prisma.school.findMany({
    where: { userId, id: { in: uniqueIds } },
  });

  if (schools.length !== uniqueIds.length)
    return bad("One or more school ids are invalid.");

  try {
    const schoolSummary = schools.map((s) => `- ${sanitizeField(s.name)} (${sanitizeField(s.program) || "N/A"}, ${sanitizeField(s.degree) || "N/A"})`).join("\n");
    const message = [
      `Discover faculty members from this department page who match my research interests.`,
      `\nPage URL: ${sanitizeField(page.url, 2000)}`,
      `\nTarget schools:\n${schoolSummary}`,
      `\nReturn JSON: { "candidates": [{ "profName", "university", "department", "researchArea", "matchScore" (1-5), "profileUrl", "email" }] }`,
    ].join("\n");

    const result = await runTask("faculty-discovery", message, userId, {
      url: page.url,
    });

    const raw = result.reply.trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    const candidate = fenced ? fenced[1] : raw;
    let parsed2;
    try {
      parsed2 = JSON.parse(candidate);
    } catch {
      parsed2 = { candidates: [] };
    }

    await Promise.all([
      finalizeAiConsumption(userId),
      markProfEmailLlmSuccess(userId),
    ]);

    return ok({
      ...parsed2,
      pageFetchedUrl: page.url,
      linksExtracted: page.links.length,
    });
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});
