import path from "node:path";

import { defineConfig } from "vitest/config";

// App code reads DATABASE_URL; db tests use DATABASE_URL_TEST (same DB).
if (process.env.DATABASE_URL_TEST?.trim()) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST.trim();
}

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["tests/setup.db.ts"],
    globalSetup: ["tests/db-global-setup.ts"],
    include: ["tests/integration/**/*.db.test.ts"],
    exclude: ["node_modules/**"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
