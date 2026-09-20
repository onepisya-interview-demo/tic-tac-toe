# Plan: ulw-result-win-celebration —— /result 胜利动画恢复（方案 B）+ /online 直达门控 + MINOR docs 清账

- **日期**：2026-09-20
- **分支**：dev（维护者指示：只在 dev 上开发；执行走独立 worktree + ff 合入，历史保持 dev 线性）
- **状态**：**已全部拍板（D-1~D-5），转正执行**——W-A（/result 庆祝）+ W-A2（/online 直达门控）+ W-B（docs 清账 + D-5a 探针）+ W-C（D-5b slug 迁移，无兼容期）四波并行
- **前置阅读**：DESIGN.md:198（Result confetti 1.1s once 契约仍在动效表）、.omo/plans/ulw-offline-ledger-direct.md（文案送审纪律/等待规范沿用）

---

## §0 证据（全部 measured）

1. **复现**（正规路径：首页 → 门 → /online → 0,3,1,4,2 胜局，:3197 产线构建）：胜局后 **304ms** 被推离 /online（status-bar「X 获胜」实测 unreadable）；confetti 在 /online 从未出现；到达 /result 仅累计成绩单，零胜利字样零动画。证据：`.omx/evidence/ulw/ulw-result-win-celebration/`。
2. **考古（维护者记忆证实）**：/result **曾有胜利动画**——`ResultBanner`（client：headline + `Confetti`（`phase==='won'` 触发）+ 末局文案）由 058ddfb 抽出保留，房间迁移波 c75cfdf 整页重做时退役，现源码零引用。**方案 B = 恢复既有契约**，非新增功能。
3. **根因**：ResultNavigator（components/ResultNavigator.tsx:60）胜局同 tick push；/result 现为纯 RSC 成绩单，无单局胜语义面。
4. **附带缺口（D-4 已拍板本波处理）**：hard-load 直连 /online（绕过首页门）→ identity bootstrap 只挂首页 → store.roomName 空 → ResultNavigator:59 空名守卫不推 → 胜局**原地零反馈**（无记录、无导航、无庆祝）。实测复现。
5. 对照：/offline 胜局 confetti 一次 + 1200ms 页内切换（DESIGN.md:295 契约），不受本波影响。

## §1 W-A 主波设计（D-1=B 定案：/result 到达庆祝）

**机制（比旧 ResultBanner 更精确的触发）**：
- `ResultNavigator` 在 phase→**won**（仅胜局，D-2）push 前，写 sessionStorage 一次性哨兵 `ttt.result.just-won.v1`（值=时间戳或 "1"）。
- /result 新增 client 岛 `ResultCelebration`：mount 读哨兵 → **读后即清**（刷新不重放）→ 命中则渲染 `WinConfetti`（复用 /offline 同款层：hoisted、win-only 一次、aria-hidden、reduced-motion 无动画路径）；未命中零渲染。
- 触发语义精确性：只有「从胜局导航而来」放动画；刷新 / 书签 / 首页「查看战绩」入口（无哨兵）都不触发——修复旧版 store-subscribe 模式「上次胜局后回成绩单误重放」的边界。
- **零新增用户可见文案**（维护者措辞=「播放动画」；如需胜利横幅文案，另行逐字送审）。/result RSC 三分支结构零改动。

**D-3 转译（B 语境，供否决）**：「1200ms」= 到达 /result 后庆祝动画窗（confetti 原生 1.1s once ≈1.2s settle）；reduced-motion 无动画。/online 不再有停留窗（B 即时导航）。

## §2 W-A2 波（D-4 定案：/online 直达门控）

验收语义（机制由执行席 teach-back 提案、调度者批准后实施）：
- 直达 /online **有名**（localStorage 有名）→ mount 期 identity bootstrap（localStorage→store，与首页 RoomGateMount 同源逻辑）→ 直接可玩；胜局走 W-A 全流程（记录→导航→庆祝）。
- 直达 /online **无名** → 页内收名（RoomGateDialog 宿主扩展到 /online 或等价机制）→ 进入房间后可玩；拒绝静默无名对局（online 需 name 契约延伸到页面本身）。
- 红线：首页路径行为零回退；RoomGateDialog 组件复用不改语义；anti-silent-create 契约不回退。

