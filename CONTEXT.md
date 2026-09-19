# tic-tac-toe · Context

一局棋两版本（offline 纯本地 / online 实时上服）+ RESTful API 的井字棋。本文件是仓库的**语言契约**（ubiquitous language）：命名对齐先查此表；一切产出物（代码、commit 正文、plan、review、QA 探针）使用表内术语，禁用 `_Avoid_` 别名。概念不在表中时勿造新词——先判断是否真缺口，是则按收录门槛补录（`.omo/plans/glossary-context-md.md` D2/D3）。本表只做**命名与裁决层**：真源细节一律指向代码与 plan，不在此复制。

## Language

### 版本与词汇（御定命名）

**offline（单机版）**：
连接性维度的二选一之一：零网络、战绩 100% 本地（见 **pure-local**）。路由 `/offline`。
_Avoid_: `solo`（已退役）、`singleplayer`、`/play`
_Supersedes_: `solo`（d07fd07 御定更名；schema.org 词汇对齐——`solo` 撞 `GamePlayMode:SinglePlayer` 语义，理由见 README「词汇语义说明」）

**online（在线版）**：
连接性维度另一侧：需 name、入口拦截、战绩实时上服（服务端权威累加）。路由 `/online`。
_Avoid_: `ranked`（已退役，暗含不存在的天梯语义）、`multiplayer`、`/play`
_Supersedes_: `ranked`（同上）

**战绩（GameStats）**：
一词指三种不同物，表述时必须限定实例：
1. **本地战绩**——localStorage `ttt.offline.stats.v1`，offline 局本地累计（`lib/offline-stats.ts`）；
2. **服务端战绩**——`game_stats` 表 per-name 单行（`name TEXT UNIQUE`），服务端权威（`db/schema.ts`）；
3. **线上卡组件 state**——`OnlineStatsCard` 的 `LoadState`，GET 响应只入组件 state（见 **A2 红线**）。
_Usage_: 「把战绩同步上去」不是合法句子——要说清是「合并本地战绩」还是「注册/登录后刷新服务端战绩」。

### 同步族（按操作拆分——本表最高危词条）

「同步」一词曾同时指下列四个操作（见 Flagged ambiguities），**裸用「同步」视为未定义词**，必须用下列具名操作：

**注册/登录（register-or-login）**：
`POST /api/sessions`，body `{ name }`；幂等，返回 `{stats, existed}`（200 / 422 problem+json）。service 真源 `lib/db.ts:registerOrLoginName`。
_Avoid_: 「同步」；`/api/player-session`（已退役）

**合并（merge）**：
`POST /api/players/{name}/stats/merge`，body `{stats}`；**用户主动确认后**的服务端 per-field 累加（见 **per-field 累加**），row 不存在返 409 `player-session-required`。service 真源 `lib/db.ts:mergeRecordByName`。
_Avoid_: 「上传」；PUT `/api/stats`、`/api/solo-stats/sync`、`/api/offline-stats/sync`（均已退役）
_Usage_: 弹框流第一步永远是注册/登录——未登录的 merge 必 409，这不是 bug 是契约。

**记局（record-outcome）**：
`POST /api/players/{name}/stats/outcomes`；服务端 read→命中累加→缺失返 404 `stats-not-found`。service 真源 `lib/db.ts:recordOutcomeForName`。
_Avoid_: 「同步一局」

**刷新（fetch-stats）**：
`GET /api/players/{name}/stats`；404 由 `lib/game-net.ts:fetchPlayerStats` 翻译成 `{stats:null}`，展示层零分支。响应只入组件 state（A2 红线）。
_Avoid_: 「拉取同步」

### 哨兵（sentinel）

泛称至少要限定是哪一个；两者的共同点仅是「防止某件事重演」。

**合并基线哨兵（last-merged-local）**：
localStorage `ttt.offline.last-merged-local.v1`；基线模型——存「合并完成时本机零位」，`pendingSyncCount = max(0, local.totalGames - lastMerged)` 恒等于待合并局数，保证弹框文案 = 实际 payload。V4 MINOR-F1 裁决产物。
_Supersedes_: `ttt.solo.server.synced.v1` / `ttt.offline.server.synced.v1`（存服务端绝对 totalGames 的旧模型，`@deprecated` 不迁移，helpers 仅供旧测试 surface）

**防重弹哨兵（sync-declined）**：
sessionStorage `ttt.offline.sync-declined.v1`；「保留本地」后同会话 pending 无增量不重弹；关标签页即忘，新会话从 declined=0 重算。

**pendingSyncCount**：
`lib/offline-stats.ts` 的单一客户端真相：待合并局数。`HomeDialogMount` 据 `pendingSyncCount > declinedSentinel` 决定是否弹框。

### 契约与红线

**pure-local（纯本地）**：
offline 分支零网络写契约：store 的 `makeMove` offline 分支不发任何 fetch；`/offline` 页全程 `/api/*` 请求数 = 0、零 name 展示、零同步按钮。跨设备同步只有一条路：首页 `HomeDialogMount` 弹框（用户主动确认）。

