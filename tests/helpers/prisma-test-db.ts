import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";

import { prisma } from "@/lib/prisma";

let migrated = false;

const DOCKER_TEST_URL =
  "postgresql://postgres:pass@localhost:5433/gradapply_test";

/** Only `DATABASE_URL_TEST` — never fall back to app `DATABASE_URL` (Neon/prod). */
export function testDatabaseUrl(): string | null {
  return process.env.DATABASE_URL_TEST?.trim() || null;
}

export function isDbTestEnabled(): boolean {
  return Boolean(testDatabaseUrl());
}

export function assertTestDatabaseConfigured(): void {
  const url = testDatabaseUrl();
  if (!url) {
    throw new Error(
      [
        "DATABASE_URL_TEST is not set.",
        "For local runs:",
        "  1. pnpm run test:db:up",
        `  2. export DATABASE_URL_TEST="${DOCKER_TEST_URL}"`,
        "  3. pnpm run test:integration:db",
      ].join("\n"),
    );
  }
}

/** App Prisma proxy — same DB as tests after setup.db.ts syncs DATABASE_URL. */
export function getTestPrisma(): PrismaClient {
  assertTestDatabaseConfigured();
  return prisma as unknown as PrismaClient;
}

function formatMigrateError(error: unknown, url: string): string {
  const msg = error instanceof Error ? error.message : String(error);
  return [
    "Could not run prisma migrate deploy against DATABASE_URL_TEST.",
    `URL host: ${safeHostFromUrl(url)}`,
    "",
    "Common fixes:",
    "  • Docker (recommended): pnpm run test:db:up",
    `    export DATABASE_URL_TEST="${DOCKER_TEST_URL}"`,
    "",
    `Prisma error: ${msg}`,
  ].join("\n");
}

function safeHostFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}/${u.pathname.replace(/^\//, "")}`;
  } catch {
    return "(invalid URL)";
  }
}

/** Run migrations once per Vitest process. */
export function migrateTestDatabaseOnce(): void {
  if (migrated) return;
  assertTestDatabaseConfigured();
  const url = testDatabaseUrl()!;
  process.env.DATABASE_URL = url;
  try {
    execSync("pnpm exec prisma migrate deploy", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: url },
    });
    migrated = true;
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String((error as { stderr: Buffer }).stderr)
        : "";
    throw new Error(formatMigrateError(stderr || error, url));
  }
}

/** @deprecated Use migrateTestDatabaseOnce */
export function migrateTestDatabase(): void {
  migrateTestDatabaseOnce();
}

/** Clear mutable rows between DB integration tests (FK-safe via Prisma). */
export async function resetTestDatabase(): Promise<void> {
  const db = getTestPrisma();
  await db.$transaction([
    db.chatMessage.deleteMany(),
    db.billingPayment.deleteMany(),
    db.paystackEventLog.deleteMany(),
    db.googleDocLink.deleteMany(),
    db.school.deleteMany(),
    db.profile.deleteMany(),
    db.user.deleteMany(),
  ]);
}

export async function disconnectTestDatabase(): Promise<void> {
  const db = getTestPrisma();
  await db.$disconnect();
}

export async function seedMinimalUsers(): Promise<{
  freeUserId: string;
  plusUserId: string;
}> {
  const db = getTestPrisma();
  const free = await db.user.create({
    data: {
      id: process.env.E2E_FREE_USER_ID ?? "e2e-free-user",
      email: "free-e2e@test.local",
      name: "E2E Free",
      planTier: "FREE",
      aiCreditsBalance: 5,
    },
  });
  const plus = await db.user.create({
    data: {
      id: process.env.E2E_PLUS_USER_ID ?? "e2e-plus-user",
      email: "plus-e2e@test.local",
      name: "E2E Plus",
      planTier: "PLUS",
      aiUsageUsed: 0,
      aiCreditsBalance: 0,
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return { freeUserId: free.id, plusUserId: plus.id };
}
