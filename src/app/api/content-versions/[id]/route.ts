import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const row = await prisma.contentVersion.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: {
      id: true,
      entityType: true,
      entityId: true,
      label: true,
      body: true,
      fileUrl: true,
      createdAt: true,
      parentVersionId: true,
    },
  });

  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json(row);
}
