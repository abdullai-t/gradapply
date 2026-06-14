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

/**
 * Wrangler/Miniflare validates Hyperdrive local URLs and rejects auth without
 * `user:password@`. Local Postgres often uses `postgresql://user@host/...` (peer
 * auth, no password). Insert an empty password segment so deploy/build succeeds.
 */
function hyperdriveLocalConnectionString(databaseUrl) {
  const trimmed = databaseUrl.trim();
  try {
    const normalized = trimmed.replace(/^postgres(ql)?:\/\//i, "https://");
    const url = new URL(normalized);
    if (!url.password) {
      url.password = "localdev";
    }
    const out = url.toString().replace(/^https:\/\//, "postgresql://");
    return out;
  } catch {
    const match = trimmed.match(/^(postgres(?:ql)?):\/\/([^/]+)@/i);
    if (!match) return trimmed;
    const [, scheme, auth] = match;
    if (auth.includes(":") && !auth.endsWith(":")) return trimmed;
    const user = auth.replace(/:$/, "");
    return trimmed.replace(
      /^(postgres(?:ql)?):\/\/([^/]+)@/i,
      `${scheme.toLowerCase()}://${user}:localdev@`,
    );
  }
}

if (!process.env[hyperdriveLocalKey]?.trim()) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl) {
    process.env[hyperdriveLocalKey] =
      hyperdriveLocalConnectionString(databaseUrl);
  }
} else {
  process.env[hyperdriveLocalKey] = hyperdriveLocalConnectionString(
    process.env[hyperdriveLocalKey],
  );
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
