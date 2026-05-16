import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { applicantProfileForLlm } from "@/lib/features/applicant-profile";
import { reviewSOP } from "@/lib/features/sopReview";
import { isWithinBudget } from "@/lib/llm/costGuard";
import { prisma } from "@/lib/prisma";

const CREDIT_COST = 3;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const withinBudget = await isWithinBudget();
  if (!withinBudget) {
    return NextResponse.json(
      { error: "AI service temporarily unavailable. Please try again tomorrow." },
      { status: 503 },
    );
  }

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
      where: { id: session.user.id },
      select: { id: true, aiCreditsBalance: true, profile: true, name: true },
    }),
    prisma.program.findUnique({ where: { id: programId } }),
  ]);

  if (!user || !program) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.aiCreditsBalance < CREDIT_COST) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  const userProfile = applicantProfileForLlm({ name: user.name }, user.profile);

  const result = await reviewSOP({
    sopText,
    userProfile,
    program,
    userId: user.id,
  });

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { aiCreditsBalance: { decrement: CREDIT_COST } },
    }),
    prisma.sopReview.create({
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
    }),
  ]);

  return NextResponse.json(result);
}
