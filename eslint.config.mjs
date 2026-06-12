import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  globalIgnores([
    ".next/**",
    ".open-next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "design-system/**",
  ]),
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Next 16 enables React Compiler hook rules; off until codebase is migrated.
    rules: {
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
