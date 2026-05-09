// @ts-nocheck
/**
 * Guards for POST /api/sop/variants (cost / abuse).
 * Uses Upstash Redis when configured; otherwise in-memory Maps (per-instance).
 */
import { getUpstashRedis } from "@/lib/upstash-rate-limit";
function envNum(key, fallback) {
    const v = process.env[key]?.trim();
    if (!v)
        return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
}
const MIN_INTERVAL_MS = envNum("SOP_GENERATE_MIN_INTERVAL_MS", 20_000);
const SUCCESS_COOLDOWN_MS = envNum("SOP_GENERATE_COOLDOWN_MS", 60_000);
/** Successful generations allowed per UTC calendar day per user. */
const DAILY_MAX = envNum("SOP_GENERATE_DAILY_MAX", 30);
export function utcDayKey(d = new Date()) {
    return d.toISOString().slice(0, 10);
}
function secondsUntilUtcDayEnd(d = new Date()) {
    const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
    return Math.max(1, Math.ceil((end - d.getTime()) / 1000));
}
const KEY_PREFIX = "gradapply:sop:user";
const lastAttemptAt = new Map();
const lastSuccessAt = new Map();
const successDayCount = new Map();
function sopKeyBase(userId) {
    return `${KEY_PREFIX}:${userId}`;
}
function denySop(message, retryAfterSec) {
    const err = new Error(message);
    err.denial = {
        status: 429,
        message: err.message,
        ...(retryAfterSec != null ? { retryAfterSec } : {}),
    };
    throw err;
}
function assertSopGenerateAllowedMemory(userId) {
    const now = Date.now();
    const lastTry = lastAttemptAt.get(userId);
    if (lastTry != null && now - lastTry < MIN_INTERVAL_MS) {
        const retryAfterSec = Math.ceil((MIN_INTERVAL_MS - (now - lastTry)) / 1000);
        denySop(`Wait ${retryAfterSec}s between generation requests.`, retryAfterSec);
    }
    const lastOk = lastSuccessAt.get(userId);
    if (lastOk != null && now - lastOk < SUCCESS_COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((SUCCESS_COOLDOWN_MS - (now - lastOk)) / 1000);
        denySop(`Wait ${retryAfterSec}s after your last successful generation before starting another.`, retryAfterSec);
    }
    const day = utcDayKey();
    let row = successDayCount.get(userId);
    if (!row || row.utcDay !== day) {
        row = { utcDay: day, count: 0 };
        successDayCount.set(userId, row);
    }
    if (row.count >= DAILY_MAX) {
        denySop("Daily SOP generation limit reached for your account. Try again tomorrow.");
    }
}
async function assertSopGenerateAllowedRedis(userId) {
    const redis = getUpstashRedis();
    if (!redis) {
        assertSopGenerateAllowedMemory(userId);
        return;
    }
    const now = Date.now();
    const base = sopKeyBase(userId);
    const day = utcDayKey();
    const [attemptStr, successStr, dayCountStr] = await redis.mget(`${base}:lastAttempt`, `${base}:lastSuccess`, `${base}:count:${day}`);
    const lastTry = attemptStr != null ? Number(attemptStr) : NaN;
    if (Number.isFinite(lastTry) && now - lastTry < MIN_INTERVAL_MS) {
        const retryAfterSec = Math.ceil((MIN_INTERVAL_MS - (now - lastTry)) / 1000);
        denySop(`Wait ${retryAfterSec}s between generation requests.`, retryAfterSec);
    }
    const lastOk = successStr != null ? Number(successStr) : NaN;
    if (Number.isFinite(lastOk) && now - lastOk < SUCCESS_COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((SUCCESS_COOLDOWN_MS - (now - lastOk)) / 1000);
        denySop(`Wait ${retryAfterSec}s after your last successful generation before starting another.`, retryAfterSec);
    }
    const dayCount = dayCountStr != null && dayCountStr !== ""
        ? Number(dayCountStr)
        : 0;
    if (Number.isFinite(dayCount) && dayCount >= DAILY_MAX) {
        denySop("Daily SOP generation limit reached for your account. Try again tomorrow.");
    }
}
export async function assertSopGenerateAllowed(userId) {
    if (getUpstashRedis()) {
        await assertSopGenerateAllowedRedis(userId);
    }
    else {
        assertSopGenerateAllowedMemory(userId);
    }
}
function markSopGenerateAttemptMemory(userId) {
    lastAttemptAt.set(userId, Date.now());
}
async function markSopGenerateAttemptRedis(userId) {
    const redis = getUpstashRedis();
    if (!redis) {
        markSopGenerateAttemptMemory(userId);
        return;
    }
    await redis.set(`${sopKeyBase(userId)}:lastAttempt`, String(Date.now()));
}
export async function markSopGenerateAttempt(userId) {
    if (getUpstashRedis()) {
        await markSopGenerateAttemptRedis(userId);
    }
    else {
        markSopGenerateAttemptMemory(userId);
    }
}
function markSopGenerateSuccessMemory(userId) {
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
async function markSopGenerateSuccessRedis(userId) {
    const redis = getUpstashRedis();
    if (!redis) {
        markSopGenerateSuccessMemory(userId);
        return;
    }
    const now = Date.now();
    const base = sopKeyBase(userId);
    const day = utcDayKey();
    const count = await redis.incr(`${base}:count:${day}`);
    if (count === 1) {
        await redis.expire(`${base}:count:${day}`, secondsUntilUtcDayEnd());
    }
    await redis.set(`${base}:lastSuccess`, String(now));
}
export async function markSopGenerateSuccess(userId) {
    if (getUpstashRedis()) {
        await markSopGenerateSuccessRedis(userId);
    }
    else {
        markSopGenerateSuccessMemory(userId);
    }
}
