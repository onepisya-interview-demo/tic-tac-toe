# Anti-patterns

> 来源：AGENTS.md §本项目反模式（行 92–147）

按 L0/L1/L2 分三档，每条保留原 AGENTS.md 的判定理由。**L0 是结构硬约束——漏则破契约，必须每会话自动加载（已内联 AGENTS.md）**；L1 是高频契约——路由指针 + 一行 digest；L2 是按需读——仅特定任务时参考。

## L0（必须内联，漏则破契约）

### L0-1：service 层纯函数 / 传输层薄壳强制分离（GraphQL 双兼容预留）

W2 起（ulw-one-game-two-versions §0）：`lib/db.ts` 是 service 层，全部「读 / 改 / 写战绩」业务规则收敛为纯函数（无 HTTP 上下文、无 `NextResponse`、无 status code 知识）；调用方是 `lib/store.ts`（浏览器端）或 `app/api/**/route.ts`（Node runtime 端）。任意 transport（RESTful route / GraphQL resolver / gRPC handler）只做「解析入参 → 调 service → 映射返回值到 status code / problem+json」；不得在 transport 里再写一份「read → mutate → upsert」业务规则。GraphQL 双兼容仅需新增 schema + resolver，service 函数零改动。transport 层错误统一走 `lib/api-problem.ts:problemResponse`，RFC 9457 `application/problem+json`。

### L0-2：service 函数禁止返回 `Response` / `NextResponse` / `{ status: 404 }`

`lib/db.ts` 的函数返回值必须是纯数据 + 状态标记（命中 → `GameStats` / `{ stats, ... }`；缺失 → `null` 或具名 `not-found` 字符串；异常 → 抛 `Error`）。transport 层是唯一决定 status code 的地方。

### L0-3：已有命名令牌时不要使用 Tailwind 原生色板或内联 hex

设计令牌保存在 `app/globals.css` 和 `DESIGN.md`；Tailwind class 引用令牌。

### L0-4：不要在 SSR 首帧读取 localStorage

先渲染安全默认值，再用 `useEffect` 同步。React/RSC 水合边界硬约束。

### L0-5：不要引入新库

不引入 UI、路由、动画、数据访问或表单库；这些是项目约束明确排除的。

### L0-6：不要使用 div onClick、emoji 图标、组件级 focus ring，或新增第二个水合触发点

UI 边界与可访问性契约。

### L0-7：不要用 `--no-verify` 绕过 commit-msg hook

`.git/hooks/commit-msg` 是 gate；`tests/qa/commit-audit.mjs` 是策略真源。

### L0-8：契约要求生产构建时不要对 dev server 跑浏览器 QA

先 `pnpm build && pnpm start`（`:3101` hermetic 库），不要用 dev server。

## L1（高频契约——AGENTS.md 留一行 digest，外化文件载完整条）

### L1-1：`/offline` 路径零网络写

未命名 offline 路径零新增网络行为：`/offline` 路由全程 `/api/*` 请求数 = 0（`one-identity-qa` step 断言）；任何「顺手 GET 一次」改动都破坏该契约。

### L1-2：同名并发故意 last-write-wins

不做 CRDT / 时间戳合并；单机 UX 场景下「跨设备累加足够」，过度合并引入「为什么不同步删除」的迷惑。README 注明边界。

### L1-3：offline 100% 纯本地——store 不再 auto-POST

W1+W2+W3 收尾：`lib/store.ts` 的 `makeMove` 在 offline 分支只调 `recordOutcome(internalStats, outcome)` + `persistOfflineStats(...)`，不发任何 fetch；具名玩家与匿名玩家一致——零网络写。跨设备走首页 `HomeDialogMount` 弹框。

### L1-4：POST /api/rooms/{room}/stats/merge 是「用户主动确认的合并」接口

server 端 read → `accumulateMergeStats` per-field 相加 → upsert → 返回合并后 `{stats}`。调用方必须在 `SyncConfirmDialog` 主 CTA「合并并清空」按下后才发，「保留本地」零网络写。

### L1-5：同步哨兵 `ttt.offline.last-merged-local.v1` 跟踪合并后本机零位

W4 修复 V4 MINOR-F1：新模型存「合并完成时 `local.totalGames = 0`」基线，合并成功后 `HomeDialogMount.handleConfirm` 写 `persistLastMergedLocal(0)`。`pendingSyncCount = max(0, local.totalGames - lastMergedLocal)` 永远等于 local。`lib/offline-stats.ts:pendingSyncCount` 是单一客户端真相。

### L1-6：`/offline` 页纯净化

