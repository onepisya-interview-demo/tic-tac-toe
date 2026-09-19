<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-contribution-guidelines -->
总是使用中文进行回复。
# 项目知识库

> Router 形态：本文件只做最小路由与 digest，细节在各节指向的 docs/ 与 .omo/plans/ 文档，按需读取（2026-09-12 瘦身，Plan: .omo/plans/agents-md-slim.md）。

**生成时间：** 2026-09-19
**提交：** d07fd07（基线）→ W5 docs 收口
**分支：** dev

## 概览

一局棋两版本（offline 单机 / online 在线，pass-and-play 同设备对战）+ RESTful API + schema.org 词汇对齐的井字棋：「房间」是这台设备上这组人的战绩账本标识（W3 D-3 御定术语迁移）。首页是引导页，offline 完全离线、本地账本、唯一网络写是合并弹框；online 需 roomName、`StartGameButton` + `RoomGateDialog` 按需收名（无名点 CTA 弹框收名）、战绩实时上服服务端权威累加、`/result?room=` RSC 实时成绩单。技术栈是 Next.js 16 App Router、React 19、strict TypeScript、Tailwind v4 设计令牌、Zustand、Drizzle ORM 和 @libsql/client（本地 file: sqlite / Vercel 走 Turso HTTP）。详细产品模型见 [.omo/plans/ulw-one-game-two-versions.md](.omo/plans/ulw-one-game-two-versions.md) 与 [.omo/plans/ulw-room-migration-home-landing.md](.omo/plans/ulw-room-migration-home-landing.md)。

## 结构

    .
    ├── app/               # 引导页 / online / offline / result 四路由 + RESTful API 4 端点（/api/rooms/*）+ JSON-LD
    ├── components/        # 棋盘、合并弹框、房间弹框、战绩客户端组件，ui/ 基础组件
    ├── lib/               # 纯规则、客户端 store、浏览器效果、SQLite I/O、RFC 9457 helper、房间白名单
    ├── db/                # Drizzle schema：game_stats 单行表（room TEXT UNIQUE，W1 列名从 name 改名）
    ├── tests/qa/          # 面向生产服务的 Playwright 探针（含 offline-qa / one-identity-qa 整合探针）
    ├── docs/              # 面向人的测试、运维和经验记录
    ├── .omo/plans/        # 非平凡提交必需的设计记录
    └── data/              # 已忽略的 SQLite 运行数据库

## 查找入口

