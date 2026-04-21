import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireNonFreeForFeature } from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const docTypes = z.enum([
  "cv",
  "transcript",
  "gre",
  "sop_draft",
  "other",
]);

const createSchema = z.object({
  name: z.string().min(1),
  type: docTypes,
  url: z.string().url(),
  size: z.number().int().positive().nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locked = await requireNonFreeForFeature(session.user.id, "documents");
  if (locked) return locked;

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(documents);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locked = await requireNonFreeForFeature(session.user.id, "documents");
  if (locked) return locked;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const doc = await prisma.document.create({
    data: {
      ...parsed.data,
      userId: session.user.id,
    },
  });

  return NextResponse.json(doc);
}
