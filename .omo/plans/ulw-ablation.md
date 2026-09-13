# Plan — ulw-demo / 行消融实验（stage 3 落地）

> 工作分支：`cleanup/ulw-ablation`（worktree @ <worktree-root>）。
> 基线 SHA = fcbde26（main HEAD）。
> 上游计划：/tmp/ulw-demo-cleanup/plan.md（用户已批准）。
> 实验记录：/tmp/ulw-demo-cleanup/ablations/R{1..6}-*.md（16 份）。
> 评审单：/tmp/ulw-demo-cleanup/REVIEW.md（4 候选 → 3 commit）。

## 范围
按 R1→R6 风险顺序对 25 个候选源文件做"消融"实验。每个单元：写假设 → 物理删除 →
4 门禁（vitest/typecheck/lint/build）→ 还原失败案例 → 留下通过案例。失败的消融
（行为变化 / API 变化 / 重复成本反向上升 / 类型守卫丢失）保留原抽象。

## 落地 commit
1. `refactor(db): 内联 rowToStats/ensureDir/resolveDbPath 三个单点 helper`
   - 链式：删除 rowToStats 之后 db/schema.ts 的 GameStatsRow 导出 0 引用，
     一并删除。
   - 净 -8 LOC lib/db.ts + -1 LOC db/schema.ts = -9 LOC。
2. `refactor(sound): 删除未被调用的 'lose' tone`
   - Tone union + PROGRAMS map 同时移除；0 调用、0 测试。
   - 净 -5 LOC lib/sound.ts。
3. `refactor(layout): 移除未使用的 Inter / JetBrains_Mono 字体加载`
   - 每次页面访问少下载 2 个 Google Fonts subset（~24-32 KB）。
   - 净 -8 LOC app/layout.tsx。

## 门禁
- 每个 commit 后重跑 pnpm vitest run / pnpm typecheck / pnpm lint / pnpm build。
- commit-msg hook 调 tests/qa/commit-audit.mjs --message-file 0 violations。
- 全部 commit 落地后一次跑 6 个浏览器 QA 探针：visual-qa / hydration-check /
  audio-probe / audio-cheer / audio-confetti-qa / ux-qa（先 pnpm build && pnpm start）。

## 不可触碰
- main HEAD fcbde26 上的两份未提交本地变更（docs/learnings.md / next-env.d.ts）
  不入本批 commit。
- 设计契约（DESIGN.md / app/globals.css 设计 token）不动。
- 提交策略（commitlint / commit-audit / commit-msg hook）不动。
- .omo/plans/ai-slop-cleanup.md（上一轮基线）只作为引用，不改写。

## 验证
- 3 commit 后 vitest 80/80 + typecheck + lint + build 全绿。
- 6 浏览器 QA 探针全 PASS。
- 杀 production server + 删 worktree，记录 cleanup receipt。