`components/OfflineStatsPanel.tsx` 仅渲染「单机战绩」+ `StatsGrid` + `ResetStatsButton(scope='local')` StatsGrid 无条件渲染；组件零 roomName 依赖，不挂载按 roomName GET、不内嵌存名或同步按钮、不渲染 `SyncConfirmDialog`、不渲染 `RoomGateDialog`。

### L1-7：首页「开始对战」/「单机练习」点击零拦截（pure-local 时）

W3：`StartGameButton` 整段删除 pendingSyncCount 拦截逻辑；点击即直行 `startGame(mode) + router.push(href)`。

### L1-8：首页零 API（A1 红线）

任意状态、任意 focus 行为下 `/api/*` 请求数 = 0。战绩展示主场归 `/result?room=` RSC（force-dynamic SSR 直读 DB）。`one-identity-qa` Q1 step 硬断言。

### L1-9：`ttt.offline.sync-declined.v1` sessionStorage 哨兵

W3：`SyncConfirmDialog` 不直接写 sessionStorage；由 `HomeDialogMount` 的 onReject handler 写 `writeDeclinedPending(pendingSnapshot)`。`sessionStorage`（非 localStorage）保证关标签页即忘。

### L1-10：POST /merge 409 防静默建档

服务端在 merge 前必须先 `loadRecordByRoom(room)`；row 不存在 → 409 `enter-room-required`。不允许「merge 一个未注册 room」被偷渡成 upsert 复活已删除账号。

### L1-11：POST /outcomes 404 防静默建档

`recordOutcomeForRoom(room, outcome)` 服务端 read → 命中则累加 upsert → 缺失返 `{ ok: false, reason: 'not-found' }`，transport 映射 404 problem+json。

### L1-12：POST /reset 清零保留身份、永不 DELETE 房间行

W-R：service `resetRecordByRoom`：load 命中 → upsert `emptyStats()` → 返回全零行；缺失 404。DELETE 行会让下一局记局必 404、记账闭环断裂——row 是身份不是数据。

### L1-13：ResultNavigator push 前必须 await 在途记局写

W-F：`makeMove` online 分支先 set phase 再 await POST outcomes；导航若不等待在途写，force-dynamic 的 `/result` RSC 直读 DB 会渲染旧行。store seam `pendingOutcomeWrite` + `awaitOutcomeWrite()` 吞错落定。

### L1-14：RoomGateMount 挂载期 identity bootstrap

W3 cace8f4 修补：`RoomGateMount` 的 useEffect 读 store.roomName；若为空但 localStorage `ttt.room.name.v1` 有值，调 `setRoomName(stored)`。同时执行 `cleanupLegacyPlayerNameKey()`。

### L1-15：/result 胜利庆祝由一次性 sessionStorage 哨兵门控

W-A：仅 `ResultNavigator` 见证 phase→'won'（平局不写）push 前写入；`ResultCelebration`（/result client 岛）读后即清、恰消费一次——刷新 / 书签 / 首页「查看战绩」入口（无哨兵）零庆祝。

### L1-16：online 需 room 契约由首页 CTA 延伸到 /online 页面本身

W-A2：直达 `/online` 有名 → mount 期 identity bootstrap；无名 → 页内就地开 `RoomGateDialog`（原生 showModal 令棋盘 inert），onReject 有意不关弹框。

### L1-17：RoomGateDialog 与 SyncConfirmDialog 弹框初焦落主 CTA

F3 fix：showModal 后 `primaryRef.current?.focus()`，但同 commit phase 内 `setName(initialName)` 触发的 re-render 会重置焦点。修复：focus 调用包进 `requestAnimationFrame(() => primaryRef.current?.focus())` 并 cleanup `cancelAnimationFrame`。

### L1-18：浏览器 QA 探针的 BASE_URL 不硬编码 :3000

F5 fix：探针必须读 `tests/qa/lib/browser.mjs` 的 `BASE_URL` 导出，不要硬编码 `http://localhost:3000`。

### L1-19：eslint `globalIgnores` 必须包含 `.delta/**`

F8 fix：`.delta/worktrees/**` 是 git worktree + 重元工具的沙箱（不入仓），`pnpm lint` 之前把扫描到这堆陈年源码上。W4 同步在 `eslint.config.mjs` 加 `.delta/**`。

## L2（按需读——AGENTS.md 完全外化）

### L2-1：LSP 服务端工具走 vp 全局安装

typescript-language-server / yaml-language-server / bash-language-server 走 vp 全局安装，禁止作为项目 npm 依赖。详见 [`.omo/plans/lsp-revert-to-global.md`](../.omo/plans/lsp-revert-to-global.md) 与 [`.omo/plans/lsp-client-portable-config.md`](../.omo/plans/lsp-client-portable-config.md)。

