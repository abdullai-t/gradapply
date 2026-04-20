import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseDeadlineBody } from "@/lib/school-deadline";
import { progressFromStatus } from "@/lib/school-progress";
import { AdmissionTerm, SchoolStatus } from "@prisma/client";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  program: z.string().min(1),
  degree: z.string().min(1),
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

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sort = new URL(req.url).searchParams.get("sort");
  const schools = await prisma.school.findMany({
    where: { userId: session.user.id },
    orderBy:
      sort === "timeline"
        ? [{ deadline: "asc" }, { name: "asc" }]
        : [{ updatedAt: "desc" }],
  });

  return NextResponse.json(schools);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { deadline, reminderAt, ...rest } = parsed.data;
  const status = rest.status ?? SchoolStatus.PLANNING;

  const school = await prisma.school.create({
    data: {
      ...rest,
      status,
      progress: progressFromStatus(status),
      userId: session.user.id,
      deadline:
        deadline === undefined
          ? undefined
          : deadline === null || deadline === ""
            ? null
            : parseDeadlineBody(deadline),
      reminderAt:
        reminderAt === undefined
          ? undefined
          : reminderAt === null || reminderAt === ""
            ? null
            : parseDeadlineBody(reminderAt),
    },
  });

  return NextResponse.json(school);
}
