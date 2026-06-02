#!/usr/bin/env node
/**
 * Injects Cloudflare Hyperdrive binding into wrangler.jsonc when HYPERDRIVE_CONFIG_ID is set.
 * Run before `wrangler deploy` (see package.json `cf:deploy`).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wranglerPath = path.join(root, "wrangler.jsonc");
const id = process.env.HYPERDRIVE_CONFIG_ID?.trim();

let content = fs.readFileSync(wranglerPath, "utf8");

const hyperdriveLine =
  `    "hyperdrive": [{ "binding": "HYPERDRIVE", "id": "${id}" }],`;

const commentedPattern =
  /\/\/\s*"hyperdrive":\s*\[\{\s*"binding":\s*"HYPERDRIVE",\s*"id":\s*"<hyperdrive-config-id>"\s*\}\],?\s*\n/;

if (id) {
  if (commentedPattern.test(content)) {
    content = content.replace(commentedPattern, `${hyperdriveLine}\n`);
  } else if (/"hyperdrive":\s*\[/.test(content)) {
    content = content.replace(
      /"hyperdrive":\s*\[[^\]]*\],?\s*\n/,
      `${hyperdriveLine}\n`,
    );
  } else {
    content = content.replace(
      /"vars":\s*\{[^}]*\},/,
      (match) => `${match}\n${hyperdriveLine}`,
    );
  }
  fs.writeFileSync(wranglerPath, content);
  console.log(`[wrangler] Hyperdrive binding set (id=${id.slice(0, 8)}…).`);
} else {
  console.warn(
    "[wrangler] HYPERDRIVE_CONFIG_ID is not set — deploy will use DATABASE_URL over the public internet (slow on Workers).",
  );
  console.warn(
    "  Create Hyperdrive in the Cloudflare dashboard and export HYPERDRIVE_CONFIG_ID before cf:deploy.",
  );
}
