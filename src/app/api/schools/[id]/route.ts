import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseDeadlineBody } from "@/lib/school-deadline";
import { progressFromStatus } from "@/lib/school-progress";
import { AdmissionTerm, SchoolStatus } from "@prisma/client";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  program: z.string().min(1).optional(),
  degree: z.string().min(1).optional(),
  country: z.string().nullable().optional(),
  term: z.nativeEnum(AdmissionTerm).nullable().optional(),
  deadline: z.union([z.string(), z.null()]).optional(),
  reminderAt: z.union([z.string(), z.null()]).optional(),
  reminderNote: z.string().nullable().optional(),
  status: z.nativeEnum(SchoolStatus).optional(),
  funding: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  portalUrl: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.school.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { deadline, reminderAt, ...rest } = parsed.data;

  const school = await prisma.school.update({
    where: { id },
    data: {
      ...rest,
      ...(rest.status !== undefined
        ? { progress: progressFromStatus(rest.status) }
        : {}),
      ...(deadline !== undefined
        ? {
            deadline:
              deadline === null || deadline === ""
                ? null
                : parseDeadlineBody(deadline),
          }
        : {}),
      ...(reminderAt !== undefined
        ? {
            reminderAt:
              reminderAt === null || reminderAt === ""
                ? null
                : parseDeadlineBody(reminderAt),
          }
        : {}),
    },
  });

  return NextResponse.json(school);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const existing = await prisma.school.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.school.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
