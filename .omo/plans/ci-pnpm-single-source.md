# Plan: CI pnpm 版本双源冲突修复（ci-pnpm-single-source）

- 日期：2026-09-13
- 状态：已实现（42569b4 2026-09-13 ci 删 ci.yml 显式 version，计划与实现同一提交；状态线 2026-09-26 按 git 实况修正）
- 触发：开源发布后 main 分支 CI 首跑即红（run 34763250227）

## 1. 现象

GitHub Actions 全部 5 个 job（lint/typecheck/test/build/visual-qa）在
`pnpm/action-setup@v4` 步骤 6s 内失败：

```
Error: Multiple versions of pnpm specified:
  - version 10 in the GitHub Action config with the key "version"
  - version pnpm@10.10.0 in the package.json with the key "packageManager"
```

## 2. 根因

`.github/workflows/ci.yml` 五个 job 均硬编码 `with: version: 10`，
而 `package.json` 已有 `"packageManager": "pnpm@10.10.0"`。
pnpm/action-setup@v4 设计：两处同时声明即视为版本冲突，直接报错（防止
ERR_PNPM_BAD_PM_VERSION 漂移）。

本地从未暴露：本地跑 pnpm 直接读 packageManager 字段，不经该 action。

## 3. 修法

删除 ci.yml 全部 5 处 `with:\n  version: 10` 块，令 action 以
`packageManager` 字段为唯一版本真源（官方推荐做法）。

## 4. 验收标准

- AC1: `grep -c "version: 10" .github/workflows/ci.yml` = 0
- AC2: 六层门禁本地全绿（vitest/typecheck/lint/build/audit --branch main 0 violations）
- AC3: push 后 main CI run 全 job 绿
- AC4: 4 个 Dependabot PR rebase 后 CI 可转绿（留给后续决策，不在本刀范围）

## 5. 边界

- 不动 Dependabot PR（升级 actions 版本是另一刀，合并策略待主公裁定）
- 不动 packageManager 字段
