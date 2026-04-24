import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { billingPrecheckResponse, finalizeAiConsumption } from "@/lib/billing-allowance";
import { formatLlmFailureMessage } from "@/lib/llm-errors";
import { prisma } from "@/lib/prisma";
import { recommendSchoolsFromProfile } from "@/lib/school-recommendations-ai";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const quota = await billingPrecheckResponse(session.user.id);
  if (quota) return quota;

  const [profile, schools] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: session.user.id } }),
    prisma.school.findMany({
      where: { userId: session.user.id },
      select: { name: true },
      distinct: ["name"],
    }),
  ]);

  try {
    const recommendations = await recommendSchoolsFromProfile({
      profile,
      existingSchoolNames: schools.map((s) => s.name),
      userId: session.user.id,
    });

    await finalizeAiConsumption(session.user.id);

    return NextResponse.json({ schools: recommendations });
  } catch (e) {
    return NextResponse.json({ error: formatLlmFailureMessage(e) }, { status: 500 });
  }
}