| 任务 | 位置 | 说明 |
| --- | --- | --- |
| 路由或 API 行为 | app/ | 客户端四页路由 + Node runtime RESTful 四端点（`POST /api/rooms` + `GET /api/rooms/[room]/stats` + `POST /api/rooms/[room]/stats/merge` + `POST /api/rooms/[room]/stats/outcomes`，W3 D-3 一波迁移） |
| 规则、战绩、持久化 | lib/game.ts、lib/store.ts、lib/db.ts、db/schema.ts | 纯规则不依赖 React/DOM；lib/db.ts 是 service 层，零 HTTP 上下文 |
| RESTful 浏览器薄壳 | lib/game-net.ts | postRoomSession / fetchRoomStats / postMerge / postOutcome + 8s AbortController |
| RFC 9457 problem+json | lib/api-problem.ts | problemResponse + ProblemSlug + typeUriFor |
| 视觉和无障碍契约 | DESIGN.md、app/globals.css、components/ | 设计令牌与全局 focus 所有权是契约 |
| 领域术语与歧义裁决 | CONTEXT.md | 语言契约：命名对齐先查此表，产出物禁用其 `_Avoid_` 别名；收录/晋升门槛见 .omo/plans/glossary-context-md.md |
| 浏览器验证 | tests/qa/ | 先 pnpm build && pnpm start (`:3101`)，不要用 dev server |
| 提交策略 | 下方贡献指南 | tests/qa/commit-audit.mjs 和 Git hook 共同强制 |
| 既有设计理由 | .omo/plans/*.md | 非平凡提交必须引用 Plan footer |

## 代码地图

中心度基于 `grep -rln` import 扫描（项目无 LSP / codegraph 工具暴露给 agent；文件级中心度 = 直接 import 该文件的源文件数，含 co-located `*.test.ts`）。粗扫精确度受 import path 别名与 barrel re-export 影响，需要时跑一遍 `grep -rln "from .*lib/X['"]"` 自验。

| 符号/模块 | 类型 | 位置 | 引用点 | 作用 |
| --- | --- | --- | --- | --- |
| game | 纯规则 + 战绩 | lib/game.ts:1 | 9（4 prod + 5 test） | 棋盘、胜负、落子、连胜、streakLabel |
| useGameStore | Zustand store | lib/store.ts:72 | 10（9 prod + 1 test） | 局面阶段、落子、`mode: 'online'\|'offline'`、apiRecordOutcome AbortController |
| RESTful 4 endpoints | Route handlers | app/api/rooms/route.ts + app/api/rooms/[room]/stats/{route,merge/route,outcomes/route}.ts | 4 prod + 9 QA + 3 test | POST /api/rooms 进入房间幂等 `{stats,existed}` (200 + 422) + GET /api/rooms/{room}/stats (200 / 404 problem+json) + POST /api/rooms/{room}/stats/merge (200 / 409 player-session-required 防静默建档) + POST /api/rooms/{room}/stats/outcomes (200 / 404 stats-not-found 防静默建档) |
| lib/db service layer | DB helpers | lib/db.ts:loadRecordByRoom/upsertRecordByRoom/mergeRecordByRoom/recordOutcomeForRoom/ensureRecordByRoom/registerOrLoginRoom/accumulateMergeStats/closeDb | 7（5 prod + 2 test） | 单表 game_stats（`room TEXT UNIQUE`，W1 列名从 name 改名）的 read→mutate→upsert 单线；registerOrLoginRoom 幂等进入房间；accumulateMergeStats 纯函数 per-field 相加；零 HTTP 上下文（service/transport 分离契约，AGENTS.md §本项目反模式 + README §GraphQL 双兼容预留节）；getDb reconcile 收敛为「列集与 schema 不符即 DROP 重建」（D-4 清空许可，数据不保留） |
| lib/game-net | 浏览器 HTTP | lib/game-net.ts:postRoomSession/fetchRoomStats/postMerge/postOutcome | 5 prod + 2 test | withTimeout 8s + `{ok,value}/{ok,reason}` 契约；fetchRoomStats 把 404 problem+json 翻译成 `{stats:null}` 让展示层零分支 |
| lib/api-problem | RFC 9457 helper | lib/api-problem.ts:problemResponse/ProblemSlug/typeUriFor | 4 prod + 3 test | problem+json helper；`{type,title,status,detail?}`；type 是 https 形态短 URI（`https://docs.example.com/probs/<slug>`） |
| OfflineStatsPanel | 本地战绩展示 | components/OfflineStatsPanel.tsx:1 | 2（app/offline/page.tsx + 1 test） | `/offline` 棋盘↔战绩 view-swap；纯本地（zero network writes，零 `lib/game-net` 引用）；StatsGrid 无条件直显（无名有名一致，2026-09-20 匿名卡退役） |
| HomeDialogMount | 首页合并弹框宿主 | components/HomeDialogMount.tsx:1 | 1 direct（app/page.tsx） | mount effect 监听 `pathname=/` + focus + visibilitychange + storage + `ttt:offline-stats-changed`（合并后重估 pendingSyncCount），`pendingSyncCount() > declinedSentinel` → 打开 SyncConfirmDialog；W3 起不再 refetch 战绩（OnlineStatsCard 已删，A1 红线） |
| RoomGateDialog | 房间按需收名弹框 | components/RoomGateDialog.tsx:1 | 1 direct（RoomGateMount） + 1 test | 原生 `<dialog>`；单输入 + 主「创建并进入」/ 次「取消」+ n/24 计数 + ESC + reduced-motion + 初焦落主 CTA（requestAnimationFrame 模式，参照 SyncConfirmDialog F3）；提交即 `postRoomSession(trimmed)` → 200 ok 时写 `ttt.room.name.v1` + store.roomName + `startGame(mode)` + `router.push(href)` + close；422 / aborted / network-error → 就地错误文案，零持久层写入，零导航 |
| RoomGateMount | 首页房间弹框宿主 | components/RoomGateMount.tsx:1 | 1 direct（app/page.tsx） + 1 test | 监听 `ttt:room-required` Window CustomEvent，打开 RoomGateDialog；同时执行挂载期 identity bootstrap（localStorage `ttt.room.name.v1` → store）+ `cleanupLegacyPlayerNameKey()` 一次性 legacy 清除（cace8f4 修补 W2 删除 PlayerNameForm 的反向 hydration 缺口） |
| HomeStatsEntry | 首页战绩静态入口 | components/HomeStatsEntry.tsx:1 | 1 direct（app/page.tsx） + 1 test | 纯 `<Link href="/result?room=...">`；store.roomName 非空时渲染「查看 <room> 的战绩 →」链接，空时不渲染；零请求、零副作用；testid `home-stats-entry` + `home-stats-link` |

| lib/offline-stats | localStorage | lib/offline-stats.ts:OFFLINE_STATS_KEY/OFFLINE_LAST_MERGED_LOCAL_KEY + load/persist/clear/pendingSyncCount | 3 prod + 1 test | 浏览器战绩持久化 + 同步哨兵（防 double-count）；`pendingSyncCount()` 是单一客户端真相；旧 `SOLO_SYNCED_SERVER_KEY` 与 helpers 保留为 `@deprecated` |
| SyncConfirmDialog | 原生 modal（房间术语化） | components/SyncConfirmDialog.tsx:1 | 1 direct（HomeDialogMount）+ 1 test | 内嵌 roomName 流 + 主「合并并清空」/ 次「保留本地」 + n/24 计数 + ESC 关 + reduced-motion；合并时自己跑 `postRoomSession` + `postMerge`（合并 row 透传 onConfirm）；409 `player-session-required` 翻译为「需要先进入该房间」就地展示 |
| Board | 有状态 UI | components/Board.tsx:26 | 1 direct（/online、/offline）；间接经 PlayController/ResultNavigator 等消费 | roving focus、键盘输入、落子动画 |
| ResultNavigator | 阶段→导航 | components/ResultNavigator.tsx:1 | 1 direct（/online） | phase→'won'/'drawn' 时 push `/result?room=<roomName>`（W3 房间术语）；ref 去重避免 Strict Mode 双推 |
| StartGameButton | 入口拦截 | components/StartGameButton.tsx:1 | 2 direct（app/page.tsx 双 CTA） | `requireName` prop：online CTA 默认 true，无名点击 dispatch `ttt:room-required` Window CustomEvent（不导航、不调 startGame），由 RoomGateMount 监听打开 RoomGateDialog；offline CTA 传 false 直行 |
| WinConfetti | 庆祝层 | components/WinConfetti.tsx:1 | 1 direct（app/offline/page.tsx） | bug B fix：hoisted 出 view-swap 容器，celebratedRef 保证胜局仅触发一次 |
| launchQA | Playwright 启动器 | tests/qa/lib/browser.mjs:7 | 14 探针（含 offline-mode-qa / offline-result-qa / one-identity-qa / home-return-qa 等） | 统一 Chromium、context、autoplay policy；`BASE_URL` env 变量（默认 :3000，QA 用 :3101）；W4 F5 fix 探针不硬编码 :3000 |

库与 QA 都靠 `lib/game.ts` 与 `lib/store.ts`；store 是浏览器内单例。修改这两文件必跑对应 vitest / Stryker / fast-check（见 §验证门禁）。

## 约定

- 修改路由、handler、类型或生成文件前，先阅读上方 Next.js 16 自动警告。
- Server Component 是默认；只有交互或浏览器 API 需要时才添加 'use client'。
- 路径别名 @/* 指向仓库根目录；规则放 lib，schema 放 db，UI 组合放 components。
- 设计令牌保存在 app/globals.css 和 DESIGN.md；Tailwind class 引用令牌。
- 提交主题和正文可以中文；Conventional 前缀与 lore trailer 键名保持英文。
- 路由命名遵循 W1 御定：`/online` (实时上服) + `/offline` (纯本地) + `/result` (RSC 成绩单)；不引入 `solo` / `ranked` / `singleplayer` / `multiplayer` 词汇（schema.org 词汇表对齐理由见 README「词汇语义说明」节）。
- 领域概念命名以 CONTEXT.md 为准：一切产出物（代码、commit 正文、plan、review、探针）使用表内术语、禁用其 `_Avoid_` 别名；概念不在表中勿造新词——先判断是否真缺口，是则按 `.omo/plans/glossary-context-md.md` D3 门槛入 Pending 区，复用后晋升。

## 本项目反模式

- **service 层纯函数 / 传输层薄壳强制分离（GraphQL 双兼容预留）** —— W2 起（ulw-one-game-two-versions §0）：lib/db.ts 是 service 层，全部「读 / 改 / 写战绩」业务规则收敛为纯函数（无 HTTP 上下文、无 NextResponse、无 status code 知识）；调用方是 lib/store.ts（浏览器端）或 app/api/**/route.ts（Node runtime 端）。任意 transport（RESTful route / GraphQL resolver / gRPC handler）只做「解析入参 → 调 service → 映射返回值到 status code / problem+json」；不得在 transport 里再写一份「read → mutate → upsert」业务规则。GraphQL 双兼容仅需新增 schema + resolver，service 函数零改动。transport 层错误统一走 lib/api-problem.ts:problemResponse，RFC 9457 application/problem+json。
- **service 函数禁止返回 `Response` / `NextResponse` / `{ status: 404 }`** —— lib/db.ts 的函数返回值必须是纯数据 + 状态标记（命中 → `GameStats` / `{ stats, ... }`；缺失 → `null` 或具名 `not-found` 字符串；异常 → 抛 `Error`）。transport 层是唯一决定 status code 的地方。
- 已有命名令牌时，不要使用 Tailwind 原生色板或内联 hex。
- 不要在 SSR 首帧读取 localStorage；先渲染安全默认值，再用 useEffect 同步。
- 不要引入 UI、路由、动画、数据访问或表单库；这些是项目约束明确排除的。
- 不要使用 div onClick、emoji 图标、组件级 focus ring，或新增第二个水合触发点。
- 不要用 --no-verify 绕过 commit-msg hook。
- 契约要求生产构建时，不要对 dev server 跑浏览器 QA。
- **LSP 服务端工具（typescript-language-server / yaml-language-server / bash-language-server）走 vp 全局安装，禁止作为项目 npm 依赖** —— 它们是 Codex `lsp.*` MCP 的语言服务端，永不进 Next.js runtime bundle。`.codex/lsp-client.json` 是被 git 跟踪的共享配置，**必须可移植：只写 id / priority / disabled / env 级覆写，禁止 install hash 或机器本地绝对路径**（曾因写入 vp hash 的 `initialization.tsserver.path` 导致 fresh clone 即坏 + 本机重装静默失效）。TLS 的 typescript 由 codex-lsp initialize 恒带的 workspaceFolders 解析到项目 devDep `typescript` 的 `node_modules/typescript/lib`，无需任何 override；per-machine override 写 user 级 `~/.codex/lsp-client.json`（不入库）。任何 LSP 改动必须：(1) 三个 server 通过 `vp add -g` / `vp rm -g` 同步增删；(2) `.codex/lsp-client.json` 保持无机器本地路径并同步；(3) `pnpm vitest run` + `pnpm typecheck` 确认不破 Gauntlet。详见 `.omo/plans/lsp-revert-to-global.md` 与 `.omo/plans/lsp-client-portable-config.md`。
- **RSC 页面读取可变数据必须声明 `dynamic = 'force-dynamic'`** —— Next.js 16 默认静态优化可能烘焙 build-time 异步数据（如 Drizzle DB 调用）的结果到 HTML，runtime 返回脏数据直到下次 build。B-3a 实证：首屏 HTML 显示旧战绩而 DB 已是新战绩。`/result` RSC 实时成绩单（W3 起）即强制声明此 flag。
- **Service Worker fetch handler 必须按方法门控** —— `event.respondWith(fetch(event.request))` 无门控会让 PUT/POST/DELETE 被发两次（浏览器观察到两条 outbound 请求）。可安装但不缓存的 SW 范式：`if (event.request.method !== 'GET') return;` 后再 respondWith。B-1 实证：生产 DevTools Network 面板观察到 2 行 PUT。
- **store 的网络写 action 必须返回 Promise** —— 让调用方可以 await 后再调 `router.refresh()`。在 `force-dynamic` 下无需 `revalidatePath`（冗余）；在 ISR 下 Route Handler 必须调 `revalidatePath('/')` + `revalidatePath('/result')`。B-2 + B-3b 实证：setTimeout 700ms 与 PUT 落库时刻不固定；resetAll fire-and-forget DELETE 后同步 router.refresh() 会读到旧值。
- **网络写 action 必须带 AbortController timeout** —— Turso HTTP 在 iad1 偶发 30 s 默认 fetch 超时；client 必须主动 8 s `AbortController.timeout()` abort + Button `loading` state + 强制 disabled，否则重置战绩按钮会卡 30 s 不响应。HAR §P2 实证：线上抓到一个孤立 DELETE 200 time=30733 ms。`lib/store.ts:NETWORK_TIMEOUT_MS` 与 `lib/game-net.ts` 8s 约定同源。
- **静态资源缓存必须双层** —— `_next/static/**` 已被 Vercel 边缘 immutable 缓存；但 `manifest.webmanifest` / `icon.svg` / `apple-icon*` / `favicon*` / `icon-*.png` 默认 `max-age=0, must-revalidate` 会让浏览器每次 nav 都 304 roundtrip（50-200 ms）。必须 `next.config.ts headers()` + SW cache-first 双层。HAR 直读实证：单次 PWA 会话 56-94 次 manifest 请求 + 头 = `max-age=0`。
- **仓库内任何"清理/迁移/deslop"批量文件操作必须走 git 通道：删 tracked 文件前先 commit，删 untracked/ignored 内容前先备份** —— worktree-only 删除可由 `git ls-files -d -z | xargs -0 git checkout --` 一条命令恢复，但 ignored 内容（如 `.omx/backups` 备份 tar）被删即永久丢失。2026-09-12 00:00:08-23 实证：40 个 tracked 文件（全部属于最后提交日期 2026-09-07 的 cohort）+ `.git/hooks` + `.omx/backups/repo.git.tar` 在 15 秒内被未知进程按清单删除；同波进程还触碰了 /tmp 顶层 35 个不相关目录。
- **herdr 多 pane 工作区内，同一 worktree 同时只允许一个 agent 写入；午夜定时任务窗口（00:00±15min）不做绕过 git 的批量文件操作** —— 2026-09-12 实证：仓库删除（00:00:08-23）与 `/tmp/hooks-v2` 空骨架创建（00:00:15）交错 6 秒，指向同一迁移脚本中途停止；三个 herdr pane 的会话转录在窗口内均零条目，hermes 生态 4 个 cron 同窗触发但无一认领删除行为——reflog/index 零记录证明它绕过了 git。
- **DB schema 变更必须带 getDb reconcile + legacy 旧库迁移测试** —— `db/schema.ts`（drizzle 声明）与 `lib/db.ts:getDb()` 的手写 bootstrap DDL 是两份真相；任何对 `game_stats` 的列级变更（如 ulw-name-login-one-truth 加 `name TEXT UNIQUE`）必须在 `getDb()` bootstrap 后追加 `SELECT name FROM pragma_table_info('game_stats')` 列探测 + 缺失即事务内重建（CREATE TABLE _new → INSERT SELECT 共有列 → DROP → RENAME）+ `DROP TABLE IF EXISTS` 退役孤儿表。`tests/db/db.test.ts` 必须新增 describe「legacy DB migration」，用手建旧形状 DDL + 种子行复现「存量库炸」→ 断言迁移后种子保留 / `name` 列 UNIQUE 实证 / 迁移幂等（closeDb+重开仍 7） / 与 fresh 库 PRAGMA 列集相等。W1 实证（plan `.omo/plans/ulw-hotfix-db-schema-drift.md`）：未做此修复前主公 :3000 存量库 `no such column: "name"` 起服 500；盲区根因 — fresh session ≠ 视角多样性，CR/V5 验了两份 schema 真相互相一致（确实一致），没人问「上个月代码建的库会怎样」。**已知缓议**（参见 `reports/review/RC-drift.md` §4.1 处置表）：**P1-2** Turso HTTP `batch('write')` 事务原子性未在 CI 部署硬化波实测（理论网络半成品重试路径未实证）；**P1-4** `.env.example` / `drizzle.config.ts` / `lib/db.ts:resolveDbConfig` 三处默认值字面字符串形态不齐（相对路径 vs `path.join(cwd,...)` 绝对路径），待下次 schema/deploy 波抽 `lib/db-path.ts` 单一常量源；**P1-5** `resolveDbConfig` 无 DATABASE_URL 时 `fs.mkdirSync({recursive:true})` 同步阻塞冷启动 hot path（冷启动稀疏 + 目录小可接受）。
- **commit-msg hook 位于 `.git/` 内，git 永不跟踪；重建只能靠文档契约，重建后必须双向冒烟** —— 契约三源：docs/commit-policy.md §commit-msg hook、`.omo/plans/commit-policy-enforcement.md`与 `.omo/plans/recovery-from-unknown-cleanup.md` 附录 B（audit 脚本是策略真源，hook 委托 audit）。任何 commit（含 `fcbde26f`）都不含 hook 原件；`.git/HEAD` 丢失用 `echo 'ref: refs/heads/main' > .git/HEAD` 恢复；hook 重建脚本见 `.omo/plans/recovery-from-unknown-cleanup.md` 附录 B。
- **`ttt.room.name.v1` 白名单必须与 `lib/room-name.ts:normalizeRoom` 同源（W3 迁移，W2 收敛原 `ttt.player.name.v1` + `lib/player-name.ts:normalizePlayerName`）** —— trim → 1–24 字符 → 禁 `< 0x20 / 0x7F / 0x80–0x9F` 控制字符；W3 起 4 个 RESTful 端点（`POST /api/rooms` + `api/rooms/[room]/stats/{GET,merge,outcomes}`）全部 import `normalizeRoom` 作为 service-side 单一真相，`isRoomName` 是单一客户端真相；DRIFT = 「保存房间 → POST 422」坏 UX。W1 之前 `app/api/player-session/route.ts` 与 `app/api/solo-stats/sync/route.ts` 各内联一份 normalizeName 是 4 endpoint DRIFT 根因，W2 整链退役 + 单点收口，W3 D-3 房间术语一步到位。
- **未命名 offline 路径零新增网络行为** —— `/offline` 路由全程 `/api/*` 请求数 = 0（`one-identity-qa` step 断言）；任何「顺手 GET 一次」改动都破坏该契约。
- **同名并发故意 last-write-wins，README 注明边界** —— 不做 CRDT / 时间戳合并；单机 UX 场景下「跨设备累加足够」，过度合并引入「为什么不同步删除」的迷惑。
- **offline 100% 纯本地——store 不再 auto-POST，跨设备走首页 HomeDialogMount 弹框** —— W1+W2+W3 收尾（.omo/plans/ulw-solo-pure-local-closeout.md §1 + ulw-name-login-one-truth.md §1 G1 + ulw-room-migration-home-landing.md §1）：`lib/store.ts` 的 `makeMove` 在 offline 分支只调 `recordOutcome(internalStats, outcome)` + `persistOfflineStats(...)`，不发任何 fetch；具名玩家与匿名玩家一致——零网络写。「合并并清空」由 `components/HomeDialogMount.tsx` 的 mount effect 监听 `pathname='/'` + focus + visibilitychange + storage 事件触发（pendingSyncCount>declinedSentinel 时打开 `SyncConfirmDialog`，W3 替换 W1 的 StartGameButton 拦截；D1 决议），弹框内自己跑 `lib/game-net.ts:postRoomSession` + `postMerge` → `lib/db.ts:mergeRecordByRoom` 服务端 per-field 累加 → 客户端 `clearOfflineStats()` + `persistLastMergedLocal(0)`（W4 F1 哨兵）。

