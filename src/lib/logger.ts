type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolvedLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "warn" : "info";
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[resolvedLevel()];
}

function emit(level: LogLevel, tag: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const payload = { tag, ...data };
  if (level === "error") console.error(`[gradapply][${tag}]`, payload);
  else if (level === "warn") console.warn(`[gradapply][${tag}]`, payload);
  else if (level === "info") console.info(`[gradapply][${tag}]`, payload);
  else console.log(`[gradapply][${tag}]`, payload);
}

/** Level-gated logging for Workers (`wrangler tail --search gradapply`). */
export const log = {
  debug: (tag: string, data?: Record<string, unknown>) => emit("debug", tag, data),
  info: (tag: string, data?: Record<string, unknown>) => emit("info", tag, data),
  warn: (tag: string, data?: Record<string, unknown>) => emit("warn", tag, data),
  error: (tag: string, data?: Record<string, unknown>) => emit("error", tag, data),
};
