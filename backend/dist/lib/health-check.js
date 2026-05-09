// @ts-nocheck
import mongoose from "mongoose";
import { getAppVersion } from "@/lib/build-version";
const DB_CHECK_TIMEOUT_MS = 3000;
async function checkDatabase() {
    const timeout = new Promise((_, reject) => {
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
/** Shared by `/api/health` and `/status` so probes and UI stay consistent. */
export async function runHealthCheck() {
    try {
        await checkDatabase();
        return { ok: true, version: getAppVersion() };
    }
    catch {
        return { ok: false, error: "database" };
    }
}