- **POST /api/rooms/{room}/stats/merge 是「用户主动确认的合并」接口（W2 契约，W3 D-3 一波迁移），URL 携带 room，body 接 `{stats: GameStats}`** —— wave 2「合并需弹框问询」契约（B-T2/B-T3/B-T4）：server 端 read→`accumulateMergeStats` per-field 相加→upsert→返回合并后 `{stats}`，幂等（同一 stats 第二次 POST 会双计——这是 why 客户端在成功后 `clearOfflineStats()` + 写 sentinel `persistLastMergedLocal(0)` 防再点）；调用方必须在 SyncConfirmDialog 主 CTA「合并并清空」按下后才发，「保留本地」零网络写。
- **同步哨兵 `ttt.offline.last-merged-local.v1` 跟踪合并后本机零位（基线模型，W4 F1 fix）** —— W4 修复 V4 MINOR-F1：旧 `ttt.offline.server.synced.v1` 存服务端绝对 totalGames，导致合并后本地 0..N 局内 catch-up 窗口内弹框被抑 + 文案少报（总数恒正确，无双计——server 侧 per-field 累加 + 本地清空不变量保证；问题只在「dialog text 与实际 payload 不一致」）。新模型存「合并完成时 local.totalGames = 0」基线，合并成功后 `HomeDialogMount.handleConfirm` 写 `persistLastMergedLocal(0)`，`pendingSyncCount = max(0, local.totalGames - lastMergedLocal)` 永远等于 local —— 弹框文 = 实际发送。旧 `OFFLINE_SYNCED_SERVER_KEY` 与 helpers 保留为 `@deprecated`（向后兼容读 + 测试 surface，无产线调用方）。`lib/offline-stats.ts:pendingSyncCount` 是单一客户端真相。
- **`/offline` 页纯净化：零 roomName 展示、零网络、零同步按钮、零 RoomGateDialog、零 PlayerNameForm（已退役）** —— `.omo/plans/ulw-name-login-one-truth.md` §1 G1 + `.omo/plans/ulw-room-migration-home-landing.md` §2.7：`components/OfflineStatsPanel.tsx` 仅渲染「单机战绩」+ `StatsGrid` + `ResetStatsButton(scope='local')` StatsGrid 无条件渲染；组件零 roomName 依赖，不挂载按 roomName GET、不内嵌存名或同步按钮、不渲染 `SyncConfirmDialog`、不渲染 `RoomGateDialog`；`app/offline/page.tsx` 渲染树零 `PlayerNameForm`（W2 已删）/ `RoomGateDialog` / 网络组件。`one-identity-qa` A4 step 断言：预设 `ttt.room.name.v1` + 挂载 `/offline` → 全程 `/api/*` 请求数 = 0；以下 testid 在 **`/offline` 路由**下 0 命中：`offline-stats` 之外的 `sync-*`、`room-gate-*`、`home-stats-*`。`sync-confirm-*` 仍在 home 页由 `HomeDialogMount` 触发弹框（不是代码失效，是 mount host 路由分工）；`tests/qa/{sync-qa,merge-sync-qa}.mjs` 头部注释标注 DISABLED 是它们原本就是探 `/solo` 同步按钮的 probe；W3 已上 `tests/qa/home-return-qa.mjs` + `tests/qa/one-identity-qa.mjs` 重建跨设备同步的探针覆盖（A3 全路径 + A7 fresh-context 跨设备只读恢复）。

