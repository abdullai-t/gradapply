// @ts-nocheck
import type { UserRole } from "@/types/enums";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ElevatedRole = "ADMIN" | "SUPERADMIN";

export async function getCurrentUserRole(
  userId: string,
): Promise<UserRole | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  return user?.role ?? null;
}

export async function requireElevatedUser(): Promise<{
  userId: string;
  role: ElevatedRole;
} | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  let role = await getCurrentUserRole(session.user.id);
  if (role === "USER") {
    const allowList = (process.env.SUPERADMIN_EMAILS ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    if (allowList.length > 0) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { email: true, emailVerified: true },
      });
      const email = user?.email?.trim().toLowerCase();
      const isVerified = Boolean(user?.emailVerified);
      if (email && isVerified && allowList.includes(email)) {
        // One-time secure bootstrap: allow env-listed, verified account
        // to become superadmin only if none exists yet.
        const superadminCount = await prisma.user.count({
          where: { role: "SUPERADMIN" },
        });
        if (superadminCount > 0) {
          return null;
        }
        await prisma.user.update({
          where: { id: session.user.id },
          data: { role: "SUPERADMIN" },
        });
        role = "SUPERADMIN";
      }
    }
  }
  if (role !== "ADMIN" && role !== "SUPERADMIN") return null;
  return { userId: session.user.id, role };
}

export function canManageRole(actor: ElevatedRole): boolean {
  return actor === "ADMIN" || actor === "SUPERADMIN";
}

export function canAssignRole(
  actor: ElevatedRole,
  targetRole: UserRole,
): boolean {
  if (actor === "SUPERADMIN") return true;
  return targetRole !== "SUPERADMIN";
}

export function canManageTargetUser(
  actor: ElevatedRole,
  targetRole: UserRole,
): boolean {
  if (actor === "SUPERADMIN") return true;
  return targetRole !== "SUPERADMIN";
}
