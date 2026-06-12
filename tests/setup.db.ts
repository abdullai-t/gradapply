/**
 * Vitest setup for *.db.test.ts — real Postgres only (no Prisma mock).
 * DATABASE_URL must match DATABASE_URL_TEST before app modules load.
 */
if (process.env.DATABASE_URL_TEST?.trim()) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST.trim();
}

process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
process.env.PAYSTACK_SECRET_KEY =
  process.env.PAYSTACK_SECRET_KEY ?? "sk_test_dummy";
