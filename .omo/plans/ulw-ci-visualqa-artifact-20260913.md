# Plan: ulw · CI Visual QA job 修复——生产构建产物经 artifact 下发（ulw-ci-visualqa-artifact-20260913）

- 日期：2026-09-13
- ulw-loop：`.omo/ulw-loop/ulw-ci-visualqa-20260913/`
- 状态：派发 fresh codex 执行中（调度者：本 session）
- 背景：开源发布后 main CI 三连修（pnpm 双源 → 隐藏目录 → 本次），病层剥开至最后一 job。

## 1. 现象（run 34764435449）

四 job 绿（lint/typecheck/test/build），唯 Visual QA (Playwright probe) 1m10s 失败：

```
Error: Could not find a production build in the '.next' directory.
```

## 2. 根因

visual-qa 与 build 是两个独立 job，各得全新 runner。`needs: [build]` 仅定序，
不传递工作区。visual-qa checkout 后直接 `pnpm start`，而 `.next` 只存在于
build job 的 runner 上。build job 已上传 `next-build` artifact（含隐藏文件，
上一刀已修），visual-qa 却从未下载。此 job 自 workflow 诞生以来从未成功过。

## 3. 修法（S 刀单）

visual-qa job 在 checkout 之后、pnpm/action-setup 之前插入：

```yaml
- uses: actions/download-artifact@v4
  with:
    name: next-build
    path: .next
```

其余步骤（pnpm install 供 next 二进制、playwright install、start、probe）不动。

## 4. 验收标准（调度者独立复跑）

- AC1: ci.yml 仅 visual-qa job 新增 download-artifact 一 step；yaml.safe_load OK；
  全文件 diff ≤ 5 行
- AC2: 本地等价验收通过——`pnpm build` → `pnpm start`（后台）→ probe
  `EVIDENCE_DIR=/tmp/... node tests/qa/visual-qa.mjs` exit 0 且证据落盘
- AC3: 六层门禁绿（vitest 102/102、typecheck/lint/build=0、audit --branch main
  0 violations）
- AC4: 单一 commit，trailer 英文枚举合规，Plan footer 指向本文件，零个人路径
- AC5: 不 push（git-guardrails 红线，主公亲推）

## 5. 边界

- 不动 npm 依赖（Dependabot #5/#6/#7 另案）
- 不动其余 job
