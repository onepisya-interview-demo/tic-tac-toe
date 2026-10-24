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
    // Stray worktree sandboxes from `git worktree add` + heavy meta
    // tools live here. Without this, eslint surfaces dozens of
    // stale warnings that block the 0-warnings gate (V4 F8).
    ".delta/**",
    // Probe / archival sandboxes for run evidence + per-wave probe
    // scripts. Mirrors the F8 rationale — these are scratch content
    // never shipped, and a stale unused-variable warning in one of
    // them blocks the 0-warnings gate.
    ".omx/**",
    "reports/**",
    // Dynamic-workflow run artifacts, gitignored (/.zcode at
    // .gitignore:135). Same scratch family as .delta/.omx — the
    // HomeDialog wave (19 findings) and the 10-01 re-verification
    // (42 problems) all landed here, blocking the 0-warnings gate.
    ".zcode/**",
    // Playwright QA scripts (plain JS, not part of app source):
    "tests/qa/**",
    // Archival run evidence (probe scripts incl. CommonJS; never shipped):
    ".omo/evidence/**",
  ]),
]);

export default eslintConfig;