- **首页「开始对战」/「单机练习」点击零拦截（pure-local 时）** —— W3（ulw-one-game-two-versions §1 D1）：StartGameButton 整段删除 pendingSyncCount 拦截逻辑 + onAfterConfirm 导航回调；点击即直行 `startGame(mode) + router.push(href)`。SyncConfirmDialog 不再由 StartGameButton 渲染，改由 `components/HomeDialogMount.tsx`（mount 在 app/page.tsx 末尾）的 effect 监听 `pathname='/'` + focus + visibilitychange + storage 事件触发；`pendingSyncCount() > declinedSentinel` 才开 dialog，否则静默直行。`onAfterConfirm?: () => void` 保留以备未来「navigate after merge」调用方（当前 HomeDialogMount 不传该 prop）。

- **首页零 API（A1 红线，W3 强化）** —— W3 D-1 决议：首页 = 引导页（hero + 玩法引导 + 双 CTA + 战绩静态入口），**任意状态、任意 focus 行为下 `/api/*` 请求数 = 0**。战绩展示主场归 `/result?room=` RSC（force-dynamic SSR 直读 DB）。`one-identity-qa` Q1 step 硬断言。W3 删除 `OnlineStatsCard`（原 GET 触发器）与 `PlayerNameForm`（原常驻收名表单）；A2 红线（GET 响应只入组件 state）随 OnlineStatsCard 删除并入 A1。战绩静态入口 `HomeStatsEntry` 是纯 `<Link>`，零请求零副作用；房间按需收名由 `RoomGateDialog` 完成，弹框宿主 `RoomGateMount` 监听 `ttt:room-required` 打开弹框。

