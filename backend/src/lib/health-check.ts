// @ts-nocheck
import mongoose from "mongoose";

import { getAppVersion } from "@/lib/build-version";

const DB_CHECK_TIMEOUT_MS = 3000;

async function checkDatabase(): Promise<void> {
  const timeout = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error("timeout"));
    }, DB_CHECK_TIMEOUT_MS);
  });

  await Promise.race([
    mongoose.connection.db?.admin().command({ ping: 1 }),
    timeout,
  ]);
}

export type HealthCheckResult =
  | { ok: true; version: string }
  | { ok: false; error: "database" };

/** Shared by `/api/health` and `/status` so probes and UI stay consistent. */
export async function runHealthCheck(): Promise<HealthCheckResult> {
  try {
    await checkDatabase();
    return { ok: true, version: getAppVersion() };
  } catch {
    return { ok: false, error: "database" };
  }
}