## §3 决策记录

| # | 决策 | 状态 |
|---|------|------|
| D-1 | 庆祝发生地 = **B：/result 到达庆祝**（考古证实为恢复既有契约） | ✅ 已拍板 |
| D-2 | 平局无庆祝（哨兵仅 won 写） | ✅ 已拍板 |
| D-3 | 1200ms = /result 庆祝动画窗（转译见 §1，可否决） | ✅ 已拍板（转译待默许） |
| D-4 | /online 直达缺口**本波处理**（W-A2） | ✅ 已拍板 |
| D-5 | V9 两条旧账 | ✅ 已拍板：D-5a **补**（并入 W-B）；D-5b **改，无兼容期**，全面测试兜底 → 升独立 W-C 波 |
| D-5a | 「真匿名首局」官方探针直测：无预置名 → offline 首局 → 账本增长 + 回首页弹框 `[open]` | ✅ 补（W-B，新探针文件） |
| D-5b | problem slug 迁移：`invalid-player-name`→`invalid-room-name`、`player-session-required`→`enter-room-required`（对齐 CONTEXT.md「进入房间」动词；弃词 session/solo/login/register 禁用）；title 同步去 player 化（'Player stats not found'→'Room stats not found'、'Player session required'→'Enter room required'、'Invalid player name'→'Invalid room name'）；`stats-not-found` 中性保留 | ✅ 改，无兼容期（W-C）。侦察实测：QA 探针零直引 slug，消费者=lib/api-problem.ts + 4 routes + tests/api/rooms*.test.ts + CONTEXT.md/AGENTS.md/lib/AGENTS.md 字符串 |

## §4 W-B 波（docs 清账 + D-5a 探针，已批准，与 W-A/W-A2/W-C 正交）

纯注释/文档措辞，零行为：
1. tests/qa/offline-mode-qa.mjs:163 过时注释（→ W4 D-1 后实况）。
2. DESIGN.md:384,392「匿名玩家」旧述 → W5 直显语义（V10 MINOR-2 建议稿照抄）。
3. V9 注释清单：tests/qa 各文件注释（visual-qa:242 / offline-mode-qa:148,167 / offline-qa:362 / one-identity-qa:416 / sync-qa:16 / one-screen-qa:200）+ 组件迁移史注释（HomeDialogMount / ResetStatsButton / RoomGateDialog / RoomGateMount / OfflineStatsPanel / SyncConfirmDialog / StartGameButton / app/page.tsx / lib/store.ts:69）——措辞改准。
4. **红线**：LEGACY_KEY 功能性引用与 step 09 反向断言是「测迁移完成」契约测试，一字不动。
5. D-5a（已拍板补）：新探针 tests/qa/anonymous-first-game-qa.mjs——全新上下文（零预置名）→ /offline 首局（0,3,1,4,2）→ 账本增长 → 回首页 `sync-confirm-dialog[open]`；弹框内主动提交前零 `/api/*` 写。

## §4b W-C 波（D-5b slug 迁移，已拍板改，无兼容期）

| 项 | 内容 |
|----|------|
| 改 | lib/api-problem.ts（ProblemSlug 联合类型 + TITLES + 头注释去 player 化）；app/api/rooms/route.ts + app/api/rooms/[room]/stats/{route,outcomes,merge}/route.ts 的 slug 实参；tests/api/rooms.test.ts + tests/api/rooms-stats.test.ts 全部期望值；CONTEXT.md（进入房间/合并/防静默建档条 slug 字符串）；AGENTS.md（409 反模式条）；lib/AGENTS.md |
| 映射 | `invalid-player-name`→`invalid-room-name`；`player-session-required`→`enter-room-required`（对齐 CONTEXT.md「进入房间」动词；弃词 session/solo/login/register 禁用）；`stats-not-found` slug 保留、title 改 'Room stats not found'；'Player session required'→'Enter room required'；'Invalid player name'→'Invalid room name'；其余中性 slug（invalid-request-shape/invalid-json/method-not-allowed/db-unavailable）不动 |
| 兜底（维护者：全面测试直至全通过） | vitest 4 端点全分支（200/422/404/409 + problem+json content-type 硬断言）+ 调度者实弹 curl 审计每端点错误分支 + 五探针回归 |
| 红线 | 无兼容期 = 旧 slug 字符串全仓清零（grep 实证）；type URI 前缀 `https://docs.example.com/probs/` 不变；service/transport 分离不动 |

