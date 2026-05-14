import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { cache } from "react";

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function createPrismaClient() {
  const pool = new Pool({
    connectionString: resolveDatabaseUrl(),
    maxUses: 1,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

/** Per-request Prisma client (required on Cloudflare Workers). */
export const getPrisma = cache(createPrismaClient);

/** Async variant for static/ISR routes that need `getCloudflareContext({ async: true })`. */
export const getPrismaAsync = cache(async () => createPrismaClient());

/**
 * Back-compat export for existing call sites. Routes each property access through
 * a request-scoped client so Workers never reuse pooled DB connections.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = Reflect.get(client, prop, client);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
