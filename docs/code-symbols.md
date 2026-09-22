# Code Symbols Map

> 来源：AGENTS.md §代码地图（行 51–80）

中心度基于 `grep -rln` import 扫描（项目无 LSP / codegraph 工具暴露给 agent；文件级中心度 = 直接 import 该文件的源文件数，含 co-located `*.test.ts`）。粗扫精确度受 import path 别名与 barrel re-export 影响，需要时跑一遍 `grep -rln "from .*lib/X['"]"` 自验。

## 核心符号（lib + app）

| 符号/模块 | 类型 | 位置 | 引用点 | 作用 |
| --- | --- | --- | --- | --- |
| game | 纯规则 + 战绩 | lib/game.ts:1 | 9（4 prod + 5 test） | 棋盘、胜负、落子、连胜、streakLabel |
| useGameStore | Zustand store | lib/store.ts:72 | 10（9 prod + 1 test） | 局面阶段、落子、`mode: 'online'\|'offline'`、apiRecordOutcome AbortController；W-F seam：`pendingOutcomeWrite` + `awaitOutcomeWrite()`（在途记局写等待，吞错落定，无在途写即时 resolve） |
| RESTful 5 endpoints | Route handlers | app/api/rooms/route.ts + app/api/rooms/[room]/stats/{route,merge/route,outcomes/route,reset/route}.ts | 5 prod + 10 QA + 3 test | POST /api/rooms 进入房间幂等 `{stats,existed}` (200 + 422) + GET /api/rooms/{room}/stats (200 / 404 problem+json) + POST /api/rooms/{room}/stats/merge (200 / 409 enter-room-required 防静默建档) + POST /api/rooms/{room}/stats/outcomes (200 / 404 stats-not-found 防静默建档) + POST /api/rooms/{room}/stats/reset (200 全零 / 404 stats-not-found 防静默建档，W-R 清零保留身份) |
| lib/db service layer | DB helpers | lib/db.ts:loadRecordByRoom/upsertRecordByRoom/mergeRecordByRoom/recordOutcomeForRoom/resetRecordByRoom/ensureRecordByRoom/registerOrLoginRoom/accumulateMergeStats/closeDb | 7（5 prod + 2 test） | 单表 game_stats（`room TEXT UNIQUE`，W1 列名从 name 改名）的 read→mutate→upsert 单线；registerOrLoginRoom 幂等进入房间；accumulateMergeStats 纯函数 per-field 相加；零 HTTP 上下文（service/transport 分离契约，详见 [docs/anti-patterns.md](./anti-patterns.md) §L0-1 + README §GraphQL 双兼容预留节）；getDb reconcile 收敛为「列集与 schema 不符即 DROP 重建」（D-4 清空许可，数据不保留） |
| lib/game-net | 浏览器 HTTP | lib/game-net.ts:postRoomSession/fetchRoomStats/postMerge/postOutcome/postResetRoomStats | 6 prod + 2 test | withTimeout 8s + `{ok,value}/{ok,reason}` 契约；fetchRoomStats 把 404 problem+json 翻译成 `{stats:null}` 让展示层零分支 |
| lib/api-problem | RFC 9457 helper | lib/api-problem.ts:problemResponse/ProblemSlug/typeUriFor | 4 prod + 3 test | problem+json helper；`{type,title,status,detail?}`；type 是 https 形态短 URI（`https://docs.example.com/probs/<slug>`） |
| lib/offline-stats | localStorage | lib/offline-stats.ts:OFFLINE_STATS_KEY/OFFLINE_LAST_MERGED_LOCAL_KEY + load/persist/clear/pendingSyncCount | 3 prod + 1 test | 浏览器战绩持久化 + 同步哨兵（防 double-count）；`pendingSyncCount()` 是单一客户端真相；旧 `SOLO_SYNCED_SERVER_KEY` 与 helpers 保留为 `@deprecated` |

## 组件层（components/）

