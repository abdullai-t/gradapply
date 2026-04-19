import { NextResponse } from "next/server";
import { ConnectorProvider } from "@prisma/client";

import { auth } from "@/auth";
import { isGoogleOAuthConfigured } from "@/lib/google-oauth-tokens";
import { prisma } from "@/lib/prisma";

/** List linked connectors (no secrets). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [gmail, drive] = await Promise.all([
    prisma.connector.findUnique({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: ConnectorProvider.GMAIL,
        },
      },
      select: { externalEmail: true, updatedAt: true },
    }),
    prisma.connector.findUnique({
      where: {
        userId_provider: {
          userId: session.user.id,
          provider: ConnectorProvider.GOOGLE_DRIVE,
        },
      },
      select: { externalEmail: true, updatedAt: true },
    }),
  ]);

  return NextResponse.json({
    /** App-wide Google OAuth client is configured (env). Each user still has their own tokens in `Connector`. */
    googleOAuthConfigured: isGoogleOAuthConfigured(),
    connectors: [
      {
        provider: "gmail" as const,
        connected: Boolean(gmail),
        email: gmail?.externalEmail ?? null,
        updatedAt: gmail?.updatedAt?.toISOString() ?? null,
      },
      {
        provider: "google_drive" as const,
        connected: Boolean(drive),
        email: drive?.externalEmail ?? null,
        updatedAt: drive?.updatedAt?.toISOString() ?? null,
      },
    ],
  });
}
