/**
 * Vitest setup for *.db.test.ts — real Postgres only (no Prisma mock).
 * DATABASE_URL must match DATABASE_URL_TEST before app modules load.
 */
if (process.env.DATABASE_URL_TEST?.trim()) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST.trim();
}

const env = process.env as Record<string, string | undefined>;
env.NODE_ENV = env.NODE_ENV ?? "test";
env.PAYSTACK_SECRET_KEY = env.PAYSTACK_SECRET_KEY ?? "sk_test_dummy";