| 符号 | 类型 | 位置 | 引用点 | 作用 |
| --- | --- | --- | --- | --- |
| OfflineStatsPanel | 本地战绩展示 | components/OfflineStatsPanel.tsx:1 | 2（app/offline/page.tsx + 1 test） | `/offline` 棋盘↔战绩 view-swap；纯本地（zero network writes，零 `lib/game-net` 引用）；StatsGrid 无条件直显（无名有名一致，2026-09-20 匿名卡退役） |
| HomeDialogMount | 首页合并弹框宿主 | components/HomeDialogMount.tsx:1 | 1 direct（app/page.tsx） | mount effect 监听 `pathname=/` + focus + visibilitychange + storage + `ttt:offline-stats-changed`（合并后重估 pendingSyncCount），`pendingSyncCount() > declinedSentinel` → 打开 SyncConfirmDialog；W3 起不再 refetch 战绩（OnlineStatsCard 已删，A1 红线） |
| RoomGateDialog | 房间按需收名弹框 | components/RoomGateDialog.tsx:1 | 2 direct（RoomGateMount、OnlineGateMount） + 1 test | 原生 `<dialog>`；单输入 + 主「创建并进入」/ 次「取消」+ n/24 计数 + ESC + reduced-motion + 初焦落主 CTA（requestAnimationFrame 模式，参照 SyncConfirmDialog F3）；提交即 `postRoomSession(trimmed)` → 200 ok 后经 `onConfirm(room, existed)` 回调交宿主全权处理（`ttt.room.name.v1` + store.roomName 双写、`startGame`、导航均归调用方——弹框与路由解耦）；422 / aborted / network-error → 就地错误文案，零持久层写入，零导航 |
| RoomGateMount | 首页房间弹框宿主 | components/RoomGateMount.tsx:1 | 1 direct（app/page.tsx） + 1 test | 监听 `ttt:room-required` Window CustomEvent，打开 RoomGateDialog；同时执行挂载期 identity bootstrap（localStorage `ttt.room.name.v1` → store）+ `cleanupLegacyPlayerNameKey()` 一次性 legacy 清除（cace8f4 修补 W2 删除 PlayerNameForm 的反向 hydration 缺口） |
| OnlineGateMount | /online 直达门控宿主 | components/OnlineGateMount.tsx:1 | 1 direct（app/online/page.tsx） + 1 test | W-A2（ulw-result-win-celebration D-4）：mount effect 读 store.roomName，空则 `getRoomName()` bootstrap（localStorage→store，含 legacy 清扫，与 RoomGateMount effect 同源）；两处皆空就地开 RoomGateDialog（showModal 棋盘 inert，拒绝静默无名对局）；onConfirm=setRoomName→startGame('online')→push（与 RoomGateMount.handleConfirm 同源）；onReject 有意不关弹框（关了就暴露无名不记账棋盘） |
| HomeStatsEntry | 首页战绩静态入口 | components/HomeStatsEntry.tsx:1 | 1 direct（app/page.tsx） + 1 test | 纯 `<Link href="/result?room=...">`；store.roomName 非空时渲染「查看 <room> 的战绩 →」链接，空时不渲染；零请求、零副作用；testid `home-stats-entry` + `home-stats-link` |
| SyncConfirmDialog | 原生 modal（房间术语化） | components/SyncConfirmDialog.tsx:1 | 1 direct（HomeDialogMount）+ 1 test | 内嵌 roomName 流 + 主「合并并清空」/ 次「保留本地」 + n/24 计数 + ESC 关 + reduced-motion；合并时自己跑 `postRoomSession` + `postMerge`（合并 row 透传 onConfirm）；409 `enter-room-required` 翻译为「需要先进入该房间」就地展示 |
| Board | 有状态 UI | components/Board.tsx:26 | 1 direct（/online、/offline）；间接经 PlayController/ResultNavigator 等消费 | roving focus、键盘输入、落子动画 |
| ResultNavigator | 阶段→导航 | components/ResultNavigator.tsx:1 | 1 direct（/online） | phase→'won'/'drawn' 时 push `/result?room=<roomName>`（W3 房间术语）；ref 去重避免 Strict Mode 双推；won（仅胜局，D-2）push 前写 `ttt.result.just-won.v1` 哨兵（helper import 自 ResultCelebration，契约单一真相在那边）；W-F：push 前 await 在途记局写（`awaitOutcomeWrite`，吞错落定），/result 首帧必读已落账本；卸载 guard（cleanup 后不得 push、不得写哨兵） |
| ResetRoomStatsButton | /result 清空战绩 client 岛 | components/ResetRoomStatsButton.tsx:1 | 1 direct（app/result/page.tsx 分支 3） + 1 test | W-R（ulw-online-reset-and-result-fresh D-3/D-4）：「清空战绩」→ 原生 `<dialog>` 确认（主「清空」/ 次「取消」、ESC、reduced-motion、rAF 初焦落主 CTA）；确认后 `postResetRoomStats(room)` 成功 → `router.refresh()` 直读全零行；404「房间不存在，无法清空。」/ 通用错就地展示且弹框保持打开；room 由 RSC normalize 后 prop 传入（SSR 零 localStorage 读）；仅 stats!==null 分支挂载 |
| StartGameButton | 入口拦截 | components/StartGameButton.tsx:1 | 2 direct（app/page.tsx 双 CTA） | `requireName` prop：online CTA 默认 true，无名点击 dispatch `ttt:room-required` Window CustomEvent（不导航、不调 startGame），由 RoomGateMount 监听打开 RoomGateDialog；offline CTA 传 false 直行 |
| WinConfetti | 庆祝层 | components/WinConfetti.tsx:1 | 2 direct（app/offline/page.tsx、ResultCelebration） | bug B fix：hoisted 出 view-swap 容器，celebratedRef 保证胜局仅触发一次；W-A 起组件零改动被 /result 的 ResultCelebration 复用 |
| ResultCelebration | /result 庆祝 client 岛 | components/ResultCelebration.tsx:1 | 1 direct（app/result/page.tsx，两个 return 各挂一次） + 1 test | 哨兵契约单一真相（JUST_WON_SENTINEL_KEY + write/consumeJustWonSentinel 读后即清）；mount 消费 `ttt.result.just-won.v1` 命中才渲染 WinConfetti（复用 /offline 层全部语义），未命中零渲染；「首次消费生效」免疫 StrictMode 双调用；SSR 首帧恒零庆祝；app/result/page.tsx 双挂载属防御性消费非重复渲染 |
| launchQA | Playwright 启动器 | tests/qa/lib/browser.mjs:7 | 17 探针（含 offline-mode-qa / offline-result-qa / one-identity-qa / home-return-qa / result-celebration-qa / online-direct-qa / anonymous-first-game-qa 等） | 统一 Chromium、context、autoplay policy；`BASE_URL` env 变量（默认 :3000，QA 用 :3101）；W4 F5 fix 探针不硬编码 :3000 |

库与 QA 都靠 `lib/game.ts` 与 `lib/store.ts`；store 是浏览器内单例。修改这两文件必跑对应 vitest / Stryker / fast-check（见 [docs/verification-gauntlet.md](./verification-gauntlet.md)）。
