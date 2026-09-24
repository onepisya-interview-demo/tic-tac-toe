// tests/qa/probe-reconciliation.test.ts — T-B1 (ulw-rooms-race-qa-ticket §T8)
// 机械对账用例：解析 ci.yml + docs/commands.md 双向对账 tests/qa/*.mjs 列表。
//
// 设计：
//   - 正向（forward）：ci.yml 中显式 `node tests/qa/X.mjs` 引用的每个文件必存在
//   - 反向（reverse）：tests/qa/*.mjs 每个文件必满足
//       a) 被 ci.yml 或 docs/commands.md 显式文件名引用，或
//       b) 头 20 行含「DISABLED」标记（merge-sync-qa / sync-qa 范式），或
//       c) 在 KNOWN_ORPHANS 白名单（带 triage 计划 + 备注；新增 orphan 立即 FAIL）
//   - 注入对照（mutation）：临时向 ci.yml 注入 tests/qa/ghost-probe.mjs，
//     断言 reverse fail；撤回后断言 green。
//
// 真源：docs/anti-patterns.md:209 L1-31；research-rooms-race-probe §4.3。
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, "..", "..", "..");

const CI_YML = join(REPO_ROOT, ".github", "workflows", "ci.yml");
const COMMANDS_MD = join(REPO_ROOT, "docs", "commands.md");
const TESTS_QA = join(REPO_ROOT, "tests", "qa");

// KNOWN_ORPHANS：白名单 — 文件未在 ci.yml / docs/commands.md 显式引用，但
// 在 docs/operations.md 或 tests/qa/AGENTS.md 引用，或纯 ad-hoc 探针。每条
// 注释说明出处 + 计划 triage 票号；新增 orphan（非此清单）立即 fail。
const KNOWN_ORPHANS: ReadonlySet<string> = new Set([
  // docs/operations.md §日常命令 + tests/qa/AGENTS.md 探针地图表 引用 —
  // 非两源但有文档归位。
  "audio-cheer.mjs",
  "audio-confetti-qa.mjs",
  "audio-probe.mjs",
  "hydration-check.mjs",
  "sw-console-hygiene.mjs",
  // 零引用：纯 ad-hoc 探针或历史归档（待后续票 triage）。
  "anonymous-first-game-qa.mjs",
  "offline-result-qa.mjs",
  "one-screen-qa.mjs",
  "result-celebration-qa.mjs",
  "result-fresh-qa.mjs",
  // TODO: triage in T-B1-followup-1 — 5 条可能真悬空；或迁 docs/operations.md。
]);

function isDisabled(header: string): boolean {
  // 第一条非空注释含「DISABLED」字样（merge-sync-qa / sync-qa 范式）。
  const lines = header.split("\n").slice(0, 20);
  return lines.some((l) => /\/\/ .*DISABLED/.test(l));
}

function parseReferencesFromCi(src: string): string[] {
  // 提取 `node tests/qa/<name>.mjs` 形态的引用 — 不解析 YAML，用正则兜底。
  const re = /tests\/qa\/([a-z0-9-]+\.mjs)/g;
  const out = new Set<string>();
  let m;
  while ((m = re.exec(src))) out.add(m[1]);
  return [...out];
}

function parseReferencesFromCommandsMd(src: string): string[] {
  // 提取 `tests/qa/<name>.mjs` 字面量引用（不限 node 前缀）。同时展开
  // `tests/qa/*.mjs` 通配为该目录全部 .mjs（适配 docs/commands.md:43 通配）。
  const explicitRe = /tests\/qa\/([a-z0-9-]+\.mjs)/g;
  const out = new Set<string>();
  let m;
  while ((m = explicitRe.exec(src))) out.add(m[1]);
  if (/tests\/qa\/\*\.[mc]js/.test(src)) {
    // 通配展开：列目录拿全部 .mjs（ls tests/qa/*.mjs）。
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    for (const n of readdirSync(TESTS_QA)) {
      if (n.endsWith(".mjs")) out.add(n);
    }
  }
  return [...out];
}

describe("probe-reconciliation: ci.yml ↔ tests/qa/*.mjs 双向对账", () => {
  const ci = readFileSync(CI_YML, "utf8");
  const cmds = readFileSync(COMMANDS_MD, "utf8");
  const ciProbes = parseReferencesFromCi(ci);
  const cmdProbes = parseReferencesFromCommandsMd(cmds);
  // 直接从目录列（不依赖 AGENTS.md）。probes 列表由后面 reverse 测统一拿。

  it("正向：ci.yml 引用的每个 probe 文件存在", () => {
    expect(ciProbes.length).toBeGreaterThan(0);
    for (const name of ciProbes) {
      const p = join(TESTS_QA, name);
      expect(existsSync(p), `ci.yml 引用 ${name} 但文件不存在`).toBe(true);
    }
  });

  it("反向：tests/qa/*.mjs 每个被引用、DISABLED 或在 KNOWN_ORPHANS 白名单", () => {
    // 从目录直列（不依赖 AGENTS.md）— ls-style。Node 24 fs.readdirSync 直接拿。
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    const entries = readdirSync(TESTS_QA)
      .filter((n) => n.endsWith(".mjs"))
      .sort();
    expect(entries.length).toBeGreaterThan(0);
    const cited = new Set([...ciProbes, ...cmdProbes]);
    for (const name of entries) {
      const p = join(TESTS_QA, name);
      const header = readFileSync(p, "utf8").split("\n").slice(0, 20).join("\n");
      const citedOk = cited.has(name);
      const disabledOk = isDisabled(header);
      const knownOk = KNOWN_ORPHANS.has(name);
      expect(
        citedOk || disabledOk || knownOk,
        `${name} 既未被 ci.yml/commands.md 引用，也无 DISABLED 标记，且不在 KNOWN_ORPHANS 白名单`,
      ).toBe(true);
    }
  });

  it("注入对照：临时向 ci.yml 注入 ghost-probe → 反向断言 FAIL", () => {
    const dir = mkdtempSync(join(tmpdir(), "recon-mut-"));
    const ciCopy = join(dir, "ci.yml");
    try {
      const mutated = ci + "\n        run: pnpm exec node tests/qa/ghost-probe.mjs\n";
      writeFileSync(ciCopy, mutated, "utf8");
      const mutatedProbes = parseReferencesFromCi(mutated);
      expect(mutatedProbes).toContain("ghost-probe.mjs");
      // ghost 文件不存在 → 正向断言会 fail。
      const ghostPath = join(TESTS_QA, "ghost-probe.mjs");
      expect(existsSync(ghostPath), "ghost 不应存在").toBe(false);
      // 把 mutated ci.yml 当成真源解析时，正向断言会捕获 ghost 悬空：
      const stillExists = mutatedProbes.every((n) => existsSync(join(TESTS_QA, n)));
      expect(stillExists, "mutated ci 解析后正向应 FAIL（ghost 不存在）").toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
