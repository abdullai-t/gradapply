import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const bodySchema = z.object({
  targetDegree: z.string().nullable().optional(),
  focusArea: z.string().nullable().optional(),
  greScore: z.string().nullable().optional(),
  greVerbal: z.number().int().nullable().optional(),
  greQuant: z.number().int().nullable().optional(),
  greAWA: z.number().nullable().optional(),
  undergradSchool: z.string().nullable().optional(),
  undergradDegree: z.string().nullable().optional(),
  undergradGPA: z.number().nullable().optional(),
  yearsExperience: z.string().nullable().optional(),
  researchInterests: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let profile = await prisma.profile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    profile = await prisma.profile.create({
      data: { userId: session.user.id },
    });
  }

  return NextResponse.json(profile);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const profile = await prisma.profile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...parsed.data },
    update: parsed.data,
  });

  return NextResponse.json(profile);
}
