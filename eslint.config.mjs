import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // 注释分诊 M2（2026-10-25 入档）：行首 TODO/FIXME/XXX 术语零容忍，级别取
    // error 与本仓 0-warning 门禁一致。location 固定 "start"——只认注释文本
    // 起始的术语：块注释内部中段的 TODO（如 lib/store.ts makeMove JSDoc 块内
    // 的 W2 seam 说明，块文本以 "Apply a move" 起始）不计，存量零误报已实测
    // （台账 .omo/plans/comment-triage-rollout-20261025.md §三）。tests/qa
    // 子树对 eslint 不可见（下方 globalIgnores），该面的抑制扫描由
    // commit-audit R8-B3 承担。
    rules: {
      "no-warning-comments": ["error", { terms: ["todo", "fixme", "xxx"], location: "start" }],
    },
  },
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
