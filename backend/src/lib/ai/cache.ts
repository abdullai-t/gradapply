import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  if (!redis) redis = new Redis({ url, token });
  return redis;
}

const TTL: Record<string, number> = {
  professor: 60 * 60 * 24 * 7,
  program: 60 * 60 * 24,
  fit_score: 60 * 60 * 6,
};

const PREFIX = "gradapply";

export async function cacheGet<T>(
  namespace: string,
  key: string,
): Promise<T | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    return (await r.get<T>(`${PREFIX}:${namespace}:${key}`)) ?? null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  namespace: string,
  key: string,
  value: T,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(`${PREFIX}:${namespace}:${key}`, value, {
      ex: TTL[namespace] ?? 3600,
    });
  } catch {
    /* ignore */
  }
}

export function stableKey(obj: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(obj, Object.keys(obj).sort())).toString(
    "base64url",
  ).slice(0, 48);
}
