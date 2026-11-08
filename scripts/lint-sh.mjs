#!/usr/bin/env node
// shellcheck 薄 runner（sh 门禁波 2026-11-09，台账 .omo/plans/sh-gate-wave-20261109.md）。
// 枚举 git tracked 的 *.sh 逐个送 shellcheck；gcc 输出格式自带 SC 码与 file:line。
// 零 .sh 文件时 exit 0（空扫描面不是失败）；shellcheck 工具级故障（exit > 1）
// 与脚本告警（exit 1）都算 FAIL，fail closed。

import { execFileSync, spawnSync } from "node:child_process";

const files = execFileSync("git", ["ls-files", "--", "*.sh"], { encoding: "utf8" })
  .split("\n")
  .map((s) => s.trim())
  .filter((f) => f.length > 0 && f.endsWith(".sh"));

if (files.length === 0) {
  console.log("lint:sh  0 tracked *.sh files — nothing to check");
  process.exit(0);
}

let failedFiles = 0;
for (const file of files) {
  const r = spawnSync("pnpm", ["exec", "shellcheck", "--format=gcc", "--", file], {
    encoding: "utf8",
  });
  if (r.status === 0) continue;
  failedFiles += 1;
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== null && r.status > 1) {
    console.error(`lint:sh  ${file}: shellcheck tool failure (exit ${r.status}), not a script finding`);
  }
}

const verdict = failedFiles === 0 ? "PASS" : "FAIL";
console.log(`lint:sh  shellcheck ${verdict}  files=${files.length} files-with-findings=${failedFiles}`);
process.exit(failedFiles === 0 ? 0 : 1);
