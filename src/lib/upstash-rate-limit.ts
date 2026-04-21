/**
 * Distributed rate limiting via Upstash Redis + @upstash/ratelimit.
 * When `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are both set,
 * limits are shared across Vercel instances/regions.
 * Otherwise helpers fall back to in-memory maps (same caveats as legacy SOP/prof-email)
 * or no-op / separate in-memory paths as documented per API.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let cachedRedis: Redis | null | undefined;

export function getUpstashRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  cachedRedis = url && token ? new Redis({ url, token }) : null;
  return cachedRedis;
}

function envNum(key: string, fallback: number): number {
  const v = process.env[key]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** First public client IP: Vercel sets `x-forwarded-for` (proxy chain) and `x-real-ip`. */
export function getClientIpFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "unknown";
}

export type RegisterRateResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

let registerIpRatelimit: Ratelimit | undefined;

function getRegisterIpRatelimit(): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;
  if (!registerIpRatelimit) {
    const perHour = envNum("RATE_LIMIT_REGISTER_PER_IP_PER_HOUR", 5);
    registerIpRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(perHour, "1 h"),
      prefix: "gradapply:register:ip",
    });
  }
  return registerIpRatelimit;
}

const registerMemory = new Map<
  string,
  { count: number; /** ms */ windowEnd: number }
>();
const REGISTER_MEMORY_MAX_KEYS = 5000;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

function pruneRegisterMemory(now: number): void {
  Array.from(registerMemory.entries()).forEach(([ip, row]) => {
    if (now > row.windowEnd) registerMemory.delete(ip);
  });
  if (registerMemory.size <= REGISTER_MEMORY_MAX_KEYS) return;
  const overflow = registerMemory.size - REGISTER_MEMORY_MAX_KEYS + 500;
  let i = 0;
  Array.from(registerMemory.keys()).forEach((ip) => {
    if (i >= overflow) return;
    registerMemory.delete(ip);
    i += 1;
  });
}

function rateLimitRegisterMemory(ip: string): RegisterRateResult {
  const max = envNum("RATE_LIMIT_REGISTER_PER_IP_PER_HOUR", 5);
  const now = Date.now();
  pruneRegisterMemory(now);
  let row = registerMemory.get(ip);
  if (!row || now > row.windowEnd) {
    row = { count: 1, windowEnd: now + REGISTER_WINDOW_MS };
    registerMemory.set(ip, row);
    return { ok: true };
  }
  if (row.count >= max) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((row.windowEnd - now) / 1000),
    );
    return { ok: false, retryAfterSec };
  }
  row.count += 1;
  return { ok: true };
}

/** Registration: per IP per hour (Upstash sliding window, or in-memory fixed window). */
export async function assertRegisterAllowedByIp(
  ip: string,
): Promise<RegisterRateResult> {
  const rl = getRegisterIpRatelimit();
  if (rl) {
    const result = await rl.limit(ip);
    void result.pending;
    if (!result.success) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((result.reset - Date.now()) / 1000),
      );
      return { ok: false, retryAfterSec };
    }
    return { ok: true };
  }
  return rateLimitRegisterMemory(ip);
}

let chatUserRatelimit: Ratelimit | undefined;

function getChatUserRatelimit(): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;
  if (!chatUserRatelimit) {
    const perMin = envNum("RATE_LIMIT_CHAT_PER_USER_PER_MINUTE", 30);
    chatUserRatelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(perMin, "1 m"),
      prefix: "gradapply:chat:user",
    });
  }
  return chatUserRatelimit;
}

export type ChatRateResult =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/** Per-user chat POST cap; no extra limit when Upstash is unset. */
export async function assertChatPostAllowedForUser(
  userId: string,
): Promise<ChatRateResult> {
  const rl = getChatUserRatelimit();
  if (!rl) return { ok: true };
  const result = await rl.limit(userId);
  void result.pending;
  if (!result.success) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    return { ok: false, retryAfterSec };
  }
  return { ok: true };
}
