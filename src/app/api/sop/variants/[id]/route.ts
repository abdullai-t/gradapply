import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** ~100k chars — keeps DB/UI reasonable for a single essay field. */
const VARIANT_BODY_MAX = 100_000;

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(VARIANT_BODY_MAX).optional(),
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

  if (parsed.data.title === undefined && parsed.data.body === undefined)
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const existing = await prisma.sopVariant.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const variant = await prisma.sopVariant.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.body !== undefined ? { body: parsed.data.body } : {}),
    },
  });

  return NextResponse.json(variant);
}
