/**
 * Guards for professor-email LLM routes (cost / abuse).
 * Uses Upstash Redis when configured; otherwise in-memory Maps (per-instance).
 */

import { getUpstashRedis } from "@/lib/upstash-rate-limit";

function envNum(key: string, fallback: number): number {
  const v = process.env[key]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const MIN_INTERVAL_MS = envNum("PROF_EMAIL_LLM_MIN_INTERVAL_MS", 8_000);
const SUCCESS_COOLDOWN_MS = envNum("PROF_EMAIL_LLM_COOLDOWN_MS", 12_000);
/** Successful LLM-backed actions allowed per UTC calendar day per user. */
const DAILY_MAX = envNum("PROF_EMAIL_LLM_DAILY_MAX", 80);

export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function secondsUntilUtcDayEnd(d = new Date()): number {
  const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(1, Math.ceil((end - d.getTime()) / 1000));
}

const KEY_PREFIX = "gradapply:prof-email:user";

export type ProfEmailLlmDenial = {
  status: 429;
  message: string;
  retryAfterSec?: number;
};

const lastAttemptAt = new Map<string, number>();
const lastSuccessAt = new Map<string, number>();
const successDayCount = new Map<
  string,
  { utcDay: string; count: number }
>();

function profKeyBase(userId: string): string {
  return `${KEY_PREFIX}:${userId}`;
}

function denyProf(message: string, retryAfterSec?: number): never {
  const err = new Error(message) as Error & { denial: ProfEmailLlmDenial };
  err.denial = {
    status: 429,
    message: err.message,
    ...(retryAfterSec != null ? { retryAfterSec } : {}),
  };
  throw err;
}

function assertProfEmailLlmAllowedMemory(userId: string): void {
  const now = Date.now();

  const lastTry = lastAttemptAt.get(userId);
  if (lastTry != null && now - lastTry < MIN_INTERVAL_MS) {
    const retryAfterSec = Math.ceil((MIN_INTERVAL_MS - (now - lastTry)) / 1000);
    denyProf(`Wait ${retryAfterSec}s between professor-email AI requests.`, retryAfterSec);
  }

  const lastOk = lastSuccessAt.get(userId);
  if (lastOk != null && now - lastOk < SUCCESS_COOLDOWN_MS) {
    const retryAfterSec = Math.ceil(
      (SUCCESS_COOLDOWN_MS - (now - lastOk)) / 1000,
    );
    denyProf(
      `Wait ${retryAfterSec}s after your last successful AI action before starting another.`,
      retryAfterSec,
    );
  }

  const day = utcDayKey();
  let row = successDayCount.get(userId);
  if (!row || row.utcDay !== day) {
    row = { utcDay: day, count: 0 };
    successDayCount.set(userId, row);
  }
  if (row.count >= DAILY_MAX) {
    denyProf(
      "Daily limit for professor-email AI actions reached. Try again tomorrow.",
    );
  }
}

async function assertProfEmailLlmAllowedRedis(userId: string): Promise<void> {
  const redis = getUpstashRedis();
  if (!redis) {
    assertProfEmailLlmAllowedMemory(userId);
    return;
  }
  const now = Date.now();
  const base = profKeyBase(userId);
  const day = utcDayKey();
  const [attemptStr, successStr, dayCountStr] = await redis.mget(
    `${base}:lastAttempt`,
    `${base}:lastSuccess`,
    `${base}:count:${day}`,
  );

  const lastTry = attemptStr != null ? Number(attemptStr) : NaN;
  if (Number.isFinite(lastTry) && now - lastTry < MIN_INTERVAL_MS) {
    const retryAfterSec = Math.ceil((MIN_INTERVAL_MS - (now - lastTry)) / 1000);
    denyProf(`Wait ${retryAfterSec}s between professor-email AI requests.`, retryAfterSec);
  }

  const lastOk = successStr != null ? Number(successStr) : NaN;
  if (Number.isFinite(lastOk) && now - lastOk < SUCCESS_COOLDOWN_MS) {
    const retryAfterSec = Math.ceil(
      (SUCCESS_COOLDOWN_MS - (now - lastOk)) / 1000,
    );
    denyProf(
      `Wait ${retryAfterSec}s after your last successful AI action before starting another.`,
      retryAfterSec,
    );
  }

  const dayCount =
    dayCountStr != null && dayCountStr !== ""
      ? Number(dayCountStr)
      : 0;
  if (Number.isFinite(dayCount) && dayCount >= DAILY_MAX) {
    denyProf(
      "Daily limit for professor-email AI actions reached. Try again tomorrow.",
    );
  }
}

export async function assertProfEmailLlmAllowed(userId: string): Promise<void> {
  if (getUpstashRedis()) {
    await assertProfEmailLlmAllowedRedis(userId);
  } else {
    assertProfEmailLlmAllowedMemory(userId);
  }
}

function markProfEmailLlmAttemptMemory(userId: string): void {
  lastAttemptAt.set(userId, Date.now());
}

async function markProfEmailLlmAttemptRedis(userId: string): Promise<void> {
  const redis = getUpstashRedis();
  if (!redis) {
    markProfEmailLlmAttemptMemory(userId);
    return;
  }
  await redis.set(`${profKeyBase(userId)}:lastAttempt`, String(Date.now()));
}

export async function markProfEmailLlmAttempt(userId: string): Promise<void> {
  if (getUpstashRedis()) {
    await markProfEmailLlmAttemptRedis(userId);
  } else {
    markProfEmailLlmAttemptMemory(userId);
  }
}

function markProfEmailLlmSuccessMemory(userId: string): void {
  const now = Date.now();
  lastSuccessAt.set(userId, now);

  const day = utcDayKey();
  let row = successDayCount.get(userId);
  if (!row || row.utcDay !== day) {
    row = { utcDay: day, count: 0 };
  }
  row.count += 1;
  successDayCount.set(userId, row);
}

async function markProfEmailLlmSuccessRedis(userId: string): Promise<void> {
  const redis = getUpstashRedis();
  if (!redis) {
    markProfEmailLlmSuccessMemory(userId);
    return;
  }
  const now = Date.now();
  const base = profKeyBase(userId);
  const day = utcDayKey();
  const count = await redis.incr(`${base}:count:${day}`);
  if (count === 1) {
    await redis.expire(`${base}:count:${day}`, secondsUntilUtcDayEnd());
  }
  await redis.set(`${base}:lastSuccess`, String(now));
}

export async function markProfEmailLlmSuccess(userId: string): Promise<void> {
  if (getUpstashRedis()) {
    await markProfEmailLlmSuccessRedis(userId);
  } else {
    markProfEmailLlmSuccessMemory(userId);
  }
}
