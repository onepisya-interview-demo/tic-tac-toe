# tic-tac-toe · Context

一局棋两版本（offline 纯本地 / online 实时上服）+ RESTful API 的井字棋。本文件是仓库的**语言契约**（ubiquitous language）：命名对齐先查此表；一切产出物（代码、commit 正文、plan、review、QA 探针）使用表内术语，禁用 `_Avoid_` 别名。概念不在表中时勿造新词——先判断是否真缺口，是则按收录门槛补录（`.omo/plans/glossary-context-md.md` D2/D3）。本表只做**命名与裁决层**：真源细节一律指向代码与 plan，不在此复制。

## Language

### 房间（room，W3 御定术语迁移）

「房间」是这台设备上这组人的战绩账本标识——同设备对战（pass-and-play）的两种模式（online / offline）天然共享一个「账本位置」概念：

1. **在线房间**——`game_stats.room TEXT UNIQUE` 表行（`db/schema.ts`），服务端权威账本，跨设备续记；
2. **本地房间**——localStorage `ttt.offline.stats.v1`，offline 局本机累计（`lib/offline-stats.ts`）；
3. **战绩静态入口 state**——`HomeStatsEntry` 只渲染 `<Link href="/result?room=...">`，零请求，零 store 副作用，零 localStorage 写入。

_Usage_: 「把战绩同步上去」不是合法句子——要说清是「把本地房间并入同名云端房间」还是「重新进入云端房间查战绩」。
_Supersedes_（2026-09-19 W3 D-3 御定术语迁移）:
- `playerName`（`name TEXT UNIQUE` 列、`playerName`/`setPlayerName`/`isPlayerName`/`normalizePlayerName`/`registerOrLoginName`/`loadRecordByName`/`mergeRecordByName`/`recordOutcomeForName` 等所有旧符号已退役）
- `PlayerNameForm` / `OnlineStatsCard`（组件整体删除）
- `ttt.player.name.v1` localStorage key（不迁移，启动期被 `cleanupLegacyPlayerNameKey` 清空）
- 「玩家名 / 注册 / 登录」（用户可见文案现役概念全部改为「房间名 / 创建房间 / 进入房间」）
- `POST /api/sessions` / `GET|POST /api/players/{name}/stats*`（API family 整链路退役）
- `ttt:player-name-required` / `ttt:player-name-changed`（事件名随表单删除）

### 版本与词汇（御定命名）

**offline（单机版）**：
连接性维度的二选一之一：零网络、战绩 100% 本地（见 **pure-local**）。路由 `/offline`。
_Avoid_: `solo`（已退役）、`singleplayer`、`/play`
_Supersedes_: `solo`（d07fd07 御定更名；schema.org 词汇对齐——`solo` 撞 `GamePlayMode:SinglePlayer` 语义，理由见 README「词汇语义说明」）

**online（在线版）**：
连接性维度另一侧：需 roomName、入口拦截（RoomGateDialog 按需收名）、战绩实时上服（服务端权威累加）。路由 `/online`。页内文案注明「同设备对战」（pass-and-play 语义，防「在线=远程联机」误解）。
_Avoid_: `ranked`（已退役，暗含不存在的天梯语义）、`multiplayer`、`/play`
_Supersedes_: `ranked`（同上）

**战绩（GameStats）**：
一词指三种不同物，表述时必须限定实例：
1. **本地战绩**——localStorage `ttt.offline.stats.v1`，offline 局本机累计（`lib/offline-stats.ts`）；
2. **服务端战绩**——`game_stats` 表 per-room 单行（`room TEXT UNIQUE`），服务端权威（`db/schema.ts`）；
3. **战绩静态入口 state**——`HomeStatsEntry` 渲染的 `<Link>`，零请求零副作用，pure localStorage→store 读，无组件内网络 state。

### 同步族（按操作拆分——本表最高危词条）

「同步」一词曾同时指下列四个操作（见 Flagged ambiguities），**裸用「同步」视为未定义词**，必须用下列具名操作：

**进入房间（enter-or-create-room，W3 术语）**：
`POST /api/rooms`，body `{ room }`；幂等，返回 `{stats, existed}`（200 / 422 problem+json）。service 真源 `lib/db.ts:registerOrLoginRoom`。
_Supersedes_: 「注册/登录」（W3 D-3 退役）；`POST /api/sessions`（已退役）
_Usage_: 「在线对战」点击 → 无名 → RoomGateDialog 收名 → 提交此端点 → 进入。