## §5 分支闭环（W-A / W-A2）

| ID | 波 | 分支 | 断言 |
|----|----|------|------|
| F1 | W-A | online 胜局（正规路径） | 到达 /result 后 confetti 层出现恰一次（1.1s 窗）；sessionStorage 哨兵读后即清 |
| F2 | W-A | 刷新 /result | 不重放（哨兵已清） |
| F3 | W-A | 首页「查看战绩」/书签直达 /result | 不触发庆祝（无哨兵） |
| F4 | W-A | online 平局 | 无哨兵无庆祝，行为同现状 |
| F5 | W-A | reduced-motion | 无动画路径，其余语义不变 |
| F6 | W-A | offline 全路径回归 | confetti/1200ms 切换/直显原样 |
| F7 | W-A2 | 直达 /online 有名 | bootstrap 生效，可玩，胜局全流程（记录→导航→庆祝） |
| F8 | W-A2 | 直达 /online 无名 | 页内收名 → 进入房间 → 可玩；胜局全流程；零静默无名对局 |
| F9 | W-A2 | 首页路径回归 | 门流程零回退（StartGameButton 拦截 + RoomGateDialog 语义不变） |
| F10 | W-C | 4 端点错误分支 | 422 type=…invalid-room-name；409 type=…enter-room-required；404 slug 不变 title='Room stats not found'；content-type 恒 `application/problem+json` |
| F11 | W-C | 旧 slug 清零 | grep 'player-session-required\|invalid-player-name' 全仓（含 docs）0 命中 |
| F12 | W-C | 回归 | vitest 全绿 + 五探针回归绿（QA 零 slug 直引，行为面无感） |

门禁：六层全绿（build 在 worktree）；探针回归 offline-qa / one-identity-qa / home-return-qa + 本波新探针（result-celebration / online-direct / anonymous-first-game）+ W-C curl 实弹审计；V11 fresh-context 终验（F1-F12）→ `reports/review/V11.md`。

## §6 执行协议

1. 计划转正 docs(plan) 入档（本 commit）。
2. **四席并行**（上下文正交，文件所有权互斥，越界即停）：

| 席 | 波 | 文件所有权白名单 |
|----|----|------------------|
| wa-exec | W-A | components/ResultNavigator.tsx、components/ResultCelebration.tsx（新）、app/result/page.tsx、新组件单测、tests/qa/result-celebration-qa.mjs（新） |
| wa2-exec | W-A2 | app/online/page.tsx、新门控宿主组件（新）、其单测、tests/qa/online-direct-qa.mjs（新）；**禁改** RoomGateDialog / RoomGateMount / StartGameButton / app/page.tsx（复用不改语义） |
| wb-exec | W-B | DESIGN.md、§4 清单所列注释文件、tests/qa/anonymous-first-game-qa.mjs（新） |
| wc-exec | W-C | lib/api-problem.ts、app/api/rooms/**、tests/api/rooms*.test.ts、CONTEXT.md / AGENTS.md / lib/AGENTS.md 的 slug 字符串 |

3. 通用纪律：fresh codex（herdr tab，勿 split）+ 独立 worktree（基线 = 本 commit 的 dev）；teach-back 后动手；六层门禁（build 只在 worktree）；分片等待（T/5，候 done，herdr-session-hygiene v2）；探针坑三连（sync-confirm-dialog 查 `[open]` / 胜局断言等 `play-again-*` 可见 / 0,3,1,4,2 是 pass-and-play 别假设先手）。
4. AGENTS.md / components/AGENTS.md 的新 testid 与行为 digest 行：W-A / W-A2 席**禁改**，交付报告附「建议行」，调度者验收合入后统一 sync；W-C 的 slug 字符串修订除外（契约修订，归 wc-exec）。
5. 合入序：各席验收通过 → rebase dev → ff（W-B / W-C 无依赖先行；W-A 与 W-A2 互不依赖）。V11 fresh-context 终验 → 清理 + 台账。
