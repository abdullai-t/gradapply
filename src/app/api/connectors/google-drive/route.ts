import { NextResponse } from "next/server";
import { ConnectorProvider } from "@prisma/client";

import { auth } from "@/auth";
import { requireNonFreeForFeature } from "@/lib/plan-gates";
import { prisma } from "@/lib/prisma";
import { isTrustedMutationOrigin } from "@/lib/request-origin";

export async function DELETE(req: Request) {
  if (!isTrustedMutationOrigin(req)) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const locked = await requireNonFreeForFeature(session.user.id, "connectors");
  if (locked) return locked;

  await prisma.connector.deleteMany({
    where: {
      userId: session.user.id,
      provider: ConnectorProvider.GOOGLE_DRIVE,
    },
  });

  return NextResponse.json({ ok: true });
}
