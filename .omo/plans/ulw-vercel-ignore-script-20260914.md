# Plan: ulw-vercel-ignore-script-20260914 · ignoreCommand 外置脚本

- 日期：2026-09-14
- ulw-loop：`.omo/ulw-loop/ulw-vercel-ignore-script-20260914/`
- 前批：84091bd fix(deploy): ignoreCommand 增核心文件过滤（inline regex）

## 目标

把 `vercel.json` 内联 130+ 字符的 shell regex 外置到 `scripts/vercel-ignore-build.sh` —— langfuse/propeldata/rionlabs 业界模式。vercel.json 简化为一行引用。脚本可单测、可注释、可扩展。配套 docs/agent-workflow.md 增「核心目录约定」节。

## 改动

### 新增 `scripts/vercel-ignore-build.sh`

```bash
#!/usr/bin/env bash
# Vercel Ignored Build Step
#
# Vercel exit code semantics:
#   exit 0 = cancel deployment
#   exit 1 = proceed with build
#
# Logic (3 rules, first match wins):
#   1. docs commit (subject starts with `docs(` or `docs:`) → cancel
#   2. commit changed any core file (app/, public/, lib/, components/, db/,
#      package.json, next.config) → proceed
#   3. otherwise → cancel
#
# Add new core directories: extend CORE_PATH_RE below + commit.
# This file is the single source of truth for Vercel build triggers.

set -euo pipefail

# Pattern matching docs( or docs: at start of subject (Conventional Commits docs convention)
DOCS_PATTERN='^docs[(:]'

# Paths that, if changed, require a rebuild. Both root-level and src/-prefixed
# Next.js layouts are supported.
CORE_PATH_RE='^(app|src/app|pages|src/pages|public|src/public|components|src/components|lib|src/lib|db|src/db|styles|src/styles)/|^(middleware\.ts|middleware\.js)$|^package\.json$|^next\.config(\.[a-z]+)?$|^tsconfig\.json$'

subject=$(git log -1 --pretty=%s)

# Rule 1: docs commit → cancel
if printf '%s' "$subject" | grep -qE "$DOCS_PATTERN"; then
  exit 0
fi

# Rule 2: core path changed → proceed
if git diff --name-only HEAD~1 HEAD | grep -qE "$CORE_PATH_RE"; then
  exit 1
fi

# Rule 3: otherwise → cancel
exit 0
```

### 修改 `vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "ignoreCommand": "bash scripts/vercel-ignore-build.sh"
}
```

### 新增 `scripts/vercel-ignore-build.test.sh`

Bash 测试套，验证 13 commit × exit code 矩阵：
- 13 commit 各 replay HEAD 至该 commit 后跑脚本 → 断言 exit code 与预期
- 表驱动，类似吾前已跑之 python 实证

### 修改 `docs/agent-workflow.md`

增「核心目录约定」节——明示：
- `scripts/vercel-ignore-build.sh` 是 Vercel build 决策 single source of truth
- 新增核心目录（如 `src/`, `components/`, `lib/` 等）必须同步更新脚本 `CORE_PATH_RE`
- CI 不强制校验（依赖 commit-audit + review）；commit 必含提及此改动的「Constraint / Rejected」

## 验收标准

- AC1: scripts/vercel-ignore-build.sh 可读、可单测、可维护
- AC2: vercel.json 仅 1 行 ignoreCommand 引用
- AC3: scripts/vercel-ignore-build.test.sh 全过（13 commit × exit code 矩阵）
- AC4: 六门（vitest/typecheck/lint/build/commit-audit/yaml）全绿
- AC5: docs/agent-workflow.md 增「核心目录约定」节
- AC6: 1 commit 攒批（不 push）

## 边界

- 不改 CORE_PATH_RE（与前批 inline regex 行为一致）
- 不动其他 workflow / ruleset
- 不动 lib/app/components/db/stores
- 零新依赖（bash + grep + git stdlib）

## 风险

- 脚本权限：Vercel build env 必须可执行脚本——bash scripts/vercel-ignore-build.sh 不需执行位（直接 bash）
- 跨平台：grep -E 在 Vercel build env (Linux) 行为一致

## 文件清单

| 文件 | 状态 |
|---|---|
| `scripts/vercel-ignore-build.sh` | new |
| `scripts/vercel-ignore-build.test.sh` | new |
| `vercel.json` | modify |
| `docs/agent-workflow.md` | modify |