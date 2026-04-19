import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { inferSchoolDetailsFromName } from "@/lib/school-from-name-ai";
import { formatLlmFailureMessage } from "@/lib/llm-errors";

const bodySchema = z.object({
  name: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  try {
    const fields = await inferSchoolDetailsFromName({
      schoolName: parsed.data.name.trim(),
      profile,
      userId: session.user.id,
    });
    return NextResponse.json(fields);
  } catch (e) {
    return NextResponse.json(
      { error: formatLlmFailureMessage(e) },
      { status: 500 },
    );
  }
}
