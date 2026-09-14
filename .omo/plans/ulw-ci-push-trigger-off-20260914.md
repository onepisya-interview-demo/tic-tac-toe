# Plan: ulw-ci-push-trigger-off-20260914 · CI 仅 pull_request 触发

- 日期：2026-09-14
- ulw-loop：`.omo/ulw-loop/ulw-ci-push-trigger-off-20260914/`
- 主公示下：保持 Vercel 默认；改 ci.yml 去 push trigger

## 目标

`.github/workflows/ci.yml` 删 `push: branches: [main]` 段；保留 `pull_request: branches: [main]`。merge 后 push 不再触发 CI；仅 PR 路径跑 5 check。

## 改动

```yaml
# BEFORE
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

# AFTER
on:
  pull_request:
    branches: [main]
```

## Vercel 部署不受影响

Vercel GitHub App 自动监听 push + PR——独立于 `.github/workflows/ci.yml`：
- PR 仍触发 Preview Deployment
- Merge to main 仍触发 Production Deployment

## 风险

- **Bypass PR 直 push**（admin override / hot-fix direct push）：CI 不跑
- 应对：ruleset `main-gate` 已阻直 push（pull_request rule + required_status_checks rule 仅 PR 路径生效；non_fast_forward 仅阻 force push 不阻 direct push）—— 实际上 direct push 仍可发生（admin merge button 后 push 即此），但其场景为「PR 已 merge」即 5 check 已绿，故 push 不重跑合理
- 真正风险：若 main公未来绕 PR 直 push 代码 commit（绕过协议），CI 不跑——但 `docs/agent-workflow.md` 已规定「速推 / hot-fix」需主公示下，agent 不擅自

## 边界

- 不动 `pull_request: branches: [main]`
- 不动其他 workflow（如 Vercel App 部署）
- 不动 ruleset
- 不动 `.github/CODEOWNERS`
- 不动 vercel.json（仓无）

## 验收

- AC1: `.github/workflows/ci.yml` 不再含 `push: branches: [main]`
- AC2: 含 `pull_request: branches: [main]`
- AC3: yaml safe_load 仍 PASS
- AC4: 5 job 仍定义（lint / typecheck / test / build / visual-qa）
- AC5: PR 路径走（攒批 commit + 主公 push + agent 开 PR + 等 5 check + merge）
- AC6: squash merge 后 push 不再触发 ci.yml（合并后 main 上无新 ci run）
- AC7: 六门本地全绿
- AC8: commit-audit fail=0

## 文件清单

| 文件 | 状态 |
|---|---|
| `.github/workflows/ci.yml` | modify (删 2 行) |
| `.omo/ulw-loop/ulw-ci-push-trigger-off-20260914/{brief,goals.json,ledger.jsonl}` | new |