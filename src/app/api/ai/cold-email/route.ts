import { NextResponse } from "next/server";

import { requireAuthedAiMutation } from "@/lib/ai-route-auth";
import { applicantProfileForLlm } from "@/lib/features/applicant-profile";
import { generateColdEmail } from "@/lib/features/coldEmailGen";
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

  const quota = await billingPrecheckResponse(userId, "cold_email");
  if (quota) return quota;

  const body = (await req.json()) as {
    professorId?: string;
    programId?: string;
    tone?: string;
  };
  const { professorId, programId, tone } = body;
  if (!professorId || !programId) {
    return NextResponse.json(
      { error: "professorId and programId required" },
      { status: 400 },
    );
  }

  const [user, professor, program] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profile: true, name: true },
    }),
    prisma.professor.findUnique({ where: { id: professorId } }),
    prisma.program.findUnique({ where: { id: programId } }),
  ]);

  if (!user || !professor || !program) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userProfile = applicantProfileForLlm({ name: user.name }, user.profile);
  const toneVal = tone ?? "professional";

  const result = await generateColdEmail({
    userProfile,
    professor,
    program,
    tone: toneVal,
    userId: user.id,
  });

  const emailPayload = result.result as {
    subject?: string;
    body?: string;
    wordCount?: number;
    researchOverlaps?: string[];
  } | null;

  await prisma.$transaction([
    prisma.generatedEmail.create({
      data: {
        userId: user.id,
        professorId,
        programId,
        subject: emailPayload?.subject ?? "",
        body: emailPayload?.body ?? "",
        wordCount: emailPayload?.wordCount ?? 0,
        overlaps: emailPayload?.researchOverlaps ?? [],
        tone: toneVal,
      },
    }),
  ]);

  await finalizeAiConsumptionForAction(userId, "cold_email");

  return NextResponse.json(result);
}
