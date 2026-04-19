import { NextResponse } from "next/server";
import { ConnectorProvider } from "@prisma/client";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.connector.deleteMany({
    where: {
      userId: session.user.id,
      provider: ConnectorProvider.GMAIL,
    },
  });

  return NextResponse.json({ ok: true });
}
