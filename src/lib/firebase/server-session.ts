import { cache } from "react";
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

/** One JWT verify + one DB read per RSC/request (deduped via React cache). */
export const getAppSession = cache(async (): Promise<AppSession | null> => {
  const token = await getSessionTokenFromCookies();
  if (!token) return null;

  const decoded = await verifyFirebaseSessionCookieEdge(token);
  if (!decoded?.sub) return null;

  let user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      role: true,
    },
  });

  if (!user) {
    try {
      user = await ensureAppUserFromFirebaseToken(decoded);
    } catch {
      return null;
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
    },
  };
});

/** @deprecated Use getAppSession — kept for imports; same cached implementation. */
export const getSessionWithFreshRole = getAppSession;
