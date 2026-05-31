#!/usr/bin/env node
/**
 * Ensures package.json version matches build.json (source of truth).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = JSON.parse(
  readFileSync(path.join(root, "build.json"), "utf8"),
);
const pkg = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);

if (build.version !== pkg.version) {
  console.error(
    `Version mismatch: build.json=${build.version} package.json=${pkg.version}\n` +
      "Bump build.json, then run: pnpm version:sync",
  );
  process.exit(1);
}

if (!build.buildNotes?.trim()) {
  console.error("build.json buildNotes is empty. Add release notes before pushing.");
  process.exit(1);
}

console.log(`Version OK: ${build.version}`);
