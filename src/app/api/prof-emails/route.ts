import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EmailStatus } from "@prisma/client";
import { z } from "zod";

const optionalHttpUrl = z
  .union([z.string().url().max(2000), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

const createSchema = z
  .object({
    profName: z.string().min(1).optional().nullable(),
    profEmail: z
      .union([z.string().email(), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v === "" ? null : v)),
    university: z.string().min(1).optional().nullable(),
    profileUrl: optionalHttpUrl,
    researchArea: z.string().nullable().optional(),
    emailSubject: z.string().nullable().optional(),
    emailBody: z.string().nullable().optional(),
    status: z.nativeEnum(EmailStatus).optional(),
    notes: z.string().nullable().optional(),
  })
  .refine(
    (data) =>
      Boolean(data.profileUrl?.trim()) ||
      (Boolean(data.profName?.trim()) &&
        Boolean(data.university?.trim())),
    {
      message:
        "Provide a faculty profile URL, or both professor name and university.",
      path: ["profileUrl"],
    },
  );

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const emails = await prisma.profEmail.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(emails);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const row = await prisma.profEmail.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
    },
  });

  return NextResponse.json(row);
}
