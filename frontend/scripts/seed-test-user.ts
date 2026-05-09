/**
 * Upserts a local email/password test user with emailVerified set (required by credentials flow).
 *
 * Usage (from `frontend/`, with Mongo running):
 *   pnpm run db:seed:test-user
 *
 * Override defaults:
 *   SEED_TEST_EMAIL=test@example.com SEED_TEST_PASSWORD='Secret123!' pnpm run db:seed:test-user
 *
 * Loads vars from `.env` via Node's --env-file (see package.json script).
 */

import { ensureMongoConnected } from "@gradapply/db";

import { prisma } from "../src/lib/prisma";
import { getBillingAdminConfig } from "../src/lib/billing-admin-config";
import { currentBillingMonthToken } from "../src/lib/billing-allowance";
import { hashPassword } from "../src/lib/password";

const EMAIL = process.env.SEED_TEST_EMAIL ?? "test@gradapply.local";
const PASSWORD = process.env.SEED_TEST_PASSWORD ?? "TestUser123!";
const NAME = process.env.SEED_TEST_NAME ?? "Test User";

async function main() {
  await ensureMongoConnected();
  const billingCfg = await getBillingAdminConfig();

  const email = EMAIL.toLowerCase().trim();
  const passwordHash = await hashPassword(PASSWORD);

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        emailVerified: new Date(),
        name: NAME,
      },
    });
    console.info("[seed-test-user] updated:", email);
  } else {
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: NAME,
        emailVerified: new Date(),
        aiCreditsBalance: billingCfg.freeSignupCredits,
        aiUsageMonth: currentBillingMonthToken(),
      },
    });
    console.info("[seed-test-user] created:", email);
  }

  console.info("[seed-test-user] Use these credentials at /login (email + password):");
  console.info(`  email:    ${email}`);
  console.info(`  password: ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error("[seed-test-user] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
