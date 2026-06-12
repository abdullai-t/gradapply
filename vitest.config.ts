import path from "node:path";

import { defineConfig } from "vitest/config";

import { coverageInclude } from "./vitest.coverage-scope";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["tests/setup.ts"],
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: [
      "tests/e2e/**",
      "tests/**/*.db.test.ts",
      "node_modules/**",
    ],
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: [...coverageInclude],
      reporter: ["text", "text-summary", "lcov"],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 70,
        functions: 75,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
