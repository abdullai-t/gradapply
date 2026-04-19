import { EmailStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const optionalHttpUrl = z
  .union([z.string().url().max(2000), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

const createSchema = z
  .object({
    professorName: z.string().min(1).optional().nullable(),
    professorEmail: z.union([z.string().email(), z.literal("")]).optional(),
    university: z.string().min(1).optional().nullable(),
    profileUrl: optionalHttpUrl,
    researchArea: z.string().optional().nullable(),
    emailSubject: z.string().optional().nullable(),
    emailBody: z.string().optional().nullable(),
    status: z.nativeEnum(EmailStatus).optional(),
    notes: z.string().optional().nullable(),
  })
  .refine(
    (d) =>
      Boolean(d.profileUrl?.trim()) ||
      (Boolean(d.professorName?.trim()) &&
        Boolean(d.university?.trim())),
    {
      message:
        "Provide a profile URL, or both professor name and university.",
      path: ["profileUrl"],
    },
  );

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const where = {
    userId: session.user.id,
    ...(status &&
    status !== "ALL" &&
    Object.values(EmailStatus).includes(status as EmailStatus)
      ? { status: status as EmailStatus }
      : {}),
  };

  const emails = await prisma.profEmail.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(emails);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  const profEmail =
    body.professorEmail && body.professorEmail !== ""
      ? body.professorEmail
      : null;

  const row = await prisma.profEmail.create({
    data: {
      userId: session.user.id,
      profName: body.professorName ?? null,
      profEmail,
      university: body.university ?? null,
      profileUrl: body.profileUrl ?? null,
      researchArea: body.researchArea,
      emailSubject: body.emailSubject,
      emailBody: body.emailBody,
      status: body.status ?? EmailStatus.DRAFT,
      notes: body.notes ?? null,
      sentAt: body.status && body.status !== EmailStatus.DRAFT ? new Date() : null,
    },
  });

  return NextResponse.json(row);
}