**合并（merge）**：
`POST /api/rooms/{room}/stats/merge`，body `{stats}`；**用户主动确认后**的服务端 per-field 累加（见 **per-field 累加**），row 不存在返 409 `enter-room-required`。service 真源 `lib/db.ts:mergeRecordByRoom`。
_Avoid_: 「上传」；PUT `/api/stats`、`/api/solo-stats/sync`、`/api/offline-stats/sync`、`/api/players/{name}/stats/merge`（均已退役）
_Usage_: 弹框流第一步永远是进入房间——未存在的房间 merge 必 409，这不是 bug 是契约。

**记局（record-outcome）**：
`POST /api/rooms/{room}/stats/outcomes`；服务端 read→命中累加→缺失返 404 `stats-not-found`。service 真源 `lib/db.ts:recordOutcomeForRoom`。
_Avoid_: 「同步一局」

**刷新（fetch-stats）**：
`GET /api/rooms/{room}/stats`；404 由 `lib/game-net.ts:fetchRoomStats` 翻译成 `{stats:null}`，展示层零分支。响应只入组件 state（W3 起唯一调用方是 `/result?room=` RSC SSR 直读 DB；首页零 `/api/*`，A1 红线）。
_Avoid_: 「拉取同步」

**清空（reset-room-stats）**：
`POST /api/rooms/{room}/stats/reset`，无 body；服务端清零计数、保留房间身分行（`game_stats.room` UNIQUE 不删），row 缺失返 404 `stats-not-found`（防静默建档）。service 真源 `lib/db.ts:resetRecordByRoom`。
_Avoid_: 「清空房间」（语义弱于 reset-room-stats——清的是计数，不是身份；「删除房间（delete-room）」已 §一 D-5 解禁转正，专指资源销毁，勿回用别名）
_Usage_: `/result?room=` 有账本分支（stats 非 null）挂 `ResetRoomStatsButton` → 确认弹框 → 清零 → `router.refresh()` 重读全零行。

**删除房间（delete-room，BR-12）**：
`DELETE /api/rooms/{room}`，无 body；服务端**销户** game_stats 整行（counts + 身分行都走，与清空严格区分），同名房间名可被 `POST /api/rooms` 幂等重建为全零账本。200 `{ok:true}` / 404 `room-not-found` / 422 `invalid-room-name` / 500 `db-unavailable`。service 真源 `lib/db.ts:deleteRoomByRoom`；端点真源 `app/api/rooms/[room]/route.ts`。TTL 兜底：`purgeStaleRooms(maxAgeDays = 30)` 按 `updated_at` 自动回收孤儿账本（端点 `app/api/maintenance/purge`，Vercel Cron 调度）——删除是用户主动销户通道，TTL 是运维兜底，两者不混。
_Avoid_: 「清空房间」「重置房间」（与 reset-room-stats 同义但语义弱——清空只清计数，不销户）；「注销」（暗含 token/session 语义，本仓没有）；`PUT /api/rooms`（REST 资源动词语义错位）
_Usage_: `/result?room=` 有账本分支挂 `DeleteRoomButton` → type-to-confirm 弹框（输入房间名精确匹配） → DELETE 200/404 视为成功，续 `setRoomName(null)` + `resetOfflineStats()` + `router.push('/')` 回到首页无身份态。404 当「已不存在」幂等吞掉——调用方按契约一次性翻译，不要把 404 当成错误留给用户。
_Supersedes_（2026-09-25 §一 D-5 解禁御定）: 「删除房间」自 `_Avoid_` 转正（plan ulw-room-lifecycle-20260924 §一 D-5）；此前因 W2 之前不存在真 DELETE 端点被 `_Avoid_`。

**退出房间（leave-room）**：
前端轻确认弹框（无 type-to-confirm）→ 用户确认后只清**本机身份**（`setRoomName(null)`） + `resetOfflineStats()`；**零网络写**（offline 战绩清零 + 服务端账本保留——其他设备可继续使用该房间）。入口 `/result` `LeaveRoomButton`，与 `ResetRoomStatsButton` / `DeleteRoomButton` 同区三分。
_Avoid_: 「离开」「登出」（「登出」暗含 token/session，与本仓无身份态正交——重进同名房间就是重新 enter-or-create，不是登录）
_Usage_: 「我换设备用这个房间」或「我就是用本房间玩了一局 now 想停」→ 退出即可，不要用删除；「这房间真不要了」才用删除。

### 哨兵（sentinel）

泛称至少要限定是哪一个；两者的共同点仅是「防止某件事重演」。

