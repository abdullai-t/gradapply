import { NextResponse } from "next/server";

import {
  billingPrecheckResponse,
  finalizeAiConsumption,
} from "@/lib/billing-allowance";
import { discoverFacultyFromSchoolPrograms } from "@/lib/faculty-discovery-ai";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import {
  assertProfEmailLlmAllowed,
  markProfEmailLlmAttempt,
  markProfEmailLlmSuccess,
  type ProfEmailLlmDenial,
} from "@/lib/prof-email-llm-rate-limit";
import { prisma } from "@/lib/prisma";

import { bad, ok } from "../_responses";
import { withAuth } from "../_with-auth";

import { discoverBySchoolsBodySchema } from "./schemas";

export const discoverBySchools = withAuth(async (req, { userId }) => {
  const json = await req.json().catch(() => null);
  const parsed = discoverBySchoolsBodySchema.safeParse(json);
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
    const result = await discoverFacultyFromSchoolPrograms({
      profile,
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
    return ok(result);
  } catch (e) {
    return bad(formatLlmFailureMessage(e), 500);
  }
});
