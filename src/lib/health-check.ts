import { getAppVersion } from "@/lib/build-version";
import { prisma } from "@/lib/prisma";

const DB_CHECK_TIMEOUT_MS = 3000;

async function checkDatabase(): Promise<void> {
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error("timeout"));
    }, DB_CHECK_TIMEOUT_MS);
  });

  await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
}

export type HealthCheckResult =
  | { ok: true; version: string; dbMs: number }
  | { ok: false; error: "database"; dbMs?: number };

/** Shared by `/api/health` and `/status` so probes and UI stay consistent. */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  const started = Date.now();
  try {
    await checkDatabase();
    return { ok: true, version: getAppVersion(), dbMs: Date.now() - started };
  } catch {
    return { ok: false, error: "database", dbMs: Date.now() - started };
  }
}
