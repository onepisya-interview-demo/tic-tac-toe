#!/usr/bin/env node
// L2-7 批量清理入口守卫（注释分诊 rollout M4'，2026-10-25 入档）
// 真源链：docs/anti-patterns.md L2-7 机制注；方案 .omo/plans/comment-triage-practice-v2-20261024.md §3.2 M4'；
// 台账 .omo/plans/comment-triage-rollout-20261025.md §三。
//
// 用法：
//   node scripts/batch-clean-guard.mjs --check
//       断言 tracked 工作区干净（git status --porcelain无非 ?? 条目），脏则
//       逐条列出并 exit 1。批量清理/迁移/deslop 脚本入口必须先过这一步——
//       tracked 变更先 commit（git 通道），untracked 不拦（走备份面）。
//   node scripts/batch-clean-guard.mjs --backup <label> [-- <path>...]
//       先同样断言 tracked 干净，再把待删的 untracked/ignored 路径打包到
//       .omo/backups/<timestamp>-<label>.tar（恢复＝tar 解包；系 git 通道外
//       兜底，沿用 .omx/backups 路径习惯）。不带路径时打包全部 untracked
//       （git ls-files --others --exclude-standard）；ignored 内容只在显式
//       传路径时入包（防误吞 node_modules）。
//
// 「拦得住」边界（L2-7 机制注原文收窄）：守卫只防自觉经脚本入口的批量操作；
// 2026-09-12 式未知进程按清单删除不经任何入口（L2-8：reflog/index 零记录），
// 守卫对其零约束。清理役 SOP：动手前与收口后各跑一次 node scripts/verify-all.mjs。

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trimEnd();
}

// tracked 脏项＝porcelain 里两条状态码非 "??" 的条目（?? = untracked，允许——
// 它们是备份面对象，不是 git 通道对象）。
export function trackedDirtyEntries() {
  return git("status", "--porcelain")
    .split("\n")
    .filter(Boolean)
    .filter((line) => !line.startsWith("??"));
}

// 入口断言：tracked 不干净即拒绝运行（exit 1）。编程式调用方（批量脚本
// import 本模块）与 CLI 走同一实现，无第二套判据。
export function assertGitClean() {
  const dirty = trackedDirtyEntries();
  if (dirty.length > 0) {
    console.error("batch-clean-guard: tracked tree is dirty - commit or stash first (L2-7 git 通道):");
    for (const line of dirty) console.error(`  ${line}`);
    process.exit(1);
  }
}

// 备份约定：.omo/backups/<timestamp>-<label>.tar；timestamp 取本地时刻
// YYYYMMDD-HHMMSS。恢复＝tar 解包（git 通道外兜底，不进 git 历史）。
export function backupPaths(label, paths) {
  if (!/^[\w.-]+$/.test(label)) {
    console.error(`batch-clean-guard: label must match [A-Za-z0-9._-]+ (got "${label}")`);
    process.exit(1);
  }
  assertGitClean();
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const backupDir = path.join(process.cwd(), ".omo", "backups");
  const tarPath = path.join(backupDir, `${ts}-${label}.tar`);
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });
  execFileSync("tar", ["-cf", tarPath, ...paths], { stdio: "inherit" });
  console.log(`batch-clean-guard: backup written: ${tarPath} (${paths.length} path(s)); 恢复＝tar 解包`);
  return tarPath;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--check") {
    assertGitClean();
    console.log("batch-clean-guard: tracked tree clean (untracked allowed - back them up before deleting)");
    process.exit(0);
  }
  if (argv[0] === "--backup") {
    const label = argv[1];
    if (!label) {
      console.error("batch-clean-guard: --backup requires a <label>");
      process.exit(1);
    }
    const dd = argv.indexOf("--");
    const paths =
      dd === -1
        ? git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean)
        : argv.slice(dd + 1);
    if (paths.length === 0) {
      console.error("batch-clean-guard: nothing to back up (no paths given and no untracked files)");
      process.exit(1);
    }
    backupPaths(label, paths);
    process.exit(0);
  }
  console.error("usage: node scripts/batch-clean-guard.mjs --check | --backup <label> [-- <path>...]");
  process.exit(1);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
