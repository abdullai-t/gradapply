/**
 * In-memory guards for POST /api/sop/variants (cost / abuse).
 * For multi-instance deploys, replace with Redis or similar.
 */

const lastAttemptAt = new Map<string, number>();
const lastSuccessAt = new Map<string, number>();
const successDayCount = new Map<
  string,
  { utcDay: string; count: number }
>();

function envNum(key: string, fallback: number): number {
  const v = process.env[key]?.trim();
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const MIN_INTERVAL_MS = envNum("SOP_GENERATE_MIN_INTERVAL_MS", 20_000);
const SUCCESS_COOLDOWN_MS = envNum("SOP_GENERATE_COOLDOWN_MS", 60_000);
/** Successful generations allowed per UTC calendar day per user. */
const DAILY_MAX = envNum("SOP_GENERATE_DAILY_MAX", 30);

function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export type SopGenerateDenial = {
  status: 429;
  message: string;
  retryAfterSec?: number;
};

export function assertSopGenerateAllowed(userId: string): void {
  const now = Date.now();

  const lastTry = lastAttemptAt.get(userId);
  if (lastTry != null && now - lastTry < MIN_INTERVAL_MS) {
    const retryAfterSec = Math.ceil((MIN_INTERVAL_MS - (now - lastTry)) / 1000);
    const err = new Error(
      `Wait ${retryAfterSec}s between generation requests.`,
    ) as Error & { denial: SopGenerateDenial };
    err.denial = {
      status: 429,
      message: err.message,
      retryAfterSec,
    };
    throw err;
  }

  const lastOk = lastSuccessAt.get(userId);
  if (lastOk != null && now - lastOk < SUCCESS_COOLDOWN_MS) {
    const retryAfterSec = Math.ceil(
      (SUCCESS_COOLDOWN_MS - (now - lastOk)) / 1000,
    );
    const err = new Error(
      `Wait ${retryAfterSec}s after your last successful generation before starting another.`,
    ) as Error & { denial: SopGenerateDenial };
    err.denial = {
      status: 429,
      message: err.message,
      retryAfterSec,
    };
    throw err;
  }

  const day = utcDayKey();
  let row = successDayCount.get(userId);
  if (!row || row.utcDay !== day) {
    row = { utcDay: day, count: 0 };
    successDayCount.set(userId, row);
  }
  if (row.count >= DAILY_MAX) {
    const err = new Error(
      "Daily SOP generation limit reached for your account. Try again tomorrow.",
    ) as Error & { denial: SopGenerateDenial };
    err.denial = { status: 429, message: err.message };
    throw err;
  }
}

export function markSopGenerateAttempt(userId: string): void {
  lastAttemptAt.set(userId, Date.now());
}

export function markSopGenerateSuccess(userId: string): void {
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
