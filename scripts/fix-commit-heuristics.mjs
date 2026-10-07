#!/usr/bin/env node
// fix-commit-heuristics — 轻量启发检查（票 16，docs/commit-policy.md §提交序列规范）。
//
// 「失败测试在前」提交序列的启发式验证：每个 fix 类型提交应携带测试证据——
//   PASS(test-in-commit) : 本 commit diff 触及测试文件（*.test.ts/tsx/mjs 或 tests/qa/*）
//   PASS(test-in-parent) : 父提交是 test 类型且其 diff 触及测试文件（两段式：红测试在前）
//   NOTE(no-test-evidence): 两者皆无——提示补测试证据，非门禁
//
// 默认提示模式 exit 0（逐 commit 输出行 + 汇总）；--strict 下任何 NOTE 变 exit 1。
// 启发式是「检查」不是「拦截」：docs.commit-policy 定义规范本体，本脚本只做对账。
//
// Usage:
//   node scripts/fix-commit-heuristics.mjs [--range <git-ref>] [--strict]
//     --range 默认 origin/main（全 main 史）；任意 git ref 表达式（同 commit-audit --range）。

import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
let range = "origin/main";
let strict = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--range") range = args[++i];
  else if (args[i] === "--strict") strict = true;
}

const TEST_FILE_RE = /(\.test\.(ts|tsx|mjs)$|^tests\/qa\/[a-z0-9/-]+\.mjs$)/;
const FIX_RE = /^fix(\([^)]+\))?!?: /;
const TEST_TYPE_RE = /^(test|chore\(test\))(\([^)]+\))?!?: /;

function git(...a) {
  return execFileSync("git", a, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function filesOf(sha) {
  return git("show", "--name-only", "--format=", sha).split("\n").filter(Boolean);
}

const shas = git("log", "--reverse", "--format=%H", range).split("\n").filter(Boolean);
let pass = 0;
let notes = 0;
const noteLines = [];
for (const sha of shas) {
  const subject = git("log", "-1", "--format=%s", sha);
  if (!FIX_RE.test(subject)) continue;
  const files = filesOf(sha);
  if (files.some((f) => TEST_FILE_RE.test(f))) {
    pass++;
    console.log(`PASS(test-in-commit) ${sha.slice(0, 8)}  ${subject}`);
    continue;
  }
  const parent = git("rev-parse", `${sha}^`).trim();
  const parentSubject = git("log", "-1", "--format=%s", parent);
  if (TEST_TYPE_RE.test(parentSubject) && filesOf(parent).some((f) => TEST_FILE_RE.test(f))) {
    pass++;
    console.log(`PASS(test-in-parent) ${sha.slice(0, 8)}  ${subject}`);
    continue;
  }
  notes++;
  noteLines.push(`NOTE(no-test-evidence) ${sha.slice(0, 8)}  ${subject}`);
  console.log(noteLines[noteLines.length - 1]);
}

console.log("");
console.log(
  `fix-commit-heuristics ref=${range} fix-commits=${pass + notes} pass=${pass} note=${notes}` +
    (strict ? " strict=true" : " strict=false"),
);
if (strict && notes > 0) process.exit(1);
process.exit(0);