- **`ttt.offline.sync-declined.v1` sessionStorage 哨兵（保留本地时不重弹）** —— W3：D3 决策「保留本地 → 零网络写 + 同会话 pending 无增量不重弹」的实现机制。`SyncConfirmDialog` 不直接写 sessionStorage；由 `components/HomeDialogMount.tsx` 的 onReject handler 写 `writeDeclinedPending(pendingSnapshot)`；`loadDeclinedPending()` 在 mount effect 中读取参与判断。`sessionStorage`（非 localStorage）保证关标签页即忘——新会话总是从 declined=0 重新计算。`clearDeclinedPending()` 在合并并清空成功后被 HomeDialogMount 调，清后下次访问 pending=0 → dialog 不开。

- **POST /api/rooms/{room}/stats/merge 409 防静默建档** —— W3（迁移自 W2 的同名 /api/players 契约）：服务端在 merge 前必须先 `loadRecordByRoom(room)`；row 不存在 → 409 `player-session-required`（slug 名沿用 W1 契约，含义改为「需要先进入该房间」，不允许「merge 一个未注册 room」被偷渡成 upsert 复活已删除账号）。弹框流强制保证先 hit `POST /api/rooms`（进入房间）才许调 /stats/merge；客户端 `SyncConfirmDialog.runMergeSequence` 把 409 翻译成「需要先进入该房间才能合并（请重新输入房间名）」就地展示，不调 onConfirm。server 端 `loadRecordByRoom` 是 merge handler 唯一的 row-existence probe（mergeRecordByRoom 内部的 read-then-upsert 是私有实现，不参与 409 判定）。

