/**
 * Marks an account as email-verified in MongoDB (local/dev when you cannot use the mail link).
 *
 *   cd frontend && VERIFY_EMAIL=test@gradapply.local pnpm run db:verify-email
 *
 * Or: pnpm run db:verify-email -- test@gradapply.local
 */

import { ensureMongoConnected } from "@gradapply/db";

import { prisma } from "../src/lib/prisma";

const raw =
  process.env.VERIFY_EMAIL?.trim() ||
  process.argv.find((a) => a.includes("@")) ||
  "";
const email = raw.toLowerCase();

async function main() {
  if (!email) {
    console.error(
      "Usage: VERIFY_EMAIL=user@example.com pnpm run db:verify-email\n" +
        "   or: pnpm run db:verify-email -- user@example.com",
    );
    process.exit(1);
  }

  await ensureMongoConnected();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`[verify-email] No user with email: ${email}`);
    process.exit(1);
  }

  if (user.emailVerified) {
    console.info(`[verify-email] Already verified: ${email}`);
    return;
  }

  await prisma.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  });

  console.info(`[verify-email] Verified: ${email}`);
}

main()
  .catch((err) => {
    console.error("[verify-email] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