**合并基线哨兵（last-merged-local）**：
localStorage `ttt.offline.last-merged-local.v1`；基线模型——存「合并完成时本机零位」，`pendingSyncCount = max(0, local.totalGames - lastMerged)` 恒等于待合并局数，保证弹框文案 = 实际 payload。V4 MINOR-F1 裁决产物。
_Supersedes_: `ttt.solo.server.synced.v1` / `ttt.offline.server.synced.v1`（存服务端绝对 totalGames 的旧模型，`@deprecated` 不迁移，helpers 仅供旧测试 surface）

**防重弹哨兵（sync-declined）**：
sessionStorage `ttt.offline.sync-declined.v1`；「保留本地」后同会话 pending 无增量不重弹；关标签页即忘，新会话从 declined=0 重算。

**pendingSyncCount**：
`lib/offline-stats.ts` 的单一客户端真相：待合并局数。`HomeDialogMount` 据 `pendingSyncCount > declinedSentinel` 决定是否弹框。

**legacy 清理哨兵（W3 新增）**：
旧 `ttt.player.name.v1` 在挂载期被 `lib/room-name.ts:cleanupLegacyPlayerNameKey` 单向清空，不迁移数据；行为等同无名（D-4 许可清空式重建）。

### 契约与红线

**pure-local（纯本地）**：
offline 分支零网络写契约：store 的 `makeMove` offline 分支不发任何 fetch；`/offline` 页全程 `/api/*` 请求数 = 0、零 roomName 展示、零同步按钮。跨设备同步只有一条路：首页 `HomeDialogMount` 弹框（用户主动确认）。
_Additions（2026-09-20）_：`/offline` 战绩无条件直显（StatsGrid），无名与有名渲染一致——无『匿名态』UI 概念（2026-09-20 裁决，`.omo/plans/ulw-offline-ledger-direct.md` §1）。

**防静默建档**：
不允许「匿名点击路径被偷渡成建档」。merge 的 409 `enter-room-required` 与 outcome 的 404 `stats-not-found` 都是它的实现；`lib/api-problem.ts` 是 problem+json 单点。

**per-field 累加**：
服务端 merge 语义：`accumulateMergeStats` 逐字段相加，**非行级覆盖**。幂等边界：同一 stats 第二次 POST 会**双计**——这就是为什么「合并并清空」成功后必须 `clearOfflineStats()` + 写合并基线哨兵。

**合并并清空**：
`SyncConfirmDialog` 主 CTA 语义：`runMergeSequence` = 进入房间 → 合并 → 成功后清本地 + `persistLastMergedLocal(0)`。次 CTA「保留本地」零网络写 + 写防重弹哨兵。

**首页零 API（A1 红线，W3 强化）**：
首页 = 引导页；任何状态、任何 focus 行为下 `/api/*` 请求数 = 0。战绩静态入口 `HomeStatsEntry` 走纯 `<Link>`。战绩主场归 `/result?room=` RSC。`one-identity-qa` Q1 step 硬断言。
_Supersedes_: 「A2 红线：OnlineStatsCard GET 响应只入组件 state」（W3 OnlineStatsCard 已删，A2 红线并入 A1，语义变为「首页零网络」）。

**RoomGateMount 挂载期 identity bootstrap（W3 替代 PlayerNameForm 反向 hydration）**：
`RoomGateMount` 的 useEffect 是首页身份恢复单点：读 store.roomName → 为空但 localStorage `ttt.room.name.v1` 有值时 `setRoomName(stored)`（localStorage → store 单向）。同时执行 `cleanupLegacyPlayerNameKey()`（legacy 单向清除）。方向是 **localStorage → store**，与「SSR 首帧渲染安全默认值 + useEffect 正向同步」相反，勿混用两个触发点。
_Supersedes_: 「PlayerNameForm 反向 hydration」（W2 PlayerNameForm 已删；cace8f4 修补挂载期缺口由 RoomGateMount 接管）。

**soft-nav / hard reload**：
soft-nav（客户端路由跳转）时 Zustand store 单例跨页保留、优先于 localStorage；hard reload 时 localStorage 是 source of truth。RoomGateMount 的 useEffect 是 hard reload 后的恢复点。

### 工程词汇

**探针（probe）**：
`tests/qa/*.mjs` 的 headless Playwright 断言脚本：断言 data-testid 与网络行为，截图供多模态直读。必须对生产构建跑（`:3101` hermetic 库，`BASE_URL` env），禁对 dev server。
_Avoid_: 与 vitest 单测混称「测试」

**六层验证门禁**：
每 commit 必跑：vitest / typecheck / lint / build / commit-audit / 浏览器探针（触及界面时）。on-demand 三层 = coverage / mutation / property-based。真源 `docs/verification-gauntlet.md`。