- **POST /api/rooms/{room}/stats/outcomes 404 防静默建档** —— W2 契约 + W3 房间术语迁移：`recordOutcomeForRoom(room, outcome)` 服务端 read → 命中则累加 upsert → 缺失返 `{ ok: false, reason: 'not-found' }`，transport 映射 404 problem+json。拒绝「一个匿名点击路径被偷渡成已注册」。

- **RoomGateMount 挂载期 identity bootstrap（替代 PlayerNameForm 反向 hydration，W3 cace8f4 修补）** —— W2 删除 PlayerNameForm 后挂载期 identity 恢复缺口由 RoomGateMount 接管：`RoomGateMount` 的 useEffect 读 store.roomName；若为空但 localStorage `ttt.room.name.v1` 有值，调 `setRoomName(stored)`。同时执行 `cleanupLegacyPlayerNameKey()`（旧 `ttt.player.name.v1` 单向清除）。这是 home-return 路径上 HomeStatsEntry 能立即渲染「查看 <room> 的战绩 →」链接的前提——soft-nav /offline → / 时 store 单例跨 nav 保留，但 hard reload 时 localStorage 是 source of truth，需 bootstrap 路径恢复。soft-nav 时 store 优先（最新 setRoomName）。

- **RoomGateDialog 与 SyncConfirmDialog 弹框初焦落主 CTA（F3 fix）** —— W4 修 V4 MINOR-F3：showModal 后 `primaryRef.current?.focus()`，但同 commit phase 内 `setName(initialName)` 触发的 re-render 会重置焦点。修复：focus 调用包进 `requestAnimationFrame(() => primaryRef.current?.focus())` 并 cleanup `cancelAnimationFrame`，落到 React re-render settle 之后；`reduced-motion` 路径不受影响（`requestAnimationFrame` 在 reduced-motion 下仍触发，仅回调内不读偏好）。回归断言：`.omx/evidence/ulw/ulw-name-login-one-truth/w4-f23-verify.mjs` step 2 — `document.activeElement.dataset.testid === 'sync-confirm-confirm'`；RoomGateDialog 同源。

- **浏览器 QA 探针的 BASE_URL 必须来自 `tests/qa/lib/browser.mjs` 的 `BASE_URL` 导出，不要硬编码 `http://localhost:3000`（F5 fix）** —— W4 修 sw-console-hygiene step05 陈年硬编码 `http://localhost:3000/_next/static/media/...woff2`（dev 用 3000 / QA 用 3101，:3101 必 FAIL）。修复后改读页面 `link[rel="preload"][as="font"]` 的 href 并用 `new URL(href, base).toString()` 拼 BASE；fallback 仍走原 hash。其它探针已经走 `BASE_URL` env 变量，零硬编码。

