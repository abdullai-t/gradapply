import { cookies } from "next/headers";

import type { UserRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { SESSION_COOKIE_NAME } from "./session-cookie";
import { ensureAppUserFromFirebaseToken } from "./user-sync";
import { verifyFirebaseSessionCookieEdge } from "./verify-token-edge";

export type AppSessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  role?: UserRole;
};

export type AppSession = {
  user: AppSessionUser;
};

export async function getSessionTokenFromCookies(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getAppSession(): Promise<AppSession | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) return null;

  const decoded = await verifyFirebaseSessionCookieEdge(token);
  if (!decoded?.sub) return null;

  const user = await ensureAppUserFromFirebaseToken(decoded);

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
    },
  };
}

/** Resolve role from DB (source of truth after sync). */
export async function getSessionWithFreshRole(): Promise<AppSession | null> {
  const session = await getAppSession();
  if (!session) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true, name: true, image: true },
  });
  if (!dbUser) return null;

  return {
    user: {
      ...session.user,
      role: dbUser.role,
      email: dbUser.email,
      name: dbUser.name,
      image: dbUser.image,
    },
  };
}
