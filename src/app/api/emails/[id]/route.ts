import { EmailStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const optionalHttpUrl = z
  .union([z.string().url().max(2000), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

const patchSchema = z
  .object({
    professorName: z.string().min(1).optional(),
    professorEmail: z
      .union([z.string().email(), z.literal(""), z.null()])
      .optional(),
    university: z.string().min(1).optional(),
    profileUrl: optionalHttpUrl,
    researchArea: z.string().min(1).optional(),
    emailSubject: z.string().min(1).optional(),
    emailBody: z.string().min(1).optional(),
    status: z.nativeEnum(EmailStatus).optional(),
    notes: z.string().nullable().optional(),
    sentAt: z.string().nullable().optional(),
    repliedAt: z.string().nullable().optional(),
    replySnippet: z.string().nullable().optional(),
    followUpCount: z.number().int().min(0).optional(),
    markReplied: z.boolean().optional(),
  })
  .strict();

function parseDate(s: string | null | undefined) {
  if (s === undefined) return undefined;
  if (s === null || s === "") return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const owned = await prisma.profEmail.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = parsed.data;

  const data: Record<string, unknown> = {};

  if (body.professorName !== undefined) data.profName = body.professorName;
  if (body.professorEmail !== undefined)
    data.profEmail =
      body.professorEmail === "" || body.professorEmail === null
        ? null
        : body.professorEmail;
  if (body.university !== undefined) data.university = body.university;
  if (body.profileUrl !== undefined) data.profileUrl = body.profileUrl;
  if (body.researchArea !== undefined) data.researchArea = body.researchArea;
  if (body.emailSubject !== undefined) data.emailSubject = body.emailSubject;
  if (body.emailBody !== undefined) data.emailBody = body.emailBody;
  if (body.status !== undefined) data.status = body.status;
  if (body.notes !== undefined) data.notes = body.notes;
  if (body.followUpCount !== undefined) data.followUpCount = body.followUpCount;
  if (body.replySnippet !== undefined) data.replySnippet = body.replySnippet;

  const sAt = parseDate(body.sentAt);
  if (sAt !== undefined) data.sentAt = sAt;
  const rAt = parseDate(body.repliedAt);
  if (rAt !== undefined) data.repliedAt = rAt;

  if (body.markReplied) {
    data.status = EmailStatus.REPLIED;
    data.repliedAt = new Date();
  }

  if (
    body.status === EmailStatus.SENT &&
    owned.status === EmailStatus.DRAFT &&
    !owned.sentAt
  ) {
    data.sentAt = new Date();
  }

  const row = await prisma.profEmail.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const owned = await prisma.profEmail.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!owned) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.profEmail.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