**防静默建档**：
不允许「匿名点击路径被偷渡成建档」。merge 的 409 `player-session-required` 与 outcome 的 404 `stats-not-found` 都是它的实现；`lib/api-problem.ts` 是 problem+json 单点。

**per-field 累加**：
服务端 merge 语义：`accumulateMergeStats` 逐字段相加，**非行级覆盖**。幂等边界：同一 stats 第二次 POST 会**双计**——这就是为什么「合并并清空」成功后必须 `clearOfflineStats()` + 写合并基线哨兵。

**合并并清空**：
`SyncConfirmDialog` 主 CTA 语义：`runMergeSequence` = 注册/登录 → 合并 → 成功后清本地 + `persistLastMergedLocal(0)`。次 CTA「保留本地」零网络写 + 写防重弹哨兵。

**A2 红线**：
`OnlineStatsCard` 的 GET 响应只入组件 `useState`，**严禁**写 localStorage（`ttt.offline.*` 任何 key）或任何 store 字段。`home-return-qa` step07 以逐字节 localStorage 快照断言。

**反向 hydration**：
`PlayerNameForm` 的 useEffect：store.playerName 为空但 localStorage `ttt.player.name.v1` 有值时 `setStoreName(stored)`。方向是 **localStorage → store**，与「SSR 首帧渲染安全默认值 + useEffect 正向同步」相反，勿混用两个触发点。

**soft-nav / hard reload**：
soft-nav（客户端路由跳转）时 Zustand store 单例跨页保留、优先于 localStorage；hard reload 时 localStorage 是 source of truth。反向 hydration 是防 soft-nav 丢身份的机制。

### 工程词汇

**探针（probe）**：
`tests/qa/*.mjs` 的 headless Playwright 断言脚本：断言 data-testid 与网络行为，截图供多模态直读。必须对生产构建跑（`:3101` hermetic 库，`BASE_URL` env），禁对 dev server。
_Avoid_: 与 vitest 单测混称「测试」

**六层验证门禁**：
每 commit 必跑：vitest / typecheck / lint / build / commit-audit / 浏览器探针（触及界面时）。on-demand 三层 = coverage / mutation / property-based。真源 `docs/verification-gauntlet.md`。

**lore trailer**：
非平凡提交的全套 trailer（Constraint / Rejected / Confidence / Scope-risk / Directive / Tested）+ `Plan: .omo/plans/<slug>.md` 页脚。禁止 `--no-verify` 绕过 commit-msg hook。真源 `docs/commit-policy.md`。

## Relationships

- **注册/登录** 是 **合并** 的前置（409 契约）；**合并并清空** = 注册/登录 → 合并 → 清本地 + 写合并基线哨兵
- **pendingSyncCount** 由 **本地战绩** 与 **合并基线哨兵** 推导；**防重弹哨兵** 只作用于弹框时机，两者不可互相替代
- **pure-local** 约束 offline 路径零 **合并**、零 **记局**；上服只经用户主动确认的弹框
- **战绩** 三实例互不直写：本地 ↔ 服务端只经 **合并**；服务端 → UI 只经 **刷新**（只读卡，A2 红线）

## Flagged ambiguities

- **「同步」一词多义**：曾同时指注册/登录、合并、记局、刷新（甚至已退役的 `PUT /api/stats`）。裁决（2026-09-19，本表建立）：四操作各自具名，裸用「同步」视为未定义词。来源：本计划 §1
- **同一文档内新旧术语混写**：本计划自身二稿修订中，哨兵 key 已更新为 `ttt.offline.*` 而端点仍指向已退役的 `/api/offline-stats/sync`——同轮编辑内不同字段漂移到不同时代。裁决：词条内一律「key 名 + 端点 + service 符号」三点同写，改动必须三点同改。来源：本计划 §1 活证据
- **「哨兵」曾单指旧绝对值模型**：`ttt.solo.server.synced.v1` 存服务端绝对 totalGames，V4 MINOR-F1 裁决改为基线模型并更名 last-merged-local；旧 key `@deprecated` 不迁移。来源：`.omo/plans/ulw-name-login-one-truth.md`、README「localStorage 旧 key 弃用注」
- **「solo / ranked」版本二分退役**：`solo` 撞 schema.org `SinglePlayer` 语义（本仓无 AI 对手，是同设备 pass-and-play）、`ranked` 暗含不存在的天梯。W1 御定退役为 `offline / online`（连接性维度，与参与人数 `MultiPlayer` 正交）。来源：d07fd07、README「词汇语义说明」
- **「战绩」未限定实例**：曾致 A2 红线反复争议（GET 响应可否入 store）。裁决：只入组件 state，持久层零污染。来源：AGENTS.md「首页线上战绩只读卡」

## Pending

（空。新词先入此区并标注草案，在真实 commit/会话中被成功复用 ≥1 次后晋升进 Language；无人复用则删除。收录门槛见 `.omo/plans/glossary-context-md.md` D3；工作流词汇如「调度者 / 正交委托 / teach-back」因未达门槛暂不录。）
