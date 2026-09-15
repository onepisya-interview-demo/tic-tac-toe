# ulw-mobile-one-line-ux — 结果页冗余删除 + 移动端单行化 UX

- **状态**：APPROVED（主公谕：删「结果：O 胜」冗余副行；顶栏两行并一行提高一屏利用率；先察未 push 20 commit）
- **背景**：main 领先 origin 20 commit（51f164c..86ffd83），已经 RA–RD+V2 多轮 AI as judge，**未经主公亲审**——本计划改动叠加其上，故 commit 须小而原子，便于主公逐个审视；push 依旧冻结，合并必经 PR。
- **病灶（调度者亲证）**：
  1. `components/ResultBanner.tsx:37-41`：副行「结果：O 胜」订阅 `lastOutcome` 渲染，与 `result-headline`（「O 获胜」）语义完全重合；tests/qa 八探针**零引用**此副行 → 可删。`lastOutcome` 字段全仓仅此一处消费（lib/store.ts 写、store.test 断言、SoloResultInline 间接）→ 渲染删后成 write-only 死态，应连根删（remove-ai-slops）。
  2. `components/GameShell.tsx`（/play 与 /solo 共用）：header 两行 = 行1[h1 title + SoundToggle] + 行2[StatusBarClient 居中 text-h2]——移动端纵向堆叠占高。
  3. `app/result/page.tsx`：header 两行 = 行1[h1「本局结束」+ SoundToggle] + 行2[ResultBanner 大字 headline]——「本局结束」与 headline 亦冗余。
- **用户意图**：手机一屏展示完全；条件渲染/空间压缩把两行视觉变一行；顶部战绩、状态栏、单机学习、音效开等信息不丢。

## 波次编排（上下文正交性）

**波 1 · W1 单写席（fresh codex，一个 tab，独占 worktree 写权）**
范围：components/{ResultBanner,GameShell,StatusBar*}.tsx、app/result/page.tsx、app/solo/page.tsx、lib/store.ts、tests/{store,components}/*、tests/qa/*（受波及探针）、DESIGN.md、docs/screenshots 重制。
- T1 删冗余副行 + lastOutcome 连根：ResultBanner 删渲染与订阅；store 删字段（state 声明/三处写点/初始值）；tests 同步（store.test 4 处、SoloStatsPanel.test 2 处、StartGameButton.test 1 处 fixture）；`rg "lastOutcome"` 归零为验收。
- T2 result 页 header 并一行：headline 即 h1（aria-live 保留），SoundToggle 同行右置；「本局结束」删除（headline 已表意；document 于 DESIGN.md）。
- T3 GameShell header 并一行：[h1（compact 类）| status-text 行内 | SoundToggle] 一行排布（flex row，gap 收窄；status-bar 保留 role="status" aria-live 与 testid；条件渲染不变——playing 显脉冲点，won/drawn 显终局文案）。
- T4 探针与文档同步：受波及探针断言核对（text 语义不变则零改；布局类断言改）；visual-qa 四 stage 截图重制；DESIGN.md 补 header 组合契约行。
- **动效契约（不可破）**：仅 opacity 150ms ease-out；并一行用 flex 布局非动画实现；禁新动画类型/动画库。
- **a11y 契约**：每页恰一 h1；result-headline/status-bar/status-text testid 原样保留；aria-live 语义不降级。

**波 2 · V 终验席（fresh codex）**
对抗复核 W1 三 commit：移动 viewport（375×667）实测 header 高度单行化（Playwright boundingBox 对比 before/after）；八探针 + solo-mode-qa + hydration-check 全跑；rg lastOutcome 归零；a11y（单 h1/aria-live）核；六门禁全绿。产出 reports/review/V-mobile.md。

## 验收标准（可机器判定）

- A1 `rg -n "lastOutcome" app components lib` = 0 命中；tests 内仅余 fixture 清理后引用亦须 0。
- A2 副行「结果：」全仓 0 命中（app/components）。
- A3 /play、/solo、/result 三页 header 在 375×667 viewport 下 header boundingBox 高度 ≤ 单行阈值（实测 before 记录于 V-mobile.md，after 显著下降且两页无换行）。
- A4 vitest / typecheck / lint / build / commit-audit 全绿；stats-race-qa、solo-mode-qa、hydration-check、visual-qa、ux-contract、confetti-origin、audio-confetti、concurrent-surface 全 PASS。
- A5 docs/screenshots 四图更新且与生产 UI 一致（visual-qa stage 自证）。
- A6 每页恰一 h1；result-headline aria-live="assertive" 保留；status-bar role="status" 保留。
- A7 commit ≤4 个、原子、Conventional + lore trailer + Plan footer；不 push。

## 提交切分（W1）

1. refactor(ui): 删「结果：O 胜」冗余副行 + lastOutcome 字段连根（T1，含 tests）
2. feat(app): 三页 header 移动端单行化（T2+T3，含探针同步）
3. docs(assets+design): 截图重制 + DESIGN.md header 契约（T4）

## 风险与备忘

- result-headline 升格 h1：headline 文案「O 获胜/平局/—」在 idle 时为「—」，h1 空占位语义弱——V 席核 a11y 后如不适可回退为保留原 h1 但与 headline 同行堆叠（两行保底方案记 rejected）。
- visual-qa 截图 stage 若断言布局坐标，T4 须同步基线；V 席复跑证真。
- 未审 20 commit 之上叠改：最终汇报附 20+新 commit 一览表供主公逐审。

**Plan: .omo/plans/ulw-mobile-one-line-ux.md**