### L2-2：RSC 页面读取可变数据必须声明 `dynamic = 'force-dynamic'`

Next.js 16 默认静态优化可能烘焙 build-time 异步数据（如 Drizzle DB 调用）的结果到 HTML，runtime 返回脏数据直到下次 build。B-3a 实证：`/result` RSC 实时成绩单即强制声明此 flag。

### L2-3：Service Worker fetch handler 必须按方法门控

`event.respondWith(fetch(event.request))` 无门控会让 PUT/POST/DELETE 被发两次。可安装但不缓存的 SW 范式：`if (event.request.method !== 'GET') return;` 后再 respondWith。

### L2-4：store 的网络写 action 必须返回 Promise

让调用方可以 await 后再调 `router.refresh()`。在 `force-dynamic` 下无需 `revalidatePath`；在 ISR 下 Route Handler 必须调 `revalidatePath('/')` + `revalidatePath('/result')`。

### L2-5：网络写 action 必须带 AbortController timeout

Turso HTTP 在 iad1 偶发 30 s 默认 fetch 超时；client 必须主动 8 s `AbortController.timeout()` abort + Button `loading` state + 强制 disabled。`lib/store.ts:NETWORK_TIMEOUT_MS` 与 `lib/game-net.ts` 8s 约定同源。

### L2-6：静态资源缓存必须双层 + SW cache-bust

`_next/static/**` 已被 Vercel 边缘 immutable 缓存；但 `manifest.webmanifest` / `icon.svg` 等默认 `max-age=0, must-revalidate` 会让浏览器每次 nav 都 304 roundtrip。**SW cache 名必须随版本失效（W-OPT-c a380404）**：`scripts/sw-bust.mjs` 在 prebuild/prestart/predev 从 package.json version 注入 `APP_VERSION` 到 `public/sw.js` 的 `CACHE_NAME`，activate 时 sweep 清理非当前 cache。

### L2-7：仓库内任何"清理/迁移/deslop"批量文件操作必须走 git 通道

删 tracked 文件前先 commit，删 untracked/ignored 内容前先备份。2026-09-12 00:00:08-23 实证：40 个 tracked 文件 + `.git/hooks` + `.omx/backups/repo.git.tar` 在 15 秒内被未知进程按清单删除。

### L2-8：herdr 多 pane 工作区内，同一 worktree 同时只允许一个 agent 写入

2026-09-12 实证：仓库删除与 `/tmp/hooks-v2` 空骨架创建交错 6 秒，指向同一迁移脚本中途停止；reflog/index 零记录证明它绕过了 git。

### L2-9：DB schema 变更必须带 getDb reconcile + legacy 旧库迁移测试

任何对 `game_stats` 的列级变更必须在 `getDb()` bootstrap 后追加列探测 + 缺失即事务内重建。`tests/db/db.test.ts` 必须新增 describe「legacy DB migration」。详见 [`.omo/plans/ulw-hotfix-db-schema-drift.md`](../.omo/plans/ulw-hotfix-db-schema-drift.md)。

### L2-10：commit-msg hook 位于 `.git/` 内，git 永不跟踪

契约三源：`docs/commit-policy.md` §commit-msg hook、`.omo/plans/commit-policy-enforcement.md` 与 `.omo/plans/recovery-from-unknown-cleanup.md` 附录 B。

### L2-11：`ttt.room.name.v1` 白名单必须与 `lib/room-name.ts:normalizeRoom` 同源

W3 迁移：4 个 RESTful 端点全部 import `normalizeRoom` 作为 service-side 单一真相，`isRoomName` 是单一客户端真相。

### L2-12：dev 冷启 EMFILE 风暴（上游 #93175 OPEN）

现象：`pnpm dev` 冷启后 watchpack 连续吐 `EMFILE: too many open files, watch`。止血：**`WATCHPACK_POLLING=true pnpm dev`**。上游 vercel/next.js #93175 OPEN。详见 `.omo/plans/ulw-dev-emfile-watch.md`。

### L2-13：主公 :3000 dev 服在线期间禁止在主 worktree 跑 `pnpm build`

2026-09-19 实证：build 清写 `.next/` 连带删除 `.next/dev`，触发 dev 服「`.next/dev` was deleted」重启环撞死服务。对策：**波次构建一律独立 git worktree**，或与主公协调构建窗口。

## 交叉引用

- L0 全部已内联 [AGENTS.md](../AGENTS.md) 主项目块
- L1 每一行 digest 在 AGENTS.md 主项目块的「L1 路由指针」节对应一行
- L2 全部按需读——本节是按需参考页
