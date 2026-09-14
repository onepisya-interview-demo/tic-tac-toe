# Plan: ulw · 交接后治理四件（ulw-handoff-governance-20260914）

- 日期：2026-09-14
- ulw-loop：`.omo/ulw-loop/ulw-handoff-governance-20260914/`
- 授权：交接文书 `.omx/handoff-20260914.md`（主公已裁队列）

## 背景与既裁事项

main = origin/main，CI 绿，v1.0.0 已剪，双 Ruleset 已立，Discussions 已开。
主公裁四件：三必做 + 一建议。皆 GitHub 侧治理琐事 + 一次本地跑测，
无行为代码变更（RED-first 不触发），预计仅一枚仓内 commit（社交卡图）。

## 工作项

### T1 · Copilot 实测（必做）
- `gh issue create` 开测试 issue，标题用 CJK，正文给一小任务，
  指派 `@copilot`（Copilot coding agent；assignees 列表现仅 onepisYa，
  若 API 拒指派则改 `gh issue edit --add-assignee "copilot"` 或报主公）。
- 观察窗口内观其回复/PR 是否守 `.github/copilot-instructions.md`
  （核心判据：不动 lib/app/components/db、不加依赖、commit 契约）。
- 验毕 `gh issue close`（issue 可留档亦可删，以留痕为默认）。
- 结论录 ulw-loop 台账。

### T2 · 社交卡图（必做）
- Playwright（复用 tests/qa/lib/browser.mjs 之 launchQA）于 /tmp 摆卡：
  1280×640、暗底（--color-bg-base #0A0A0A）、标题（仓名 + 一句介）+
  docs/screenshots 三帧拼版，设计令牌色（accent #34D399）。
- 产物 `docs/social-card.png` 入仓（tracked，随批 commit）。
- ⚠️ 上传无 API：成图后报主公手动 Settings → Social preview 上传。

### T3 · Discussions 开张（必做）
- `gh api graphql` 建 category=Announcements 欢迎帖：
  仓介绍 + v1.0.0 Release 链 + CONTRIBUTING/AGENTS 贡献链 + Discussions 分区指引。
- 建毕 pin 之（graphql pinDiscussion mutation）。
- 纯远端操作，零仓内改动。

### T4 · Stryker 一跑存档（建议）
- `pnpm test:mutation`（10-30 分钟），报告落 reports/mutation/（已 gitignore）。
- 摘要（mutation score 基线）录 docs/learnings.md（如适用）+ ulw-loop 台账。
- 只扫 lib/game.ts / lib/db.ts / lib/store.ts / db/schema.ts；
  break: null 信息性，不因 score 失败。

## 验收标准

- AC1: 测试 issue 已建并指派 Copilot，观察有果，已 close，结论在台账
- AC2: `docs/social-card.png` 存在、尺寸 1280×640、暗底拼版三帧
- AC3: Discussions 公告帖存在且 pinned=true
- AC4: Stryker 报告落 reports/mutation/，score 摘要在台账
- AC5: 仓内改动（social-card.png + 台账/文档）过六门，攒批 commit，
  subject CJK 起，不 push
- AC6: session id 录 .omo/sessions.local.md

## 边界

- 不做：undo、浅色主题、i18n（禁区三件）
- 不动 lib/app/components/db；不加依赖
- Dependabot PR 不迎不拒
- push 禁自为；一切 commit 攒批报主公

## 执行序

T1 先发（Copilot 响应需时）→ T2 → T3 → T4（长跑放后）→ 汇总台账 →
攒批 commit 报主公。
