# Agent 工作流协议（PR 路径守则）

> 立档 2026-09-14 · 决策依据：主公与调度者共识——严守 GitHub ruleset `main-gate`

## 决策

agent 自身攒批后**走 PR + squash merge**（不再 direct push 到 `main`），与 `main-gate` ruleset 完全契合。

## 协议

```
agent：ahead N commit 攒批
  ↓
git checkout -b feat/<slug>
git push origin feat/<slug>
gh pr create --base main --head feat/<slug> \
  --title "<conventional subject>" \
  --body "<PR description = lore trailer 整合 + design rationale>"
  ↓ (CI 5 check 自动跑 ≈3-5 min)
  ↓
主公：网页 review / gh pr review --approve
  ↓
squash merge
  ↓
agent：git checkout main && git pull --ff-only
```

## 5 status checks 必过

- `Lint (ESLint)`
- `Typecheck (tsc)`
- `Test (Vitest)`
- `Build (Next.js)`
- `Visual QA (Playwright probe)`

任一不绿 → agent 修后 push follow-up commit 至 PR branch，不直接 main。

## 例外（仍 direct push）

主公明示「速推 / hot fix / docs 一次性」之时可走 direct push——**agent 不擅自**，需主公明示。

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
- 2026-09-14 起：改走 PR + squash；ruleset 5 check 真触发