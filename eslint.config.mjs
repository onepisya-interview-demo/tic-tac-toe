import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test artifacts and generated code:
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".vitest-tmp/**",
    // Stryker sandbox + reports (transitive node_modules tests get scanned otherwise):
    ".stryker-tmp/**",
    "reports/**",
    // Playwright QA scripts (plain JS, not part of app source):
    "tests/qa/**",
    // Archival run evidence (probe scripts incl. CommonJS; never shipped):
    ".omo/evidence/**",
  ]),
]);

export default eslintConfig;
