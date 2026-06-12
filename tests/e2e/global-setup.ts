import { execSync } from "node:child_process";

export default async function globalSetup() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.warn("E2E global-setup: DATABASE_URL not set — skipping DB seed");
    return;
  }
  execSync("pnpm exec tsx tests/scripts/seed-e2e.ts", {
    stdio: "inherit",
    env: process.env,
  });
}
