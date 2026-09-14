# Agent 工作流协议（PR 路径守则）

> 立档 2026-09-14 · 决策依据：主公与调度者共识——严守 GitHub ruleset `main-gate`

## 决策

agent 自身攒批后**走 PR + squash merge**（不再 direct push 到 `main`），与 `main-gate` ruleset 完全契合。

## 分工（合作者关系）

| 步骤 | 承担 | 备注 |
|---|---|---|
| 攒批 commit / 写 PR description | **agent** | ahead N commit，lore trailer 整合入 PR body |
| `git push -u origin <feat-branch>` | **主公**（人工） | pi/bash wrapper 拦下所有 `git push`；agent 不擅 push |
| `gh pr create --base main --head <feat-branch>` | **agent** | gh CLI 不走 git push，可由 agent 执行 |
| 等 CI 5 check 跑 | **自动** | 拉 `gh pr checks --watch` |
| Review / Approve | **主公**（admin self-approve，CODEOWNERS `@onepisya` 唯一）| `gh pr review --approve` 或网页端 |
| Squash merge | **主公**（人工） | ruleset `allowed_merge_methods = ["squash"]` |
| Cleanup：`git checkout main && git pull --ff-only` | **agent** | 同步 main |
| 删除 feat branch | **squash merge 自带**（`--delete-branch`）| 自动 |

## 协议（完整流）

```
agent：ahead N commit 攒批
  ↓
git checkout -b feat/<slug>
  ↓
主公：git push -u origin feat/<slug>
  ↓
agent：gh pr create --base main --head feat/<slug> \
        --title "<conventional subject>" \
        --body "<PR description = lore trailer 整合 + design rationale>"
  ↓ (CI 5 check 自动跑 ≈3-5 min)
  ↓
主公：gh pr review --approve (或网页端)
  ↓
主公：gh pr merge --squash --delete-branch
  ↓
agent：git checkout main && git pull --ff-only
```

## 5 status checks 必过

- `Lint (ESLint)`
- `Typecheck (tsc)`
- `Test (Vitest)`
- `Build (Next.js)`
- `Visual QA (Playwright probe)`

任一不绿 → agent 修后 commit follow-up 至 PR branch（主公 push follow-up），不直接 main。

## 例外（仍 direct push）

- **文档类 commit**（subject 以 `docs(` / `docs:` 开头）：仅改 docs/ / .md / .omo/plans/ 等，无代码变动——可走 direct push，不走 PR。**agent 不擅自**，需主公示下。
- **基础设施 / 配置类 commit**（subject 含 `ci(` / `chore(deps):` 等）：主公示下亦可走 direct push。
- **代码类 commit**（subject 含 `feat` / `fix` / `refactor` / `perf` / `test` / `build` / `style`）：必须走 PR。

Vercel 部署同样：docs commit 由 `vercel.json` `ignoreCommand` 跳过；其他 commit 正常 deploy。

## 核心目录约定（Vercel build 决策）

`scripts/vercel-ignore-build.sh` 是 Vercel build 决策的 **single source of truth**。`CORE_PATH_RE` 变量列出改后需 build 的路径：

```
^(app|src/app|pages|src/pages|public|src/public|components|src/components|
 lib|src/lib|db|src/db|styles|src/styles)/|
^(middleware\.ts|middleware\.js)$|
^package\.json$|^next\.config(\.[a-z]+)?$|^tsconfig\.json$
```

支持 root-level 与 `src/`-prefixed Next.js 双 layout。

**新增核心目录时**（如 `src/styles/`、新 middleware、配置文件等）：
- 必在引入该目录的同一 commit 同步更新 `CORE_PATH_RE`
- 必同步 `scripts/vercel-ignore-build.test.sh` 加该 commit 的预期 exit code
- 必跑 `bash scripts/vercel-ignore-build.test.sh` 全绿再 commit

测试套会 replay 仓历史 commit 验脚本行为不变——新增目录后跑测试是回归保障。

## PR description 模板

```
## WHAT
<一文件 diff 概要>

## WHY
<设计动机、引用调研/issue/plan>

## HOW
<改动策略、依赖、验证>

## Lore trailer 整合
- Constraint: ...
- Rejected: ...
- Confidence: ...
- Scope-risk: ...
- Directive: ...
- Tested | Not-tested: ...

Plan: <.omo/plans/<slug>.md>
Refs: <issue/PR/讨论链接>
```

## 历史切换点

- 2026-09-14 前：agent direct push 至 `main`，绕过 `required_status_checks` rule（含 Visual QA）
- 2026-09-14 起：改走 PR + squash；ruleset 5 check 真触发；agent 负责 commit + PR description，push + review + merge 由主公完成