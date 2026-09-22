# lib/ 代理说明

核心边界：纯游戏规则、客户端状态编排、浏览器效果、服务端 SQLite 持久化、RESTful 浏览器薄壳、RFC 9457 helper、房间白名单、JSON-LD 序列化。本目录代码迁移按 `.omo/plans/ulw-room-migration-home-landing.md` W1+W2 执行；W3 docs 半区更新本文件代码地图与命名对齐。

## 查找入口

| 任务 | 位置 | 边界 |
| --- | --- | --- |
| 棋盘、胜负、落子、战绩计算 | game.ts | 纯函数；不用 React、DOM、网络或数据库 |
| 局面生命周期和 game-net 同步 | store.ts | 客户端单例；`mode: 'online'\|'offline'` 双分支；`roomName` 状态；本地 UI 状态优先；离线模式下 `makeMove` 不发任何 fetch；W-F seam：`pendingOutcomeWrite` + `awaitOutcomeWrite()`（在途记局写等待，吞错落定） |
| offline 模式浏览器持久化 + 同步哨兵 | offline-stats.ts | load/persist/clear + pendingSyncCount；window 守卫 + shape 校验（非法即 emptyStats） |
| 读取、写入、累加战绩（service 层） | db.ts | 仅服务器；@libsql/client + Drizzle（file:/http(s): 自适应）；**纯函数零 HTTP 上下文**（transport 决定 status code，service 决定真值）；service 符号：`loadRecordByRoom` / `upsertRecordByRoom` / `registerOrLoginRoom` / `mergeRecordByRoom` / `recordOutcomeForRoom` / `resetRecordByRoom`（W-R 清零保留身份，永不 DELETE 行）/ `accumulateMergeStats` / `ensureRecordByRoom` / `closeDb`（W3 全员 room 命名） |
| RESTful 浏览器薄壳 | game-net.ts | `postRoomSession` / `fetchRoomStats` / `postMerge` / `postOutcome` / `postResetRoomStats` + 8s AbortController + `{ok,value}/{ok,reason}` 契约；URL 全走 `/api/rooms/{room}/stats{*,/outcomes,/merge,/reset}` 与 `POST /api/rooms` |
| RFC 9457 problem+json helper | api-problem.ts | problemResponse + ProblemSlug + typeUriFor；type 是 https 形态短 URI |
| 房间白名单 + localStorage 持久化（W3 迁移自 `player-name.ts`） | room-name.ts | `isRoomName` + `normalizeRoom`（service-side 单一真相）+ `getRoomName` / `setRoomName` / `clearRoomName`（SSR-safe + 失软）+ `cleanupLegacyPlayerNameKey`（W3 启动期单向清空旧 `ttt.player.name.v1`）；`ROOM_NAME_KEY='ttt.room.name.v1'` / `LEGACY_PLAYER_NAME_KEY='ttt.player.name.v1'` |
| 首页 schema.org JSON-LD | home-jsonld.ts | HOME_JSON_LD payload + serializeHomeJsonLd（Next.js 16 XSS-safe 字符串化） |
| 行形状 | ../db/schema.ts | `game_stats` per-room（`room TEXT UNIQUE`，W1 表名保留、列从 `name` 改名）；同名只能绑一行 |
| 音效程序和静音状态 | sound.ts | 浏览器 Web Audio；懒创建 context；默认静音 |
| 庆祝粒子 | confetti.ts | 浏览器 canvas-confetti；尊重 reduced motion |

## 契约

- applyMove 对越界或已占用格子抛错；store 的守卫让这些路径不会触发。
- GameStats.currentStreak 有符号：X 为正，O 为负，平局后归零。
- online 模式 GET 失败时 startGame 仍开始；POST outcomes 失败时本地 won/drawn 结果仍保留（fire-and-forget store 缓存正确性优先）。
- 浏览器 store 模块加载时只水合战绩一次（offline 模式在 startGame 时读 localStorage）；页面不要再加第二个 GET kickoff。
- db.ts 创建父目录/表（file: 分支），异步 open / bootstrap / 缓存连接；http(s) 分支不经 fs，直接连 Turso。closeDb 异步关闭，供测试使用。**getDb() 必须 reconcile legacy schema**（W3 单一规则：列集与 drizzle schema 不符 → DROP + 重建；D-4 许可清空式重建，数据不保留；W1 旧「INSERT SELECT 数据保留」多分支迁移逻辑已删除）—— 这是 schema 变更契约（见 AGENTS.md §本项目反模式「DB schema 变更」）。
- lib/db.ts 函数返回值必须是纯数据 + 状态标记（命中 → `GameStats` / `{ stats, ... }`；缺失 → `null` 或具名 `not-found`；异常 → 抛 `Error`）。**禁止返回 `Response` / `NextResponse` / `{ status: 404 }`**（service/transport 分离契约）。
- lib/game-net.ts 8s AbortController 与 store NETWORK_TIMEOUT_MS 同源；fetchRoomStats 把 404 problem+json 翻译成 `{stats:null}` 让展示层零分支。
- lib/room-name.ts:isRoomName 与 normalizeRoom 必须与 4 个 RESTful 端点 service-side `normalizeRoom` 同源（DRIFT = 「保存房间 → POST 422」坏 UX）。
- W3 起 4 个 RESTful 端点全部 import `normalizeRoom` 作为 service-side 单一真相（替换 W1 的 `normalizePlayerName` 内联副本）；`isRoomName` 是单一客户端真相。W-R 起增为 5 端点（reset 同源）。
- 音效默认静音，并持久化为 `ttt.sound.muted`；playSound 每次播放前重新检查静音。
- 桌面彩纸从 x 0.18/0.82、y 0.55 发射；小于 1280px 用两边缘；reduced motion 时 no-op。

## 测试说明

- game/store/db 是 Stryker mutation targets；分支必须对应可观察行为。
- game.ts 有单元和 fast-check 覆盖；store 测试 mock `lib/game-net` 而非 fetch；db 测试使用临时数据库。
- streakLabel 这类派生 UI 标签放在这里，让多个路由和测试共享一份实现。
- 音效/彩纸测试 stub 浏览器全局和 timers；不要求真实音频或视觉粒子。
- RESTful 端点契约（`POST /api/rooms` + `/api/rooms/{room}/stats/{GET,merge,outcomes,reset}`）测试覆盖在 `tests/api/`，用真本地 sqlite + spy http(s) 分支。

## 反模式

- game.ts 不导入 React/DOM；客户端不导入 db.ts。
- 不新增第二个持久化触发点，不让 schema 分叉，也不在 db.ts 外写 raw SQL。
- 不提前创建 AudioContext，也不把默认值改成有声。
- 不引入动画库；纯规则里不留下未解析副作用。
- lib/db.ts 不写日志、不打 console；observability 归调用方。
- 不引入 `solo` / `ranked` / `singleplayer` / `multiplayer` 词汇（schema.org 词汇表对齐理由见 README「词汇语义说明」节）；`lib/offline-stats.ts` 与 `lib/store.ts:GameMode` 是单一真相。
- 不引入 `playerName` / `isPlayerName` / `normalizePlayerName` / `registerOrLoginName` / `loadRecordByName` / `mergeRecordByName` / `recordOutcomeForName` / `setPlayerName` / `getPlayerName` / `clearPlayerName` / `player-name.ts` / `ttt.player.name.v1` 等 W3 已退役标识符；房间概念统一走 `lib/room-name.ts` 的 `isRoomName` / `normalizeRoom` / `setRoomName` 等。
- 不为 RESTful 端点写自定义 validator；统一 import `lib/room-name.ts:normalizeRoom`。
