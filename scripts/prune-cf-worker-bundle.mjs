/**
 * Remove Prisma native engines and other artifacts that blow the Workers 10 MiB limit.
 * Run after `opennextjs-cloudflare build` (see package.json `cf:build`).
 */
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

const bundleRoot = ".open-next/server-functions/default";

const PRUNE_NAME =
  /(?:libquery_engine-|query_engine_bg\.(?:mysql|sqlite)\.wasm$|capsize-font-metrics\.json$)/;

function walk(dir, onFile) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walk(full, onFile);
    else onFile(full);
  }
}

if (!statSync(bundleRoot, { throwIfNoEntry: false })?.isDirectory()) {
  console.error(`Missing ${bundleRoot} — run opennextjs-cloudflare build first.`);
  process.exit(1);
}

let pruned = 0;
walk(bundleRoot, (file) => {
  const base = file.split("/").pop() ?? file;
  if (!PRUNE_NAME.test(base)) return;
  rmSync(file, { force: true });
  pruned += 1;
  console.log(`pruned ${file}`);
});

console.log(`Pruned ${pruned} file(s) from Cloudflare worker bundle.`);
