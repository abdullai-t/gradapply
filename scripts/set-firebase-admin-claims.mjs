#!/usr/bin/env node
/**
 * Set Firebase custom claims for an admin user (run locally with service account env).
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_JSON='...' node scripts/set-firebase-admin-claims.mjs user@example.com ADMIN
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const email = process.argv[2]?.trim().toLowerCase();
const role = (process.argv[3] ?? "ADMIN").trim().toUpperCase();

if (!email || !["ADMIN", "SUPERADMIN"].includes(role)) {
  console.error(
    "Usage: node scripts/set-firebase-admin-claims.mjs <email> [ADMIN|SUPERADMIN]",
  );
  process.exit(1);
}

const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
if (!json) {
  console.error("Set FIREBASE_SERVICE_ACCOUNT_JSON");
  process.exit(1);
}

const sa = JSON.parse(json);
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: sa.project_id,
      clientEmail: sa.client_email,
      privateKey: sa.private_key,
    }),
  });
}

const auth = getAuth();
const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { role, admin: true });
console.log(`Set custom claims for ${email} (${user.uid}): role=${role}`);
console.log("User must sign out and sign in again for claims to apply.");
