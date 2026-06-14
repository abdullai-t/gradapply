#!/usr/bin/env node
/**
 * Verify FIREBASE_SERVICE_ACCOUNT_JSON (or discrete FIREBASE_* vars) in .env.
 * Does not print secrets — only project_id and client_email on success.
 *
 * Usage: pnpm run verify:firebase-sa
 */
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

function detectMultilineServiceAccountInEnv() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return null;
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  const start = lines.findIndex((l) =>
    l.trimStart().startsWith("FIREBASE_SERVICE_ACCOUNT_JSON="),
  );
  if (start === -1) return null;
  const valuePart = lines[start].slice(lines[start].indexOf("=") + 1).trim();
  if (valuePart.length <= 2 && valuePart.startsWith("{")) {
    return { line: start + 1, hint: "only `{` on the first line" };
  }
  if (valuePart.startsWith("{") && !valuePart.endsWith("}")) {
    return { line: start + 1, hint: "JSON spans multiple lines" };
  }
  if (
    (valuePart.startsWith("'") && !valuePart.endsWith("'")) ||
    (valuePart.startsWith('"') && !valuePart.endsWith('"'))
  ) {
    return { line: start + 1, hint: "opening quote without closing quote on same line" };
  }
  return null;
}

loadEnvFile(path.join(root, ".env"));
loadEnvFile(path.join(root, ".env.local"));

function parseServiceAccount() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const sa = JSON.parse(json);
      if (!sa.project_id?.trim()) {
        return { error: "JSON missing project_id" };
      }
      if (!sa.client_email?.trim()) {
        return { error: "JSON missing client_email" };
      }
      if (!sa.private_key?.includes("BEGIN PRIVATE KEY")) {
        return { error: "JSON missing valid private_key" };
      }
      return {
        projectId: sa.project_id.trim(),
        clientEmail: sa.client_email.trim(),
        source: "FIREBASE_SERVICE_ACCOUNT_JSON",
      };
    } catch (e) {
      const multiline = detectMultilineServiceAccountInEnv();
      let error = `JSON parse failed: ${e instanceof Error ? e.message : String(e)}`;
      if (multiline) {
        error += `\n\nLikely cause: .env line ${multiline.line} — ${multiline.hint}.`;
        error +=
          "\n.env only reads ONE line per variable. Use a single-line value:\n";
        error +=
          "  pnpm run format:firebase-sa -- --write-env ~/Downloads/your-firebase-key.json";
      }
      return { error };
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (!projectId && !clientEmail && !privateKey) {
    return {
      error:
        "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in .env",
    };
  }

  if (!projectId || !clientEmail || !privateKey?.includes("BEGIN PRIVATE KEY")) {
    return {
      error:
        "Discrete vars incomplete — need FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY",
    };
  }

  return {
    projectId,
    clientEmail,
    source: "FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY",
  };
}

const result = parseServiceAccount();

if ("error" in result) {
  console.error(`FAIL: ${result.error}`);
  process.exit(1);
}

console.log("OK: Firebase service account configured");
console.log(`  source: ${result.source}`);
console.log(`  project_id: ${result.projectId}`);
console.log(`  client_email: ${result.clientEmail}`);

const publicProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
if (publicProject && publicProject !== result.projectId) {
  console.warn(
    `WARN: NEXT_PUBLIC_FIREBASE_PROJECT_ID (${publicProject}) differs from service account project_id`,
  );
} else if (publicProject) {
  console.log("OK: matches NEXT_PUBLIC_FIREBASE_PROJECT_ID");
} else {
  console.warn("WARN: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set (client auth may fail)");
}

const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY?.trim();
const sender = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim();
if (vapid && sender) {
  console.log("OK: FCM web push client vars present (VAPID + sender ID)");
} else {
  console.warn(
    "WARN: NEXT_PUBLIC_FIREBASE_VAPID_KEY and/or NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID missing (push registration will not work)",
  );
}

process.exit(0);