**lore trailer**：
非平凡提交的全套 trailer（Constraint / Rejected / Confidence / Scope-risk / Directive / Tested）+ `Plan: .omo/plans/<slug>.md` 页脚。禁止 `--no-verify` 绕过 commit-msg hook。真源 `docs/commit-policy.md`。

## Relationships

- **进入房间** 是 **合并** 的前置（409 契约）；**合并并清空** = 进入房间 → 合并 → 清本地 + 写合并基线哨兵
- **清空** 只作用于 **服务端战绩**（清零计数），**房间** 身分行保留；与 **记局** 共享 404 防静默建档契约，与 **刷新** 在 `/result` 组成「清零 → 重读」闭环
- **pendingSyncCount** 由 **本地战绩** 与 **合并基线哨兵** 推导；**防重弹哨兵** 只作用于弹框时机，两者不可互相替代
- **pure-local** 约束 offline 路径零 **合并**、零 **记局**；上服只经用户主动确认的弹框
- **房间**（W3 概念）三实例互不直写：本地 ↔ 服务端只经 **合并**；服务端 → UI 只经 **刷新**（`/result` RSC SSR 直读）
- **清空 / 删除 / 退出 三分（§一 D-5 御定）**：清空只清服务端计数，身分行保留；删除销户整行（game_stats 行 + 本机身份 + 本机 offline 战绩一并清零），同名房间名可幂等重建为全零账本，TTL 兜底孤儿；退出只清本机（身份 + offline 战绩），服务端账本保留供其他设备续用——三者入口按钮同在 `/result` 房间管理区，**绝不混称**。

## Flagged ambiguities

- **「同步」一词多义**：曾同时指进入房间、合并、记局、刷新（甚至已退役的 `PUT /api/stats`）。裁决（2026-09-19）：四操作各自具名，裸用「同步」视为未定义词。来源：`.omo/plans/ulw-room-migration-home-landing.md` §1
- **「name / 玩家名」退役（W3 D-3）**：术语迁移波及 ~40 文件（API 路径 / DB 列 / 组件 / 事件 / 文案 / localStorage key），用户可见文案零残留。来源：`.omo/plans/ulw-room-migration-home-landing.md` §0 / §1
- **「哨兵」曾单指旧绝对值模型**：`ttt.solo.server.synced.v1` 存服务端绝对 totalGames，V4 MINOR-F1 裁决改为基线模型并更名 last-merged-local；旧 key `@deprecated` 不迁移。来源：`.omo/plans/ulw-name-login-one-truth.md`、README「localStorage 旧 key 弃用注」
- **「solo / ranked」版本二分退役**：`solo` 撞 schema.org `SinglePlayer` 语义（本仓无 AI 对手，是同设备 pass-and-play）、`ranked` 暗含不存在的天梯。W1 御定退役为 `offline / online`（连接性维度，与参与人数 `MultiPlayer` 正交）。来源：d07fd07、README「词汇语义说明」
- **「战绩」未限定实例**：曾致 A2 红线反复争议（GET 响应可否入 store）。裁决：W3 后只剩「查询服务器」与「写入」两通道；查询只读展示（`/result` RSC 与 HomeStatsEntry 纯链接），持久层零污染。来源：AGENTS.md「A1 红线」

- **「本机匿名记账中」卡片退役（2026-09-20）**：offline 无『匿名』UI 态——账本无条件直显；『匿名』从用户可见文案退役，仅存工程语境（防静默建档的『匿名点击路径』）。`offline-stats-anonymous` testid 随卡片退役。来源：`.omo/plans/ulw-offline-ledger-direct.md` §0。
- **「删除房间」从 W2 `_Avoid_` 转正（2026-09-25 §一 D-5 解禁）**：此前因 W2 之前不存在真 DELETE 端点被 `_Avoid_`；T-N1 合入 `DELETE /api/rooms/{room}` 端点后产品从此有真实删除操作，与「清空房间」（仅清计数）/「退出房间」（仅清本机身份与 offline 战绩）严格三分。用户可见文案、commit 正文、探针命名禁用「删除房间」以外任何动词表示资源销毁（同义词如「注销」「销户」「解散」按 §一 D-5 御定留作工程语境词，不入白话词表）。来源：`.omo/plans/ulw-room-lifecycle-20260924.md` §一 D-5 / §二 T-N1+T-N2。

## Pending

（空。新词先入此区并标注草案，在真实 commit/会话中被成功复用 ≥1 次后晋升进 Language；无人复用则删除。收录门槛见 `.omo/plans/glossary-context-md.md` D3；工作流词汇如「调度者 / 正交委托 / teach-back」因未达门槛暂不录。）