- **eslint `globalIgnores` 必须包含 `.delta/**`（F8 fix）** —— W4 修：`.delta/worktrees/**` 是 `git worktree add` + 重元工具的沙箱（不入仓，`.git/info/exclude` 本地排除），`pnpm lint` 之前把扫描到这堆陈年源码上，11 条 warnings 全是 stale 沙箱里来——和 vitest（`.vitest-tmp/**`）和 stryker（`.stryker-tmp/**`）三工具配置不一。W4 同步在 `eslint.config.mjs` 加 `.delta/**`，回归到「0 errors 0 warnings」基线。

- **dev 冷启 EMFILE 风暴（上游 #93175 OPEN，已知问题）** —— 现象：`pnpm dev` 冷启后 watchpack 连续吐 `EMFILE: too many open files, watch`（dev-repro.log 实测 ~668 次失败），随后误判 `.next/dev` was deleted 进入 22s/次重启环（33 次复现），服不可用。根因非 fd 耗尽——进程仅开 17 fd、`ulimit -n` 1048575 仍复现；系 watchpack 逐目录 watch × 本仓 `node_modules/.pnpm` 共 5,803 目录撞 macOS FSEvents 每进程流上限（源码 `node_modules/next/dist/server/lib/router-utils/setup-dev-bundler.js:864` `wp.watch({directories:[dir]})`）。止血：**`WATCHPACK_POLLING=true pnpm dev`**（dev-polling.log 实测 :3009 → 0 EMFILE / 0 deleted / HTTP 200，轮询绕开原生 `fs.watch`；Turbopack Rust watcher 无恙）。**放大器（主公现场 A/B 实证 2026-09-19）**：每个开着 :3000 的标签页持有一条 HMR websocket，服务下线期间持续重试、复活瞬间同时重连——恰逢 watcher 构建最脆弱窗口，并与 deleted 重启环逐轮互相放大；主公实测「残页开着 + 冷启 → 必炸；关残页后冷启 → 干净」。操作纪律：**重启 dev 前先关闭指向 :3000 的残页，Ready 后再开页面**（轮询模式对此免疫）。上游 vercel/next.js **#93175**「Turbopack dev on macOS hits Watchpack fs.watch EMFILE on ancestor directories」2026-04-24 起 OPEN，Next 16.3.4→16.3.5 未动 watcher 文件，未修；今日上游 #98003 合并仅做 pnpm Global Virtual Store symlink 解析，pnpm 目录农场 × Turbopack 系上游活跃战区。摘除条件：上游正式修复版落地后复测冷启 30s 无 EMFILE 即可移除本条 + dev script 注记（`.omo/plans/ulw-dev-emfile-watch.md` + 证据 `.omo/evidence/ulw/ulw-dev-emfile-watch/`）。

- **主公 :3000 dev 服在线期间禁止在主 worktree 跑 `pnpm build`（构建冻结反模式）** —— 2026-09-19 实证：今夜波次十余次产线 build 清写 `.next/` 连带删除 `.next/dev`，触发 dev 服「`.next/dev` was deleted」重启环撞死服务。`pnpm build` 删 `.next` 是 Next.js 正常行为（plan §0 根因链第 3 条），与 dev 服争用同一目录即双向伤害——build 期间 dev 不可用 / build 完了 dev 也回不来（除非重启）。对策：**波次构建一律独立 git worktree**（沿 ../ttt-wa 模式，产线 build 在 worktree 内跑；零触主 worktree `.next/`），或与主公协调构建窗口（dev 服短暂停服再 build）。任何「主 worktree 跑 build 但同时保 dev 在线」的尝试都是反模式，物理上不可能。

## 项目特有风格

- 桌面优先的暗色 UI；移动端保持可用，但不是优化目标。
- 音效默认静音，本地持久化，并在用户手势后懒创建 AudioContext。
- 所有装饰性动效都有 prefers-reduced-motion 下的无动效路径。
- 稳定的 data-testid 节点是 QA 契约，包括不接收交互的彩纸层。
- 胜局探针使用 0,3,1,4,2，保证随机先手总能赢上排。
- 路由命名遵循 offline/online（schema.org 词汇表对齐）；不引入 solo/ranked/singleplayer/multiplayer。
- 「房间」是这台设备上这组人的战绩账本标识（pass-and-play 同设备对战语义）；W3 D-3 一步到位迁移：API 路径 `/api/rooms/*`、DB 列 `room TEXT UNIQUE`、localStorage key `ttt.room.name.v1`、代码符号 `roomName` / `RoomGateDialog` / `RoomGateMount` / `HomeStatsEntry`。旧 `ttt.player.name.v1` 启动期被 `cleanupLegacyPlayerNameKey` 单向清除，不迁移；旧 `PlayerNameForm` / `OnlineStatsCard` / `/api/sessions` / `/api/players/{name}/stats*` 整体退役。术语红线：用户可见文案零「玩家名 / 注册 / 登录」作为现役概念，详见 [`.omo/plans/ulw-room-migration-home-landing.md`](.omo/plans/ulw-room-migration-home-landing.md) §1 + [CONTEXT.md](CONTEXT.md)。

