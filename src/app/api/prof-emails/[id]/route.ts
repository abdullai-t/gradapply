import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EmailStatus } from "@prisma/client";
import { z } from "zod";

const optionalHttpUrl = z
  .union([z.string().url().max(2000), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

const patchSchema = z.object({
  profName: z
    .union([z.string().min(1), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  profEmail: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  university: z
    .union([z.string().min(1), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" ? null : v)),
  profileUrl: optionalHttpUrl,
  researchArea: z.string().nullable().optional(),
  emailSubject: z.string().nullable().optional(),
  emailBody: z.string().nullable().optional(),
  status: z.nativeEnum(EmailStatus).optional(),
  sentAt: z.string().datetime().nullable().optional(),
  repliedAt: z.string().datetime().nullable().optional(),
  replySnippet: z.string().nullable().optional(),
  followUpCount: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
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

  const existing = await prisma.profEmail.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { sentAt, repliedAt, ...rest } = parsed.data;

  const row = await prisma.profEmail.update({
    where: { id },
    data: {
      ...rest,
      ...(sentAt !== undefined
        ? { sentAt: sentAt ? new Date(sentAt) : null }
        : {}),
      ...(repliedAt !== undefined
        ? { repliedAt: repliedAt ? new Date(repliedAt) : null }
        : {}),
    },
  });

  return NextResponse.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = params;

  const existing = await prisma.profEmail.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.profEmail.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
