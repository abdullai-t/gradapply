import { Pool } from "pg";

type GlobalDb = typeof globalThis & {
  __gradapplyPool?: Pool;
};

const globalDb = globalThis as GlobalDb;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize database pool");
}

/**
 * Shared Postgres pool for raw SQL usage.
 * Centralized here so route handlers don't instantiate per-request pools.
 */
export const pool =
  globalDb.__gradapplyPool ??
  new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 20),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 5_000),
  });

if (process.env.NODE_ENV !== "production") {
  globalDb.__gradapplyPool = pool;
}
