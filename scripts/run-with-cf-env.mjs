#!/usr/bin/env node
/**
 * Wrangler 4 + Hyperdrive requires a local Postgres URL when running
 * opennextjs-cloudflare deploy/build (platform proxy), even for remote deploy.
 * Sets CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE from DATABASE_URL.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".env.local"));

const hyperdriveLocalKey =
  "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE";

if (!process.env[hyperdriveLocalKey]?.trim()) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    process.env[hyperdriveLocalKey] = databaseUrl;
  }
}

if (!process.env[hyperdriveLocalKey]?.trim()) {
  console.error(
    `[cf-env] Missing ${hyperdriveLocalKey}.\n` +
      "  Add DATABASE_URL to .env (same Postgres as Hyperdrive), or export:\n" +
      `  export ${hyperdriveLocalKey}="$DATABASE_URL"\n`,
  );
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("[cf-env] Usage: node scripts/run-with-cf-env.mjs <command> [args…]");
  process.exit(1);
}

const [command, ...rest] = args;
const result = spawnSync(command, rest, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: command === "pnpm" || command.endsWith("pnpm"),
});

process.exit(result.status ?? 1);
