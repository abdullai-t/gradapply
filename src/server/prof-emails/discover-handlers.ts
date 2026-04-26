import { NextResponse } from "next/server";

import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { discoverFacultyMatches } from "@/lib/faculty-discovery-ai";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import {
  assertProfEmailLlmAllowed,
  markProfEmailLlmAttempt,
  markProfEmailLlmSuccess,
  type ProfEmailLlmDenial,
} from "@/lib/prof-email-llm-rate-limit";
import { prisma } from "@/lib/prisma";
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
    const msg = e instanceof Error ? e.message : "Failed to load faculty page.";
    return bad(msg, 422);
  }

  const uniqueIds = Array.from(new Set(parsed.data.schoolIds));

  const [schools, profile] = await Promise.all([
    prisma.school.findMany({
      where: { userId, id: { in: uniqueIds } },
    }),
    prisma.profile.findUnique({ where: { userId } }),
  ]);

  if (schools.length !== uniqueIds.length)
    return bad("One or more school ids are invalid.");

  try {
    const result = await discoverFacultyMatches({
      profile,
      profilePageUrl: page.url,
      profilePageText: page.text,
      links: page.links,
      schools: schools.map((s) => ({
        id: s.id,
        name: s.name,
        program: s.program,
        degree: s.degree,
        country: s.country,
      })),
      userId,
    });

    await Promise.all([
      finalizeAiConsumption(userId),
      markProfEmailLlmSuccess(userId),
    ]);
    return ok({
      ...result,
      pageFetchedUrl: page.url,
      linksExtracted: page.links.length,
    });
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});
