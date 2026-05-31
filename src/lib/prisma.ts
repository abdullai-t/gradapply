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

const getPrismaCached = cache(createPrismaClient);

const globalForPrisma = globalThis as {
  gradapplyPrisma?: PrismaClient;
};

/** Per-request Prisma client (required on Cloudflare Workers). */
export const getPrisma = getPrismaCached;

/** Async variant for static/ISR routes that need `getCloudflareContext({ async: true })`. */
export const getPrismaAsync = cache(async () => createPrismaClient());

type PrismaDelegate = Record<string, unknown>;

function hasModelDelegate(
  client: PrismaClient,
  model: string,
  method: string,
): boolean {
  const delegate = (client as PrismaClient & Record<string, PrismaDelegate | undefined>)[
    model
  ];
  return typeof delegate?.[method] === "function";
}

/** True when `prisma generate` included collaboration models. */
export function isPrismaCollaborationReady(client: PrismaClient): boolean {
  return hasModelDelegate(client, "collaborationSession", "create");
}

/** True when analytics models (`UserActivityDay`, `GoogleDocLink`) are on the client. */
export function isPrismaAnalyticsReady(client: PrismaClient): boolean {
  return (
    isPrismaCollaborationReady(client) &&
    hasModelDelegate(client, "userActivityDay", "count") &&
    hasModelDelegate(client, "googleDocLink", "count")
  );
}

export function hasPrismaModel(
  client: PrismaClient,
  model: string,
  method = "findMany",
): boolean {
  return hasModelDelegate(client, model, method);
}

const PRISMA_REFRESH_HINT =
  "Prisma Client is out of date. Run:\n  pnpm exec prisma generate\n  pnpm exec prisma migrate deploy\nThen restart the dev server (pnpm dev).";

function resolveFreshDb(check: (client: PrismaClient) => boolean): PrismaClient {
  const globalClient = globalForPrisma.gradapplyPrisma;
  if (globalClient && check(globalClient)) {
    return globalClient;
  }

  const cached = getPrismaCached();
  if (check(cached)) {
    globalForPrisma.gradapplyPrisma = cached;
    return cached;
  }

  const fresh = createPrismaClient();
  if (!check(fresh)) {
    throw new Error(PRISMA_REFRESH_HINT);
  }
  globalForPrisma.gradapplyPrisma = fresh;
  return fresh;
}

/**
 * Prisma client for collaboration APIs. Validates delegates at runtime so a stale
 * cached client fails with an actionable message instead of `.create` on undefined.
 */
export function getDb(): PrismaClient {
  return resolveFreshDb(isPrismaCollaborationReady);
}

/**
 * Prisma client for admin analytics (collaboration + UserActivityDay + GoogleDocLink).
 */
export function getAnalyticsDb(): PrismaClient {
  try {
    return resolveFreshDb(isPrismaAnalyticsReady);
  } catch {
    // Allow analytics to degrade when only newer models are missing on a warm client.
    return resolveFreshDb(isPrismaCollaborationReady);
  }
}

function resolvePrismaClient(): PrismaClient {
  const globalClient = globalForPrisma.gradapplyPrisma;
  if (globalClient) return globalClient;
  const cached = getPrismaCached();
  globalForPrisma.gradapplyPrisma = cached;
  return cached;
}

/**
 * Back-compat export for existing call sites. Routes each property access through
 * a request-scoped client so Workers never reuse pooled DB connections.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = resolvePrismaClient();
    const value = Reflect.get(client, prop, client);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});