## 命令

    pnpm dev
    pnpm build && pnpm start
    pnpm test
    pnpm typecheck && pnpm lint
    pnpm test:coverage
    pnpm test:mutation
    node tests/qa/visual-qa.mjs
    # 探针通常用 :3101 hermetic 库
    DATABASE_URL=file:/tmp/ulw-og2v/<unique>.db PORT=3101 pnpm start &
    BASE_URL=http://localhost:3101 node tests/qa/one-identity-qa.mjs

## herdr 多代理 session 卫生

- 起子任务必起新 agent session；同一 worktree 同一时刻只允许一个 agent 写入，只读角色（reviewer / auditor / explorer）才可真并行。
- 退出前 capture session id 到仓库内 `.omo/sessions.local.md`（现采现记，id 会轮换），再 /exit → `herdr pane close`；关 pane 不销毁会话。
- 完整协议（命令细节、resume、pane ≠ session、实证背景、否决项）见 [docs/herdr-session-hygiene.md](docs/herdr-session-hygiene.md)。

## 调度者（多代理编排）

- 大 plan 以「一个调度者 + 多个正交委托代理」执行：调度者只做拆解、派发、轮询、独立验收、收尾沉淀，几乎不亲自写主线代码。
- 委派协议：接收方先用自己的话复述任务与验收标准（teach-back）再动手；任何委托产出在独立验证前一律视为未完成。
- 完整可复用模板（四层职责 / 工具面 / 五段派发结构 / 轮询节奏 / 升级规则 / 反模式）见 .omo/plans/dispatcher-roles-retrospective.md §4。

## 运行时能力边界与任务分派（2026-09-18）

- 任何委派先匹配「任务类型 ↔ 运行时工具面」；真源 `~/.hermes/references/ag-agent-runtime-capability-boundaries.md`（Router 镜像 `~/.hermes/AGENTS.md` § 2 第 21 条）。速查：Pi（0 插件 = bash/read/write/edit）只接单文件小修 / 脚本验证 / 小样板，禁派跨文件重构（无 LSP）；omp（LSP+DAP+哈希锚定）接跨文件重构 / DAP 排错 / 调用链追溯；宏大长程目标先拆解，不直派任何单会话 runtime。
- 验收与 runtime 解耦：不管谁执行，§验证门禁六层全绿才准提交；能力差异只影响「谁来写」，不影响「怎么验」。
- 视觉/UI 验证走仓库内 tests/qa/*.mjs headless 探针（断言 data-testid 与网络行为）+ 截图由多模态模型直读——默认态无浏览器工具不构成障碍（模型视觉能力 + 仓库内 Playwright 集成已覆盖）；禁的是不跑探针、不看截图的凭空「确认样式」（浏览器 QA 仍用生产构建，见 §本项目反模式）。
- lib/game.ts / lib/store.ts 高危面任务优先派带 LSP 与完整测试工具面的 runtime，或由调度者代跑 on-demand 三层（coverage / mutation / property-based）；低能力 runtime 不得以「语法正确」宣布完成。
- .omo/plans/ 设计记录先行 + wave 拆解与 wayfinder「地图 + 工单」同构：plan = 地图，wave/task = 工单；每个子任务新开干净 session（见 §herdr 多代理 session 卫生）。设计记录：.omo/plans/agent-runtime-boundaries.md。

## 备注

- lib/db.ts 通过 @libsql/client + Drizzle 初始化并缓存 libsql 客户端；测试通过 DATABASE_URL/临时目录隔离，并调用 closeDb()。
- 战绩表是 per-room 单行族（`room TEXT UNIQUE`，W1 列名从 name 改名），不是单行 id=1。即使 POST 失败，本地 UI 状态仍保持正确。
- next-env.d.ts 是已跟踪的生成文件；切换构建模式时，它的引用发生变化是合理的。

# 贡献指南

本区块由项目维护，不是 next dev 再生成的内容。它是本仓库的权威贡献和验证契约；自 2026-09-12 起为 Router 形态——本区块只留 digest，细节见指向文档。

## 提交约定

- Conventional Commits + 正文 WHAT / WHY / HOW。两类提交不混装：prompt(<scope>): 供 AI 审查消费；feat/fix/refactor/test/docs/chore/build/ci/perf 为常规提交。
- 默认中文提交：type/scope token 与 lore trailer 键名保留英文，描述与正文用中文。
- 非平凡提交必须带全套 lore trailer（Constraint / Rejected / Confidence / Scope-risk / Directive / Tested | Not-tested）+ Plan: .omo/plans/<slug>.md 页脚（设计记录先行）。
- 禁止 `git commit --no-verify` 绕过 commit-msg hook；tests/qa/commit-audit.mjs 是策略真源。
- 五步流程、正文 schema、中文三例外、原子提交、设计记录、PR 大小（<500 LOC / <10 代码文件）、hook 机制：全部见 [docs/commit-policy.md](docs/commit-policy.md)。

## 验证门禁

每 commit 必跑六层，全绿才准提交：① `pnpm vitest run`；② `pnpm typecheck`；③ `pnpm lint`；④ `pnpm build`；⑤ `node tests/qa/commit-audit.mjs --branch main` 0 violations；⑥ 触及浏览器界面时跑 tests/qa/*.mjs 探针。

on-demand 三层（coverage / mutation / property-based）按改动 scope 触发；触发规则、thresholds、Tested trailer 模板、engines.node 三环境对齐契约，全部以 [docs/verification-gauntlet.md](docs/verification-gauntlet.md) 为 single source of truth，本文不重复。

## commit-msg hook

.git/hooks/commit-msg 会调用 node tests/qa/commit-audit.mjs --message-file "$1"。消息不合规时提交失败；禁止用 git commit --no-verify 绕过。需要独立校验时使用 pnpm exec commitlint --edit <message-file>。

<!-- END:project-contribution-guidelines -->
