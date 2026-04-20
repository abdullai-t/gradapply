import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { billingPrecheckResponse, finalizeAiConsumption } from "@/lib/billing-allowance";
import { discoverFacultyFromSchoolPrograms } from "@/lib/faculty-discovery-ai";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import {
  assertProfEmailLlmAllowed,
  markProfEmailLlmAttempt,
  markProfEmailLlmSuccess,
  type ProfEmailLlmDenial,
} from "@/lib/prof-email-llm-rate-limit";
import { prisma } from "@/lib/prisma";
import { zPrismaRecordId } from "@/lib/prisma-record-id-zod";

const bodySchema = z.object({
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
    assertProfEmailLlmAllowed(session.user.id);
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

  markProfEmailLlmAttempt(session.user.id);

  const uniqueIds = Array.from(new Set(parsed.data.schoolIds));

  const schools = await prisma.school.findMany({
    where: {
      userId: session.user.id,
      id: { in: uniqueIds },
    },
  });

  if (schools.length !== uniqueIds.length)
    return NextResponse.json(
      { error: "One or more school ids are invalid." },
      { status: 400 },
    );

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  try {
    const result = await discoverFacultyFromSchoolPrograms({
      profile,
      schools: schools.map((s) => ({
        id: s.id,
        name: s.name,
        program: s.program,
        degree: s.degree,
        country: s.country,
      })),
      userId: session.user.id,
    });

    await finalizeAiConsumption(session.user.id);
    markProfEmailLlmSuccess(session.user.id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: formatLlmFailureMessage(e) }, { status: 500 });
  }
}
