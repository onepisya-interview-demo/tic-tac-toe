# ulw-ux-mobile-sync — 响应式按钮 + solo 视图切换 + 双端可视测试 + 玩家名网络同步

- **状态**：APPROVED（主公谕：按钮排版响应式纵排；solo 结果仅顶部显示不重复；顶栏点击切换棋盘↔战绩提空间利用率；动效要情绪价值；双端可视测试；玩家名 localStorage + 网络战绩同步；暂不 PR 不 push）
- **审美参照**：/tmp/sanyam-www/components/labs（island-menu / flip-clock / morphing-icons 等微交互节律）——取其手感，不抄码、不引库
- **总原则**：先骨架后功能（波1 UI/UX 定型 → 波2 同步功能挂载 → 波3 对抗终验）；单写者纪律；DESIGN.md 令牌契约不破；reduced-motion 全程归零保底

## 病灶与需求（调度者亲证）

1. 首页 actions `flex flex-row gap-3`（app/page.tsx:44-48）：三按钮移动端挤一行 → 文字乱。
2. solo 页：顶部 status-bar 已示「O 获胜/平局」，`SoloResultInline`（ResultBanner）在棋盘下**重复渲染**同名结果 → 删文本重复，**保留彩带情绪层**。
3. solo 页 Card 内 Board + SoloStatsPanel 纵排 → 移动端必滚动；顶栏（h1|status|音效 三列）点击可切换「棋盘视图 ↔ 战绩视图」→ 一屏放下 + 切换动效即情绪价值。
4. visual-qa 仅桌面 1280 stage → 需 mobile 375×667 pass。
5. 新功能：玩家名同步——输入名字存 localStorage（`ttt.player.name.v1`），solo 局终自动提交 + 手动同步按钮兜底；换设备输入同名拉回历史。数据层照 `/api/stats/outcome` 的 server-authoritative 惯例。

## 波次编排

### 波 1 · W-UI（fresh codex，纯 UI/UX，文件面：app/ components/ tests/qa/visual-qa.mjs DESIGN.md tests/qa/lib/*）

- T1 首页按钮响应式：actions 容器 `flex-col sm:flex-row`；移动端三按钮全宽纵排（主/次/ghost 层级分明），sm+ 恢复横排；不压缩文本、不造新令牌。
- T2 solo 结果去重：`SoloResultInline` 不再渲染 ResultBanner 文本（顶部已示），仅条件 mount `Confetti`（won 时）；组件随之更名/简化；solo-mode-qa 及涉 result-headline 探针同步核对（solo 页 result-headline 相关断言改指 status-bar 语义）。
- T3 solo 顶栏切换视图：header 中央 status 区改造为可点击 toggle（真 `<button>`，aria-pressed，testid `view-toggle`，键盘可达），切换 Card 主内容：`board 视图 ↔ 战绩视图（SoloStatsPanel）`；切换动效用 React `<ViewTransition>` update 路径（in-page crossfade + translateY(6px)→0，180ms ease-out）；`prefers-reduced-motion` 归零；非 solo 页不受影响。**目标：solo 页移动端一屏无滚动。**
- T4 DESIGN.md §5 增「In-page view switch」行（时长/缓动/GPU-only/reduced-motion 契约与全表同格）。
- T5 双端可视测试：visual-qa 增 mobile pass（375×667，home/play/solo/result 四截图 + `scrollWidth === viewport.width` 断言），桌面 pass 保留。
- 借鉴 /tmp/sanyam-www/components/labs 微交互手感（过渡节律/留白），禁引库。

### 波 2 · W-SYNC（fresh codex，数据同步 vertical slice，文件面：db/ app/api/ lib/ components/（新组件+挂载点） tests/）

- T1 schema：`solo_records` 表（name TEXT PK + GameStats 五字段 + updated_at），Drizzle 迁移照 db/schema.ts 惯例；本地 file: sqlite 与 Turso 双形制自洽。
- T2 API：`GET /api/solo-stats?name=` 与 `POST /api/solo-stats`（body: {name, outcome}）——server-authoritative 累加（复用 `recordOutcome` 纯函数），name 校验白名单（1-24 字符，去首尾空格，禁控制字符），错误形制照 outcome/route.ts；Node runtime + force-dynamic 照例。
- T3 client：玩家名输入组件（首页战绩卡内或独立小节：输入框 + 保存按钮 + testid `player-name-input`/`player-name-save`）；localStorage `ttt.player.name.v1`（SSR 安全 + fail-soft 照 lib/solo-stats.ts 模式，新增 lib/player-name.ts）；solo 局终自动 POST（已命名时，AbortController 8s 超时照 store 惯例）+ solo panel「同步」按钮兜底重推（testid `solo-sync`）；输入已存在名字 → GET 拉回并展示（panel 标题显名字）；未命名时行为与今日完全一致（纯本机）。
- T4 测试：vitest（name 校验/纯函数）；新探针 tests/qa/sync-qa.mjs（输入名→solo 完局→API 验证落库；新 context 换 deviceId 同名→GET 拉回一致）；QA 探针跑 production server 惯例。
- T5 文档：DESIGN.md/AGENTS.md 契约行同步（新表/新 API/新 key 入档）。

### 波 3 · V 终验（fresh codex，对抗复核 + 全量门禁 + 双端全探针）

- 复核两波全部 commit：响应式实机（320/375/768 三档截图）、solo 无重复结果、切换 a11y（键盘/aria）、同步链路端到端（含名字非法输入对抗：空/25字/控制字符/emoji 混排）、reduced-motion 归零、迁移对既有 DB 兼容（旧库升表不炸）。
- 产出 reports/review/V-mobile2.md，终判 ACCEPT/ACCEPT-WITH-NOTES/REJECT。

## 验收标准（可机器判定）

- A1 375px：首页三按钮纵排全宽（Playwright boundingBox 三者 x 相等、宽=容器）；768px：横排。
- A2 solo 页 won/drawn 后：`rg` 与 DOM 均无第二处「X 获胜/平局」文本（status-bar 唯一）；Confetti 仍现（won）。
- A3 点 `view-toggle`：Card 内容棋盘↔战绩互换，`scrollHeight <= viewport.height`（375×667 一屏）；aria-pressed 翻转；Enter/Space 可驱动。
- A4 visual-qa 双 pass（desktop 1280 + mobile 375）全绿，含横向溢出断言。
- A5 同步链路：sync-qa 全 PASS（自动提交 + 按钮兜底 + 换设备拉回一致）；name 非法输入 422（对抗用例含 25 字/控制字符）；未命名行为与 main 完全一致（无网络调用——探针断言零 POST）。
- A6 六门禁全绿（vitest/typecheck/lint/build/commit-audit）；既有八探针无回归。
- A7 DESIGN.md §5 新行 + 契约文档同步；`prefers-reduced-motion` 下切换瞬时完成。
- A8 commit ≤7（W-UI ≤3 + W-SYNC ≤3 + 计划 1）、原子、lore trailer 全套、Plan footer；不 push 不 PR。

## 风险备忘

- ResultBanner headingLevel prop 系 813e0ac 新增：T2 删 solo 用法后 prop 仅 /result 用——保留 prop（/result 依赖），不视为 slop。
- view-toggle 与 status-bar aria-live 并存：toggle 是按钮不含 live 文案，status-text 仍是 live 区——a11y 不互扰（V 波验证）。
- 同步冲突模型刻意从简：server 累加制，同名多设备并发 = 后到者增；不做 CRDT/时间戳合并——README 注明模型边界，防「为什么不同步删除」之惑。

**Plan: .omo/plans/ulw-ux-mobile-sync.md**
