#!/usr/bin/env node
/**
 * Format a Firebase service-account JSON file as a single .env line.
 *
 * Usage:
 *   pnpm run format:firebase-sa -- ~/Downloads/your-project-firebase-adminsdk.json
 *   pnpm run format:firebase-sa -- --write-env ~/Downloads/your-project-firebase-adminsdk.json
 *
 * --write-env  Replace multiline/broken FIREBASE_SERVICE_ACCOUNT_JSON in .env
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const writeEnv = args.includes("--write-env");
const jsonPath = args.find((a) => !a.startsWith("--"));

if (!jsonPath) {
  console.error(
    "Usage: pnpm run format:firebase-sa -- [--write-env] <path-to-service-account.json>",
  );
  process.exit(1);
}

const resolved = path.resolve(jsonPath);
if (!fs.existsSync(resolved)) {
  console.error(`File not found: ${resolved}`);
  process.exit(1);
}

let sa;
try {
  sa = JSON.parse(fs.readFileSync(resolved, "utf8"));
} catch (e) {
  console.error(
    `Invalid JSON file: ${e instanceof Error ? e.message : String(e)}`,
  );
  process.exit(1);
}

if (!sa.project_id || !sa.client_email || !sa.private_key) {
  console.error("File does not look like a Firebase service account JSON.");
  process.exit(1);
}

const oneLine = JSON.stringify(sa);
const envLine = `FIREBASE_SERVICE_ACCOUNT_JSON='${oneLine}'`;

function findServiceAccountBlock(lines) {
  const start = lines.findIndex((l) =>
    l.trimStart().startsWith("FIREBASE_SERVICE_ACCOUNT_JSON="),
  );
  if (start === -1) return null;

  const valuePart = lines[start].slice(lines[start].indexOf("=") + 1).trim();
  const looksMultiline =
    valuePart === "{" ||
    (valuePart.startsWith("{") && !valuePart.endsWith("}")) ||
    (valuePart.startsWith("'") && !valuePart.endsWith("'")) ||
    (valuePart.startsWith('"') && !valuePart.endsWith('"'));

  if (!looksMultiline) {
    return { start, end: start };
  }

  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t === "}" || t === "}'" || t === '}"' || t.endsWith("}")) {
      return { start, end: i };
    }
    if (/^[A-Z][A-Z0-9_]*=/.test(t) || t.startsWith("# ---")) {
      return { start, end: i - 1 };
    }
  }
  return { start, end: lines.length - 1 };
}

if (writeEnv) {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) {
    console.error("No .env file found. Create one from .env.example first.");
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  const block = findServiceAccountBlock(lines);
  if (block) {
    lines.splice(block.start, block.end - block.start + 1, envLine);
  } else {
    lines.push(envLine);
  }
  fs.writeFileSync(envPath, lines.join("\n"));
  console.log("Updated .env with a single-line FIREBASE_SERVICE_ACCOUNT_JSON");
  console.log(`  project_id: ${sa.project_id}`);
  console.log(`  client_email: ${sa.client_email}`);
  console.log("\nRun: pnpm run verify:firebase-sa");
} else {
  console.log(
    "Paste this ONE line into .env (remove any multiline FIREBASE_SERVICE_ACCOUNT_JSON block first):\n",
  );
  console.log(envLine);
  console.log(
    "\nOr auto-fix .env:\n  pnpm run format:firebase-sa -- --write-env",
    resolved,
  );
}
