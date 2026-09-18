<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-contribution-guidelines -->
总是使用中文进行回复。
# 项目知识库

> Router 形态：本文件只做最小路由与 digest，细节在各节指向的 docs/ 与 .omo/plans/ 文档，按需读取（2026-09-12 瘦身，Plan: .omo/plans/agents-md-slim.md）。

**生成时间：** 2026-09-12
**提交：** d9acf4c
**分支：** main

## 概览

两人同设备对战的井字棋，战绩自动持久化。技术栈是 Next.js 16 App Router、React 19、strict TypeScript、Tailwind v4 设计令牌、Zustand、Drizzle ORM 和 @libsql/client（本地 file: sqlite / Vercel 走 Turso HTTP）。

## 结构

    .
    ├── app/               # 三个页面路由、战绩 API、全局字体和设计令牌
    ├── components/        # 棋盘、音效/彩纸客户端组件，以及 ui/ 基础组件
    ├── lib/               # 纯规则、客户端 store、浏览器效果、SQLite I/O
    ├── db/                # Drizzle schema：game_stats 单行表
    ├── tests/qa/          # 面向生产服务的 Playwright 探针和提交审计
    ├── docs/              # 面向人的测试、运维和经验记录
    ├── .omo/plans/        # 非平凡提交必需的设计记录
    └── data/              # 已忽略的 SQLite 运行数据库

## 查找入口

