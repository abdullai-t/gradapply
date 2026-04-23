import { prisma } from "@/lib/prisma";

const cache = new Map<string, { enabled: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

function envOverrideForKey(key: string): boolean | null {
  const envKey = `FEATURE_FLAG_${key
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
  const raw = process.env[envKey]?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") {
    return true;
  }
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") {
    return false;
  }
  return null;
}

export async function isFeatureEnabled(
  key: string,
  defaultValue = false,
  options?: { fresh?: boolean },
): Promise<boolean> {
  const normalized = key.trim().toLowerCase();
  if (!normalized) return defaultValue;

  const envValue = envOverrideForKey(normalized);
  if (envValue != null) return envValue;

  const useCache = options?.fresh !== true;
  const now = Date.now();
  if (useCache) {
    const fromCache = cache.get(normalized);
    if (fromCache && fromCache.expiresAt > now) return fromCache.enabled;
  }

  const flag = await prisma.featureFlag.findUnique({
    where: { key: normalized },
    select: { enabled: true },
  });
  const enabled = flag?.enabled ?? defaultValue;
  if (useCache) {
    cache.set(normalized, { enabled, expiresAt: now + CACHE_TTL_MS });
  }
  return enabled;
}

export function clearFeatureFlagCache(key?: string): void {
  if (key) {
    cache.delete(key.trim().toLowerCase());
    return;
  }
  cache.clear();
}
