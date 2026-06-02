import { NextResponse } from "next/server";

import { requireAuthedAiMutation } from "@/lib/ai-route-auth";
import { applicantProfileForLlm } from "@/lib/features/applicant-profile";
import { reviewSOP } from "@/lib/features/sopReview";
import {
  billingPrecheckResponse,
  finalizeAiConsumptionForAction,
} from "@/lib/billing-allowance";
import { isWithinBudget } from "@/lib/llm/costGuard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const authed = await requireAuthedAiMutation(req);
  if (authed instanceof Response) return authed;
  const { userId } = authed;

  const withinBudget = await isWithinBudget();
  if (!withinBudget) {
    return NextResponse.json(
      { error: "AI service temporarily unavailable. Please try again tomorrow." },
      { status: 503 },
    );
  }

  const quota = await billingPrecheckResponse(userId, "sop_review");
  if (quota) return quota;

  const body = (await req.json()) as { sopText?: string; programId?: string };
  const { sopText, programId } = body;

  if (!sopText || sopText.trim().length < 100) {
    return NextResponse.json({ error: "SOP text too short" }, { status: 400 });
  }
  if (!programId) {
    return NextResponse.json({ error: "programId required" }, { status: 400 });
  }

  const [user, program] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profile: true, name: true },
    }),
    prisma.program.findUnique({ where: { id: programId } }),
  ]);

  if (!user || !program) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userProfile = applicantProfileForLlm({ name: user.name }, user.profile);

  const result = await reviewSOP({
    sopText,
    userProfile,
    program,
    userId: user.id,
  });

  await prisma.sopReview.create({
    data: {
      userId: user.id,
      programId,
      sopText,
      overallScore: result.overallScore,
      relevance: (result.dimensions.relevance ?? {}) as object,
      tone: (result.dimensions.tone ?? {}) as object,
      structure: (result.dimensions.structure ?? {}) as object,
      fit: (result.dimensions.fit ?? {}) as object,
    },
  });

  await finalizeAiConsumptionForAction(userId, "sop_review");

  return NextResponse.json(result);
}