| 任务 | 位置 | 说明 |
| --- | --- | --- |
| 路由或 API 行为 | app/ | 客户端页面和 Node runtime 的 /api/stats 与 /api/stats/outcome |
| 规则、战绩、持久化 | lib/game.ts、lib/store.ts、lib/db.ts、db/schema.ts | 纯规则不依赖 React/DOM |
| 视觉和无障碍契约 | DESIGN.md、app/globals.css、components/ | 设计令牌与全局 focus 所有权是契约 |
| 浏览器验证 | tests/qa/ | 先 pnpm build && pnpm start，不要用 dev server |
| 提交策略 | 下方贡献指南 | tests/qa/commit-audit.mjs 和 Git hook 共同强制 |
| 既有设计理由 | .omo/plans/*.md | 非平凡提交必须引用 Plan footer |

## 代码地图

中心度基于 `grep -rln` import 扫描（项目无 LSP / codegraph 工具暴露给 agent；文件级中心度 = 直接 import 该文件的源文件数，含 co-located `*.test.ts`）。粗扫精确度受 import path 别名与 barrel re-export 影响，需要时跑一遍 `grep -rln "from .*lib/X['"]"` 自验。

| 符号/模块 | 类型 | 位置 | 引用点 | 作用 |
| --- | --- | --- | --- | --- |
| game | 纯规则 + 战绩 | lib/game.ts:1 | 9（4 prod + 5 test） | 棋盘、胜负、落子、连胜、streakLabel |
| useGameStore | Zustand store | lib/store.ts:72 | 10（9 prod + 1 test） | 局面阶段、落子、API 同步、AbortController |
| stats API | Route handlers | app/api/stats/{route,outcome/route}.ts | 1 prod + 8 QA + 1 test | GET/PUT/DELETE 全行 + POST outcome 服务端权威增量 |
| solo-stats API | Route handlers | app/api/solo-stats/{route,sync/route}.ts + app/api/player-session/route.ts | 3 prod + 9 QA + 3 test | GET 读行（仅 GET）/ PUT 405 method-not-allowed（存名退役）/ POST /sync 跨设备 per-field 合并（name 行不存在返 409 防静默建档）/ POST /api/player-session 注册/登录（返回 {stats, existed}） |
| lib/db solo | DB helpers | lib/db.ts:loadSoloRecord/upsertSoloRecord/mergeSoloRecord/registerOrLoginName/accumulateMergeStats | 6（5 prod + 1 test）| 单表 game_stats（含 name 列 UNIQUE）的 read→mutate→upsert 单线；registerOrLoginName 幂等注册/登录；accumulateMergeStats 纯函数 per-field 相加 |
| lib/solo-net | 浏览器 HTTP | lib/solo-net.ts:fetchSoloStats/postPlayerSession/postSoloSync | 4 prod + 2 test | withTimeout 8s + {ok,value}/{ok,reason} 契约；PUT 已退役（putSoloName 删除） |
| OnlineStatsCard | 只读展示 | components/OnlineStatsCard.tsx:1 | 1 direct（app/page.tsx） | GET /api/solo-stats 响应只入组件 state；严禁写 localStorage / store.solo（A2 红线） |
| HomeDialogMount | 首页 effect | components/HomeDialogMount.tsx:1 | 1 direct（app/page.tsx） | HomeDialogMount effect 监听 pathname/focus/visibility/storage 事件，pendingSyncCount()>declinedSentinel → 打开 SyncConfirmDialog |
| PlayerNameForm | 身份区 | components/PlayerNameForm.tsx:1 | 1 direct（app/page.tsx）+ 1 test | 注册/登录语义（POST /api/player-session）；422 错误就地展示；localStorage → store 反向 hydration（防 soft-nav 丢身份） |
| lib/solo-stats | localStorage | lib/solo-stats.ts:SOLO_STATS_KEY/SOLO_SYNCED_SERVER_KEY + load/persist/clear | 2 prod + 1 test | 浏览器战绩持久化 + 同步哨兵（防 double-count） |
| SyncConfirmDialog | 原生 modal | components/SyncConfirmDialog.tsx:1 | 1 direct（HomeDialogMount）+ 1 test | 内嵌 name 流 + 主「合并战绩」/ 次「保留本地」 + n/24 计数 + ESC 关 + reduced-motion；合并时自己跑 postPlayerSession + postSoloSync（合并 row 透传 onConfirm） |
| Board | 有状态 UI | components/Board.tsx:26 | 1 direct（/play）；间接经 PlayController/ResultBanner 等消费 | roving focus、键盘输入、落子动画 |
| launchQA | Playwright 启动器 | tests/qa/lib/browser.mjs:7 | 9 探针 | 统一 Chromium、context、autoplay policy |

库与 QA 都靠 `lib/game.ts` 与 `lib/store.ts`；store 是浏览器内单例。修改这两文件必跑对应 vitest / Stryker / fast-check（见 §验证门禁）。

## 约定

- 修改路由、handler、类型或生成文件前，先阅读上方 Next.js 16 自动警告。
- Server Component 是默认；只有交互或浏览器 API 需要时才添加 'use client'。
- 路径别名 @/* 指向仓库根目录；规则放 lib，schema 放 db，UI 组合放 components。
- 设计令牌保存在 app/globals.css 和 DESIGN.md；Tailwind class 引用令牌。
- 提交主题和正文可以中文；Conventional 前缀与 lore trailer 键名保持英文。

## 本项目反模式

- 已有命名令牌时，不要使用 Tailwind 原生色板或内联 hex。
- 不要在 SSR 首帧读取 localStorage；先渲染安全默认值，再用 useEffect 同步。
- 不要引入 UI、路由、动画、数据访问或表单库；这些是项目约束明确排除的。
- 不要使用 div onClick、emoji 图标、组件级 focus ring，或新增第二个水合触发点。
- 不要用 --no-verify 绕过 commit-msg hook。
- 契约要求生产构建时，不要对 dev server 跑浏览器 QA。
- **LSP 服务端工具（typescript-language-server / yaml-language-server / bash-language-server）走 vp 全局安装，禁止作为项目 npm 依赖** —— 它们是 Codex `lsp.*` MCP 的语言服务端，永不进 Next.js runtime bundle。`.codex/lsp-client.json` 是被 git 跟踪的共享配置，**必须可移植：只写 id / priority / disabled / env 级覆写，禁止 install hash 或机器本地绝对路径**（曾因写入 vp hash 的 `initialization.tsserver.path` 导致 fresh clone 即坏 + 本机重装静默失效）。TLS 的 typescript 由 codex-lsp initialize 恒带的 workspaceFolders 解析到项目 devDep `typescript` 的 `node_modules/typescript/lib`，无需任何 override；per-machine override 写 user 级 `~/.codex/lsp-client.json`（不入库）。任何 LSP 改动必须：(1) 三个 server 通过 `vp add -g` / `vp rm -g` 同步增删；(2) `.codex/lsp-client.json` 保持无机器本地路径并同步；(3) `pnpm vitest run` + `pnpm typecheck` 确认不破 Gauntlet。详见 `.omo/plans/lsp-revert-to-global.md` 与 `.omo/plans/lsp-client-portable-config.md`。
- **RSC 页面读取可变数据必须声明 `dynamic = 'force-dynamic'`** —— Next.js 16 默认静态优化可能烘焙 build-time 异步数据（如 Drizzle DB 调用）的结果到 HTML，runtime 返回脏数据直到下次 build。B-3a 实证：首屏 HTML 显示旧战绩而 DB 已是新战绩。
- **Service Worker fetch handler 必须按方法门控** —— `event.respondWith(fetch(event.request))` 无门控会让 PUT/POST/DELETE 被发两次（浏览器观察到两条 outbound 请求）。可安装但不缓存的 SW 范式：`if (event.request.method !== 'GET') return;` 后再 respondWith。B-1 实证：生产 DevTools Network 面板观察到 2 行 PUT。
- **store 的网络写 action 必须返回 Promise** —— 让调用方可以 await 后再调 `router.refresh()`。在 `force-dynamic` 下无需 `revalidatePath`（冗余）；在 ISR 下 Route Handler 必须调 `revalidatePath('/')` + `revalidatePath('/result')`。B-2 + B-3b 实证：setTimeout 700ms 与 PUT 落库时刻不固定；resetAll fire-and-forget DELETE 后同步 router.refresh() 会读到旧值。
- **网络写 action 必须带 AbortController timeout** —— Turso HTTP 在 iad1 偶发 30 s 默认 fetch 超时；client 必须主动 8 s `AbortController.timeout()` abort + Button `loading` state + 强制 disabled，否则重置战绩按钮会卡 30 s 不响应。HAR §P2 实证：线上抓到一个孤立 DELETE 200 time=30733 ms。
- **静态资源缓存必须双层** —— `_next/static/**` 已被 Vercel 边缘 immutable 缓存；但 `manifest.webmanifest` / `icon.svg` / `apple-icon*` / `favicon*` / `icon-*.png` 默认 `max-age=0, must-revalidate` 会让浏览器每次 nav 都 304 roundtrip（50-200 ms）。必须 `next.config.ts headers()` + SW cache-first 双层。HAR 直读实证：单次 PWA 会话 56-94 次 manifest 请求 + 头 = `max-age=0`。
- **仓库内任何"清理/迁移/deslop"批量文件操作必须走 git 通道：删 tracked 文件前先 commit，删 untracked/ignored 内容前先备份** —— worktree-only 删除可由 `git ls-files -d -z | xargs -0 git checkout --` 一条命令恢复，但 ignored 内容（如 `.omx/backups` 备份 tar）被删即永久丢失。2026-09-12 00:00:08-23 实证：40 个 tracked 文件（全部属于最后提交日期 2026-09-07 的 cohort）+ `.git/hooks` + `.omx/backups/repo.git.tar` 在 15 秒内被未知进程按清单删除；同波进程还触碰了 /tmp 顶层 35 个不相关目录。
- **herdr 多 pane 工作区内，同一 worktree 同时只允许一个 agent 写入；午夜定时任务窗口（00:00±15min）不做绕过 git 的批量文件操作** —— 2026-09-12 实证：仓库删除（00:00:08-23）与 `/tmp/hooks-v2` 空骨架创建（00:00:15）交错 6 秒，指向同一迁移脚本中途停止；三个 herdr pane 的会话转录在窗口内均零条目，hermes 生态 4 个 cron 同窗触发但无一认领删除行为——reflog/index 零记录证明它绕过了 git。
- **commit-msg hook 位于 `.git/` 内，git 永不跟踪；重建只能靠文档契约，重建后必须双向冒烟** —— 契约三源：docs/commit-policy.md §commit-msg hook、`.omo/plans/commit-policy-enforcement.md`与 `.omo/plans/recovery-from-unknown-cleanup.md` 附录 B（audit 脚本是策略真源，hook 委托 audit）。任何 commit（含 `fcbde26f`）都不含 hook 原件；`.git/HEAD` 丢失用 `echo 'ref: refs/heads/main' > .git/HEAD` 恢复；hook 重建脚本见 `.omo/plans/recovery-from-unknown-cleanup.md` 附录 B。
- **solo by-name 同步：客户端禁止手动 PUT solo 全行，POST 只发单个 outcome** —— 与 ranked 同根约束。`lib/db.ts:accumulateSoloRecord` 是 solo server 侧权威累加点（read → recordOutcome → upsert）；客户端仅 POST `{name, outcome}` 收 server 回传的 `{stats}`。`components/SoloStatsPanel.tsx` 的「同步」按钮在无 pending 时退化为纯 GET 刷新，避免 double-count footgun。
- **`ttt.player.name.v1` 白名单必须与 `app/api/solo-stats/route.ts` `normalizeName` 同源** —— trim → 1–24 字符 → 禁 `< 0x20 / 0x7F / 0x80–0x9F` 控制字符；`lib/player-name.ts:isPlayerName` 是单一客户端真相，DRIFT = 「保存名字 → POST 422」坏 UX。
- **未命名 solo 路径零新增网络行为** —— `SoloStatsPanel` 用 `playerName` 三元 if 而非无条件 GET 是 wave 2 §A5 验收硬约束（sync-qa step 01 探针断言）；任何「顺手 GET 一次」改动都破坏该契约。
- **同名并发故意 last-write-wins，README 注明边界** —— 不做 CRDT / 时间戳合并；单机 UX 场景下「跨设备累加足够」，过度合并引入「为什么不同步删除」的迷惑。
- **solo 100% 纯本地——store 不再 auto-POST，跨设备走首页拦截弹框** —— W1+W2 收尾（.omo/plans/ulw-solo-pure-local-closeout.md §1 + ulw-name-login-one-truth.md §1 G1）：`lib/store.ts` 的 `makeMove` 在 solo 分支只调 `recordOutcome(internalStats, outcome)` + `persistSoloStats(...)`，不发任何 fetch；`retrySoloSync` action + `soloSync{pending,inflight,error}` 字段整段删除（W2 CR P2）。具名玩家与匿名玩家一致——零网络写。「合并并清空」只在首页 `StartGameButton` 拦截弹框（pendingSyncCount>0）触发 `SyncConfirmDialog` → `lib/solo-net.ts:postSoloSync` → `lib/db.ts:mergeSoloRecord` 服务端 per-field 累加 → 客户端 `clearSoloStats()` + `persistSyncedServerTotal(merged.totalGames)`。

- **PUT /api/solo-stats 已退役（405）** —— W3（ulw-name-login-one-truth §3）：注册/登录语义改走 `POST /api/player-session`，PUT 存名路径不再需要；handler 改为 `return 405 + Allow: GET`（任何旧客户端 curl PUT 应看到清晰错误）。`lib/solo-net.ts:putSoloName` 同步删除（无调用方）。新契约：PlayerNameForm submit 后 `await postPlayerSession(trimmed)` → 服务端返 `{stats, existed}` → 仅在 ok=true 时写 localStorage + store.playerName（422 / network / aborted → 就地展示错误，不写任何持久层）。
- **POST /api/solo-stats/sync 是「用户主动确认的合并」接口，body 接 `{name, stats: GameStats}`** —— wave 2「合并需弹框问询」契约（B-T2/B-T3/B-T4）：server 端 read→`accumulateMergeStats` per-field 相加→upsert→返回合并后 `{stats}`，幂等（同一 stats 第二次 POST 会双计——这是 why 客户端在成功后 `clearSoloStats()` + 写 sentinel `persistSyncedServerTotal(mergedTotal)` 防再点）；调用方必须在 SyncConfirmDialog 主 CTA 「合并并清空」按下后才发，「保留本地」零网络写。
- **同步哨兵 `ttt.solo.server.synced.v1` 锁死「未同步 = 本机 ahead」语义** —— W1 §A5「无 pending 退化为纯 GET」契约（B-T4）的实现机制：哨兵由 `SoloStatsPanel.confirmSync` 在「合并并清空」成功时写 `persistSyncedServerTotal(r.value.stats.totalGames)`（不再是 store——store 不再 auto-POST，无写点）；SoloStatsPanel 在每次 GET 成功时同步刷新（跨设备 fresh context 拉到即认）；`handleSync` 改用 `pendingSyncCount = max(0, local.totalGames - synced)` 决定开 dialog 还是退化为纯 GET。手动 sync 成功后清本地 + 把哨兵更新为 merged total，下一次 sync 必然 diff=0 → 纯 GET。
- **W2 solo 页纯净化：`/solo` 零 name、零网络、零同步按钮、零 PlayerNameForm** —— `.omo/plans/ulw-name-login-one-truth.md` §1 G1：`components/SoloStatsPanel.tsx` 仅渲染「单机战绩」+ `StatsGrid` + `ResetStatsButton(scope='local')`，不再挂载按名 GET、不再内嵌存名或同步按钮、不再渲染 `SyncConfirmDialog`；`app/solo/page.tsx` 渲染树零 `PlayerNameForm` 零网络组件。pure-local-qa A4 step 断言：预设 `ttt.player.name.v1` + 挂载 `/solo` → 全程 `/api/*` 请求数 = 0；以下 testid 在 **`/solo` 路由**下 0 命中：`solo-sync`、`sync-confirm-dialog`、`sync-confirm-desc`、`sync-confirm-confirm`、`sync-confirm-reject`、`solo-stats-merge-note`、`solo-stats-error`、`player-name-section`。`sync-confirm-*` / `player-name-section` 仍在 home 页由 `HomeDialogMount` 触发弹框 + `PlayerNameForm` 渲染（W3 改造面完成），不是代码失效；`tests/qa/sync-qa.mjs` / `tests/qa/merge-sync-qa.mjs` 头部注释标注 DISABLED 是它们原本就是探 `/solo` 同步按钮的 probe；W3 已上 `tests/qa/home-return-qa.mjs` 重建跨设备同步的探针覆盖（A3 全路径 + A7 fresh-context 跨设备只读恢复）。
- **POST /api/solo-stats 单局累加端点已删除** —— W2 `lib/solo-net.ts:postSoloOutcome` 无调用方，server-side `app/api/solo-stats/route.ts` POST handler 整段删除；`lib/db.ts:accumulateSoloRecord` 同步删除；对应 `tests/api/solo-stats.test.ts` POST describe + `tests/db/db.test.ts` 5 个 accumulate 集成测试 + `tests/lib-solo-net.test.ts` postSoloOutcome describe 同步清理。`curl -X POST /api/solo-stats` 期望 `405 method not allowed`；GET（按名查 row）通；PUT（存名落库）W3 起返 405（注册/登录改走 `POST /api/player-session`），由 PlayerNameForm 注册/登录 + HomeDialogMount 触发弹框继续消费。

- **首页「开始对战」/「单机练习」点击零拦截（pure-local 时）** —— W3（ulw-name-login-one-truth §1 D1）：StartGameButton 整段删除 pendingSyncCount 拦截逻辑 + onAfterConfirm 导航回调；点击即直行 `startGame(mode) + router.push(href)`。SyncConfirmDialog 不再由 StartGameButton 渲染，改由 `components/HomeDialogMount.tsx`（mount 在 app/page.tsx 末尾）的 effect 监听 `pathname='/'` + focus + visibilitychange + storage 事件触发；`pendingSyncCount() > declinedSentinel` 才开 dialog，否则静默直行。`onAfterConfirm?: () => void` 保留以备未来「navigate after merge」调用方（当前 HomeDialogMount 不传该 prop）。
- **首页线上战绩只读卡：响应只入组件 state（A2 红线）** —— W3：`components/OnlineStatsCard.tsx` 通过 `GET /api/solo-stats?name=` 拉取服务端战绩 row，response **只写 `useState<LoadState>`**，**严禁**写 localStorage（`ttt.solo.*` 任何 key）或 `useGameStore.soloStats` / 任何 store 字段；`name` 取自 `useGameStore.playerName`（仅读）。「登录已有名 → 浏览线上战绩卡前后 localStorage 快照逐字节一致」是 home-return-qa step 07 的硬断言。组件状态机 idle→loading→ok/empty/error；error 行就地展示，不污染持久层。
- **`ttt.solo.sync-declined.v1` sessionStorage 哨兵（保留本地时不重弹）** —— W3：D3 决策「保留本地 → 零网络写 + 同会话 pending 无增量不重弹」的实现机制。`SyncConfirmDialog` 不直接写 sessionStorage；由 `components/HomeDialogMount.tsx` 的 onReject handler 写 `writeDeclinedPending(pendingSnapshot)`；`loadDeclinedPending()` 在 mount effect 中读取参与判断。`sessionStorage`（非 localStorage）保证关标签页即忘——新会话总是从 declined=0 重新计算。`clearDeclinedPending()` 在合并并清空成功后被 HomeDialogMount 调，清后下次访问 pending=0 → dialog 不开。
- **POST /api/solo-stats/sync 409 防静默建档** —— W3：服务端在 merge 前必须先 `loadSoloRecord(name)`；row 不存在 → 409 `player session required`（不允许「merge 一个未注册 name」被偷渡成 upsert 复活已删除账号）。弹框流强制保证先 hit POST /api/player-session（注册/登录）才许调 /sync；客户端 `SyncConfirmDialog.runMergeSequence` 把 409 翻译成「需要先登录该账号才能同步（请重新输入名字）」就地展示，不调 onConfirm。server 端 `loadSoloRecord` 是 sync handler 唯一的 row-existence probe（mergeSoloRecord 内部的 read-then-upsert 是私有实现，不参与 409 判定）。
- **PlayerNameForm 反向 hydration：localStorage → store** —— W3：`PlayerNameForm` 的 useEffect 读 store.playerName；若为空但 localStorage `ttt.player.name.v1` 有值，调 `setStoreName(stored)` + setName(stored)。这是 home-return 路径上 OnlineStatsCard 能立即 fetch 的前提——soft-nav /solo → / 时 store 是空的（Zustand 模块单例在客户端跨 nav 保留，但若 SSR-first-frame 的 RSC 树没有预跑 StatsHydrator 类似的 store seed，store 会保留旧值；为防 soft-nav 边缘 case 让 store 跟着 localStorage 走）。注：hard reload 时 localStorage 是 source of truth；soft nav 时 store 优先（最新 setStoreName）。

## 项目特有风格

- 桌面优先的暗色 UI；移动端保持可用，但不是优化目标。
- 音效默认静音，本地持久化，并在用户手势后懒创建 AudioContext。
- 所有装饰性动效都有 prefers-reduced-motion 下的无动效路径。
- 稳定的 data-testid 节点是 QA 契约，包括不接收交互的彩纸层。
- 胜局探针使用 0,3,1,4,2，保证随机先手总能赢上排。

## 命令

    pnpm dev
    pnpm build && pnpm start
    pnpm test
    pnpm typecheck && pnpm lint
    pnpm test:coverage
    pnpm test:mutation
    node tests/qa/visual-qa.mjs

## herdr 多代理 session 卫生

- 起子任务必起新 agent session；同一 worktree 同一时刻只允许一个 agent 写入，只读角色（reviewer / auditor / explorer）才可真并行。
- 退出前 capture session id 到仓库内 `.omo/sessions.local.md`（现采现记，id 会轮换），再 /exit → `herdr pane close`；关 pane 不销毁会话。
- 完整协议（命令细节、resume、pane ≠ session、实证背景、否决项）见 [docs/herdr-session-hygiene.md](docs/herdr-session-hygiene.md)。

## 调度者（多代理编排）

- 大 plan 以「一个调度者 + 多个正交委托代理」执行：调度者只做拆解、派发、轮询、独立验收、收尾沉淀，几乎不亲自写主线代码。
- 委派协议：接收方先用自己的话复述任务与验收标准（teach-back）再动手；任何委托产出在独立验证前一律视为未完成。
- 完整可复用模板（四层职责 / 工具面 / 五段派发结构 / 轮询节奏 / 升级规则 / 反模式）见 .omo/plans/dispatcher-roles-retrospective.md §4。

## 备注

- lib/db.ts 通过 @libsql/client + Drizzle 初始化并缓存 libsql 客户端；测试通过 DATABASE_URL/临时目录隔离，并调用 closeDb()。
- 战绩表唯一行是 id=1；即使 PUT 失败，本地 UI 状态仍保持正确。
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
