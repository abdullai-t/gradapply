// @ts-nocheck
import { resolveUserId } from "@/lib/auth-session";
import { User } from "@gradapply/db";
import type { UserRole } from "@/types/enums";

export type ElevatedRole = "ADMIN" | "SUPERADMIN";

export async function getCurrentUserRole(
  userId: string,
): Promise<UserRole | null> {
  const user = (await User.findById(userId).select({ role: 1 }).lean()) as {
    role?: UserRole;
  } | null;
  return user?.role ?? null;
}

export async function requireElevatedUser(
  req: Request,
): Promise<{
  userId: string;
  role: ElevatedRole;
} | null> {
  const userId = await resolveUserId(req);
  if (!userId) return null;
  let role = await getCurrentUserRole(userId);
  if (role === "USER") {
    const allowList = (process.env.SUPERADMIN_EMAILS ?? "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    if (allowList.length > 0) {
      const user = (await User.findById(userId)
        .select({ email: 1, emailVerified: 1 })
        .lean()) as {
        email?: string | null;
        emailVerified?: Date | null;
      } | null;
      const email = user?.email?.trim().toLowerCase();
      const isVerified = Boolean(user?.emailVerified);
      if (email && isVerified && allowList.includes(email)) {
        const superadminCount = await User.countDocuments({
          role: "SUPERADMIN",
        });
        if (superadminCount > 0) {
          return null;
        }
        await User.findByIdAndUpdate(userId, { role: "SUPERADMIN" });
        role = "SUPERADMIN";
      }
    }
  }
  if (role !== "ADMIN" && role !== "SUPERADMIN") return null;
  return { userId, role };
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
