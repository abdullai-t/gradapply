#!/usr/bin/env node
/**
 * Copies build.json "version" into package.json.
 * Run after bumping build.json: pnpm version:sync
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildPath = path.join(root, "build.json");
const pkgPath = path.join(root, "package.json");

const build = JSON.parse(readFileSync(buildPath, "utf8"));
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

if (!build.version || typeof build.version !== "string") {
  console.error("build.json must include a string \"version\" field.");
  process.exit(1);
}

if (pkg.version === build.version) {
  console.log(`package.json already at ${build.version}`);
  process.exit(0);
}

pkg.version = build.version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`Updated package.json version → ${build.version}`);
