import { Prisma, type User, type UserRole } from "@prisma/client";

import { getBillingAdminConfig } from "@/lib/billing-admin-config";
import { log } from "@/lib/logger";
import { sendWelcomeEmail } from "@/lib/notifications/send";
import { prisma } from "@/lib/prisma";

import type { VerifiedFirebaseToken } from "./verify-token";

function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes(field)
  );
}

function profilePatchFromToken(token: VerifiedFirebaseToken) {
  const email = token.email?.trim().toLowerCase() || null;
  return {
    email: email ?? undefined,
    emailVerified: token.email_verified ? new Date() : undefined,
    name: token.name?.trim() || undefined,
    image: token.picture || undefined,
  };
}

/** DB role only — never elevate from Firebase JWT custom claims. */
export function roleFromFirebaseToken(_token: VerifiedFirebaseToken): UserRole {
  return "USER";
}

function profileNeedsSync(existing: User, token: VerifiedFirebaseToken): boolean {
  const patch = profilePatchFromToken(token);
  const email = token.email?.trim().toLowerCase() || null;
  if (email && existing.email !== email) return true;
  if (patch.name !== undefined && (existing.name ?? null) !== (patch.name ?? null)) {
    return true;
  }
  if (patch.image !== undefined && (existing.image ?? null) !== (patch.image ?? null)) {
    return true;
  }
  if (token.email_verified && !existing.emailVerified) return true;
  return false;
}

async function linkLegacyUserByEmail(
  token: VerifiedFirebaseToken,
  email: string,
): Promise<User | null> {
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (!byEmail) return null;

  return prisma.user.update({
    where: { id: byEmail.id },
    data: profilePatchFromToken(token),
  });
}

async function createFirebaseUser(
  token: VerifiedFirebaseToken,
): Promise<User> {
  const id = token.sub;
  const email = token.email?.trim().toLowerCase() || null;
  const cfg = await getBillingAdminConfig();

  try {
    return await prisma.user.create({
      data: {
        id,
        email,
        emailVerified: token.email_verified ? new Date() : null,
        name: token.name?.trim() || null,
        image: token.picture || null,
        role: "USER",
        aiCreditsBalance: cfg.freeSignupCredits,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error, "id")) {
      const raced = await prisma.user.findUnique({ where: { id } });
      if (raced) {
        return prisma.user.update({
          where: { id },
          data: profilePatchFromToken(token),
        });
      }
    }
    if (email && isUniqueConstraintError(error, "email")) {
      const linked = await linkLegacyUserByEmail(token, email);
      if (linked) return linked;
      const raced = await prisma.user.findUnique({ where: { email } });
      if (raced) {
        return prisma.user.update({
          where: { id: raced.id },
          data: profilePatchFromToken(token),
        });
      }
    }
    throw error;
  }
}

export type EnsureAppUserOptions = {
  /** When true, patch profile fields from the token if they differ (session POST). */
  syncProfile?: boolean;
};

export async function ensureAppUserFromFirebaseToken(
  token: VerifiedFirebaseToken,
  opts?: EnsureAppUserOptions,
): Promise<User> {
  const id = token.sub;
  const email = token.email?.trim().toLowerCase() || null;

  const existing = await prisma.user.findUnique({
    where: { id },
  });

  if (existing) {
    if (opts?.syncProfile && profileNeedsSync(existing, token)) {
      return prisma.user.update({
        where: { id },
        data: profilePatchFromToken(token),
      });
    }
    return existing;
  }

  if (email) {
    const linked = await linkLegacyUserByEmail(token, email);
    if (linked) return linked;
  }

  const user = await createFirebaseUser(token);

  if (user.id === id) {
    const welcome = await sendWelcomeEmail({
      id: user.id,
      email: user.email,
      name: user.name,
    });
    if (welcome.status === "failed") {
      log.warn("firebase.create_user.welcome_failed", {
        userId: user.id,
        error: welcome.error,
      });
    }
  }

  return user;
}
