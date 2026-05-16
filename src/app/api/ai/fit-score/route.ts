import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { applicantProfileForLlm } from "@/lib/features/applicant-profile";
import { scoreFit } from "@/lib/features/fitScorer";
import {
  billingPrecheckResponse,
  finalizeAiConsumptionForAction,
} from "@/lib/billing-allowance";
import { isWithinBudget } from "@/lib/llm/costGuard";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const withinBudget = await isWithinBudget();
  if (!withinBudget) {
    return NextResponse.json(
      { error: "AI service temporarily unavailable. Please try again tomorrow." },
      { status: 503 },
    );
  }

  const quota = await billingPrecheckResponse(userId, "fit_score");
  if (quota) return quota;

  const body = (await req.json()) as { programId?: string };
  const programId = body.programId;
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

  const result = await scoreFit({
    userProfile,
    program,
    userId: user.id,
  });

  const fitPayload = result.result as { score?: number } | null;
  const fitScore =
    typeof fitPayload?.score === "number" && Number.isFinite(fitPayload.score)
      ? Math.round(fitPayload.score)
      : null;

  await prisma.$transaction([
    prisma.userProgram.upsert({
      where: { userId_programId: { userId: user.id, programId } },
      update: { fitScore },
      create: { userId: user.id, programId, fitScore },
    }),
  ]);

  await finalizeAiConsumptionForAction(userId, "fit_score");

  return NextResponse.json(result);
}
