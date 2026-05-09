/**
 * Prints a one-time verification URL (same as the email body). Use when SMTP works
 * but you want to copy the link from the terminal. Start `pnpm dev` and open the URL.
 *
 *   VERIFY_EMAIL=user@example.com pnpm run db:print-verify-link
 */

import { ensureMongoConnected } from "@gradapply/db";

import { appOrigin } from "../src/lib/app-origin";
import { issueEmailVerificationToken } from "../src/lib/email-verification";
import { prisma } from "../src/lib/prisma";

const raw =
  process.env.VERIFY_EMAIL?.trim() ||
  process.argv.find((a) => a.includes("@")) ||
  "";
const email = raw.toLowerCase();

async function main() {
  if (!email) {
    console.error(
      "Usage: VERIFY_EMAIL=user@example.com pnpm run db:print-verify-link",
    );
    process.exit(1);
  }

  await ensureMongoConnected();
  const token = await issueEmailVerificationToken(email);
  const url = `${appOrigin()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  console.info("[print-verify-link] Open in browser (dev server running):\n");
  console.info(url);
}

main()
  .catch((err) => {
    console.error("[print-verify-link] failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
