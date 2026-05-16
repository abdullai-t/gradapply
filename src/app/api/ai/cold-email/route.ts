import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { applicantProfileForLlm } from "@/lib/features/applicant-profile";
import { generateColdEmail } from "@/lib/features/coldEmailGen";
import { isWithinBudget } from "@/lib/llm/costGuard";
import { prisma } from "@/lib/prisma";

const CREDIT_COST = 2;

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
      where: { id: session.user.id },
      select: { id: true, aiCreditsBalance: true, profile: true, name: true },
    }),
    prisma.professor.findUnique({ where: { id: professorId } }),
    prisma.program.findUnique({ where: { id: programId } }),
  ]);

  if (!user || !professor || !program) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user.aiCreditsBalance < CREDIT_COST) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
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
    prisma.user.update({
      where: { id: user.id },
      data: { aiCreditsBalance: { decrement: CREDIT_COST } },
    }),
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

  return NextResponse.json(result);
}
