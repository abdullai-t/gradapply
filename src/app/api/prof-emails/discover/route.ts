import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { billingPrecheckResponse, finalizeAiConsumption } from "@/lib/billing-allowance";
import { discoverFacultyMatches } from "@/lib/faculty-discovery-ai";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { fetchProfilePageForDiscovery } from "@/lib/profile-page-fetch";
import {
  assertProfEmailLlmAllowed,
  markProfEmailLlmAttempt,
  markProfEmailLlmSuccess,
  type ProfEmailLlmDenial,
} from "@/lib/prof-email-llm-rate-limit";
import { prisma } from "@/lib/prisma";
import { zPrismaRecordId } from "@/lib/prisma-record-id-zod";

const bodySchema = z.object({
  profileUrl: z.string().url().max(2000),
  schoolIds: z.array(zPrismaRecordId).min(1).max(12),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const quota = await billingPrecheckResponse(session.user.id);
  if (quota) return quota;

  try {
    await assertProfEmailLlmAllowed(session.user.id);
  } catch (e) {
    const denial = (
      e as Error & { denial?: ProfEmailLlmDenial }
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

  await markProfEmailLlmAttempt(session.user.id);

  const rawUrl = parsed.data.profileUrl.trim();

  let page: { url: string; text: string; links: { url: string; label: string }[] };
  try {
    page = await fetchProfilePageForDiscovery(rawUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load faculty page.";
    return NextResponse.json({ error: msg }, { status: 422 });
  }

  const uniqueIds = Array.from(new Set(parsed.data.schoolIds));

  const [schools, profile] = await Promise.all([
    prisma.school.findMany({
      where: {
        userId: session.user.id,
        id: { in: uniqueIds },
      },
    }),
    prisma.profile.findUnique({
      where: { userId: session.user.id },
    }),
  ]);

  if (schools.length !== uniqueIds.length)
    return NextResponse.json(
      { error: "One or more school ids are invalid." },
      { status: 400 },
    );

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
      userId: session.user.id,
    });

    await Promise.all([
      finalizeAiConsumption(session.user.id),
      markProfEmailLlmSuccess(session.user.id),
    ]);
    return NextResponse.json({
      ...result,
      pageFetchedUrl: page.url,
      linksExtracted: page.links.length,
    });
  } catch (e) {
    return NextResponse.json({ error: formatLlmFailureMessage(e) }, { status: 500 });
  }
}
