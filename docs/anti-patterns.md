# Anti-patterns

> 来源：AGENTS.md §本项目反模式（行 92–147）

按 L0/L1/L2 分三档，每条保留原 AGENTS.md 的判定理由。**L0 是结构硬约束——漏则破契约，必须每会话自动加载（已内联 AGENTS.md）**；L1 是高频契约——路由指针 + 一行 digest；L2 是按需读——仅特定任务时参考。

**2026-10-08 起每条标题下首行带机械化状态字段**（段位／拦截 gate／机制状态），全 48 条段位全景、无机制 20 条重修索引与编号规约见文末「四段位对照表」。

## L0（必须内联，漏则破契约）

### L0-1：service 层纯函数 / 传输层薄壳强制分离（GraphQL 双兼容预留）

> **段位**：架构 ｜ **拦截 gate**：—（无机械拦截）｜ **机制状态**：无机制 → 重修：类型与 lint 段位候选（eslint 限 lib/db.ts import 面禁 next/server／NextResponse，零新依赖可实现）；间接兜底＝① tests/api/* transport 映射契约（不拦 service 层破约）

W2 起（ulw-one-game-two-versions §0）：`lib/db.ts` 是 service 层，全部「读 / 改 / 写战绩」业务规则收敛为纯函数（无 HTTP 上下文、无 `NextResponse`、无 status code 知识）；调用方是 `lib/store.ts`（浏览器端）或 `app/api/**/route.ts`（Node runtime 端）。任意 transport（RESTful route / GraphQL resolver / gRPC handler）只做「解析入参 → 调 service → 映射返回值到 status code / problem+json」；不得在 transport 里再写一份「read → mutate → upsert」业务规则。GraphQL 双兼容仅需新增 schema + resolver，service 函数零改动。transport 层错误统一走 `lib/api-problem.ts:problemResponse`，RFC 9457 `application/problem+json`。

### L0-2：service 函数禁止返回 `Response` / `NextResponse` / `{ status: 404 }`

> **段位**：架构 ｜ **拦截 gate**：— ｜ **机制状态**：无机制 → 重修：类型与 lint 段位候选（service 返回类型收窄为纯数据联合，② tsc 即拦）；与 L0-1 同族同修

`lib/db.ts` 的函数返回值必须是纯数据 + 状态标记（命中 → `GameStats` / `{ stats, ... }`；缺失 → `null` 或具名 `not-found` 字符串；异常 → 抛 `Error`）。transport 层是唯一决定 status code 的地方。

### L0-3：已有命名令牌时不要使用 Tailwind 原生色板或内联 hex

> **段位**：架构 ｜ **拦截 gate**：— ｜ **机制状态**：无机制 → 重修：类型与 lint 段位候选（eslint no-restricted-syntax 拦 Tailwind 任意值／内联 hex class；令牌真源 app/globals.css 与 DESIGN.md）

设计令牌保存在 `app/globals.css` 和 `DESIGN.md`；Tailwind class 引用令牌。

### L0-4：不要在 SSR 首帧读取 localStorage

> **段位**：架构 ｜ **拦截 gate**：⑥ 探针 hydration-check（预置 localStorage 非默认值 → 三路由零水合警告）——**常红基线中**：room-gate 入口漂移 09-19 起确定性红、列 verify-all KNOWN_STALE 豁免（照跑照报 FAIL 不计 exit），对新回归零分辨力（票 2 走查＋票 14 回放实测）｜ **机制状态**：失效（探针在档但拦截力为零）→ 重修：探针修复票（decisions 自排期队列第 18 项，2026-10-08 评审修复波立项）清账后回已机制化

先渲染安全默认值，再用 `useEffect` 同步。React/RSC 水合边界硬约束。

### L0-5：不要引入新库

> **段位**：架构 ｜ **拦截 gate**：—（pnpm qa:audit knip 系定期体检非门禁）｜ **机制状态**：无机制 → 重修：测试段位候选（依赖清单契约断言，diff 须注理由）；零新库红线随计划 §九 执行

不引入 UI、路由、动画、数据访问或表单库；这些是项目约束明确排除的。

### L0-6：不要使用 div onClick、emoji 图标、组件级 focus ring，或新增第二个水合触发点

> **段位**：架构 ｜ **拦截 gate**：—（③ lint 实测不拦：eslint-config-next 的 jsx-a11y 子集仅 6 条 aria/alt 规则且全 warn 级，div onClick 族规则〔no-static-element-interactions／click-events-have-key-events〕未启用；warning 亦不破 `pnpm lint` exit 0。2026-10-08 票 14 回放＋评审复核实测——div onClick 样例 eslint 零输出，原「可静态拦」声称两重不成立）｜ **机制状态**：无机制 → 重修：类型与 lint 段位候选（显式启用 click-events 族 jsx-a11y 规则并 error 级，零新依赖）＋测试段位探针补面

UI 边界与可访问性契约。

### L0-7：不要用 `--no-verify` 绕过 commit-msg hook

> **段位**：架构 ｜ **拦截 gate**：⑤ commit-audit（.git/hooks/commit-msg 调 tests/qa/commit-audit.mjs；hook 层零豁免——385005b 本地实测）｜ **机制状态**：已机制化

`.git/hooks/commit-msg` 是 gate；`tests/qa/commit-audit.mjs` 是策略真源。

### L0-8：契约要求生产构建时不要对 dev server 跑浏览器 QA

> **段位**：测试 ｜ **拦截 gate**：—（探针范式在档 docs/commands.md「浏览器探针启动范式」节；「禁对 dev server 跑」无机械断言）｜ **机制状态**：无机制 → 重修：候选＝探针前置断言 BASE_URL 非 dev 端口

先 `pnpm build && pnpm start`（`:3101` hermetic 库），不要用 dev server。

## L1（高频契约——AGENTS.md 留一行 digest，外化文件载完整条）

### L1-1：`/offline` 路径零网络写

> **段位**：测试 ｜ **拦截 gate**：⑥ one-identity-qa「b-anonymous-offline-direct-nav-zero-block」step＋offline-qa A1（CI job）｜ **机制状态**：已机制化

未命名 offline 路径零新增网络行为：`/offline` 路由全程 `/api/*` 请求数 = 0（`one-identity-qa` step 断言）；任何「顺手 GET 一次」改动都破坏该契约。

### L1-2：同名并发故意 last-write-wins

> **段位**：架构 ｜ **拦截 gate**：—（README 边界注明＝文档载体）｜ **机制状态**：无机制（设计 decree）→ 重修：测试段位候选（时序/竞态断言族——候补池待队列票 11 收录）

不做 CRDT / 时间戳合并；单机 UX 场景下「跨设备累加足够」，过度合并引入「为什么不同步删除」的迷惑。README 注明边界。

### L1-3：offline 100% 纯本地——store 不再 auto-POST

> **段位**：测试 ｜ **拦截 gate**：① store 测试「offline ZERO fetches」族＋⑥ offline-mode-qa／offline-qa（CI）／anonymous-first-game-qa ｜ **机制状态**：已机制化

W1+W2+W3 收尾：`lib/store.ts` 的 `makeMove` 在 offline 分支只调 `recordOutcome(internalStats, outcome)` + `persistOfflineStats(...)`，不发任何 fetch；具名玩家与匿名玩家一致——零网络写。跨设备走首页 `HomeDialogMount` 弹框。

### L1-4：POST /api/rooms/{room}/stats/merge 是「用户主动确认的合并」接口

> **段位**：测试 ｜ **拦截 gate**：⑥ offline-qa A2「合并并清空」全链（CI job）；merge-sync-qa 系旧面板退役 DISABLED（T-L1 接位注记）｜ **机制状态**：已机制化

server 端 read → `accumulateMergeStats` per-field 相加 → upsert → 返回合并后 `{stats}`。调用方必须在 `SyncConfirmDialog` 主 CTA「合并并清空」按下后才发，「保留本地」零网络写。

### L1-5：同步哨兵 `ttt.offline.last-merged-local.v1` 跟踪合并后本机零位

> **段位**：测试 ｜ **拦截 gate**：① lib-offline-stats.test.ts（pendingSyncCount 全套含 F1 catch-up）｜ **机制状态**：已机制化

W4 修复 V4 MINOR-F1：新模型存「合并完成时 `local.totalGames = 0`」基线，合并成功后 `HomeDialogMount.handleConfirm` 写 `persistLastMergedLocal(0)`。`pendingSyncCount = max(0, local.totalGames - lastMergedLocal)` 永远等于 local。`lib/offline-stats.ts:pendingSyncCount` 是单一客户端真相。

### L1-6：`/offline` 页纯净化

> **段位**：测试 ｜ **拦截 gate**：⑥ offline-qa／offline-mode-qa（CI，行为面零写零弹框）｜ **机制状态**：部分机制化（「不渲染 X」组件结构负断言随旧探针退役）→ 重修：测试段位探针补负断言

`components/OfflineStatsPanel.tsx` 仅渲染「单机战绩」+ `StatsGrid` + `ResetStatsButton(scope='local')` StatsGrid 无条件渲染；组件零 roomName 依赖，不挂载按 roomName GET、不内嵌存名或同步按钮、不渲染 `SyncConfirmDialog`、不渲染 `RoomGateDialog`。

### L1-7：首页「开始对战」/「单机练习」点击零拦截（pure-local 时）

> **段位**：测试 ｜ **拦截 gate**：⑥ one-identity-qa b-step（pure-local 直行零拦截）＋① store「startGame does not hit the network」｜ **机制状态**：已机制化

W3：`StartGameButton` 整段删除 pendingSyncCount 拦截逻辑；点击即直行 `startGame(mode) + router.push(href)`。

### L1-8：首页零 API（A1 红线）

> **段位**：测试 ｜ **拦截 gate**：⑥ one-identity-qa Q1 三态（q1a 匿名挂载／q1b 具名挂载／q1c focus×3）＋① store 零网络 ｜ **机制状态**：已机制化

任意状态、任意 focus 行为下 `/api/*` 请求数 = 0。战绩展示主场归 `/result?room=` RSC（force-dynamic SSR 直读 DB）。`one-identity-qa` Q1 step 硬断言。

### L1-9：`ttt.offline.sync-declined.v1` sessionStorage 哨兵

> **段位**：测试 ｜ **拦截 gate**：⑥ offline-qa（declined 哨兵读写）＋one-identity-qa（DECLINED_KEY 步）｜ **机制状态**：已机制化

W3：`SyncConfirmDialog` 不直接写 sessionStorage；由 `HomeDialogMount` 的 onReject handler 写 `writeDeclinedPending(pendingSnapshot)`。`sessionStorage`（非 localStorage）保证关标签页即忘。

### L1-10：POST /merge 409 防静默建档

> **段位**：测试 ｜ **拦截 gate**：① rooms-stats.test.ts merge describe（409 enter-room-required）＋lib-game-net（409 映射）｜ **机制状态**：已机制化

服务端在 merge 前必须先 `loadRecordByRoom(room)`；row 不存在 → 409 `enter-room-required`。不允许「merge 一个未注册 room」被偷渡成 upsert 复活已删除账号。

### L1-11：POST /outcomes 404 防静默建档

> **段位**：测试 ｜ **拦截 gate**：① rooms-stats.test.ts outcomes describe（404 not-found 防静默建档）＋lib-game-net（404 映射）｜ **机制状态**：已机制化

`recordOutcomeForRoom(room, outcome)` 服务端 read → 命中则累加 upsert → 缺失返 `{ ok: false, reason: 'not-found' }`，transport 映射 404 problem+json。

### L1-12：POST /reset 清零保留身份、永不 DELETE 房间行

> **段位**：测试 ｜ **拦截 gate**：① rooms-stats reset 用例（缺失 404 不建档）＋⑥ room-reset-qa N1/S1（CI job）｜ **机制状态**：已机制化

W-R：service `resetRecordByRoom`：load 命中 → upsert `emptyStats()` → 返回全零行；缺失 404。DELETE 行会让下一局记局必 404、记账闭环断裂——row 是身份不是数据。

### L1-13：ResultNavigator push 前必须 await 在途记局写

> **段位**：测试 ｜ **拦截 gate**：① store 测试「outcome write seam（W-F awaitOutcomeWrite）」＋⑥ result-fresh-qa W-F1 首帧新鲜度 ｜ **机制状态**：已机制化

W-F：`makeMove` online 分支先 set phase 再 await POST outcomes；导航若不等待在途写，force-dynamic 的 `/result` RSC 直读 DB 会渲染旧行。store seam `pendingOutcomeWrite` + `awaitOutcomeWrite()` 吞错落定。

### L1-14：RoomGateMount 挂载期 identity bootstrap

> **段位**：测试 ｜ **拦截 gate**：⑥ one-identity-qa「q6-legacy-key-cleared-on-mount」＋online-direct-qa（CI）｜ **机制状态**：已机制化

W3 cace8f4 修补：`RoomGateMount` 的 useEffect 读 store.roomName；若为空但 localStorage `ttt.room.name.v1` 有值，调 `setRoomName(stored)`。同时执行 `cleanupLegacyPlayerNameKey()`。

### L1-15：/result 胜利庆祝由一次性 sessionStorage 哨兵门控

> **段位**：测试 ｜ **拦截 gate**：⑥ result-celebration-qa F1/F2（读后即清／reload 不重放）＋① store「恰一次」用例 ｜ **机制状态**：已机制化

W-A：仅 `ResultNavigator` 见证 phase→'won'（平局不写）push 前写入；`ResultCelebration`（/result client 岛）读后即清、恰消费一次——刷新 / 书签 / 首页「查看战绩」入口（无哨兵）零庆祝。

### L1-16：online 需 room 契约由首页 CTA 延伸到 /online 页面本身

> **段位**：测试 ｜ **拦截 gate**：⑥ online-direct-qa（CI job，BR-2/8）｜ **机制状态**：已机制化

W-A2：直达 `/online` 有名 → mount 期 identity bootstrap；无名 → 页内就地开 `RoomGateDialog`（原生 showModal 令棋盘 inert），onReject 有意不关弹框。

### L1-17：RoomGateDialog 与 SyncConfirmDialog 弹框初焦落主 CTA

> **段位**：测试 ｜ **拦截 gate**：—（tests/qa 全目录无 focus 断言，本轮 grep 亲证）｜ **机制状态**：无机制 → 重修：测试段位（探针 step 断言弹框打开时 activeElement＝主 CTA；T-F1 74e1a56 同族时序教训）

F3 fix：showModal 后 `primaryRef.current?.focus()`，但同 commit phase 内 `setName(initialName)` 触发的 re-render 会重置焦点。修复：focus 调用包进 `requestAnimationFrame(() => primaryRef.current?.focus())` 并 cleanup `cancelAnimationFrame`。

### L1-18：浏览器 QA 探针的 BASE_URL 不硬编码 :3000

> **段位**：测试 ｜ **拦截 gate**：—（无静态扫描）｜ **机制状态**：无机制 → 重修：测试段位候选（静态断言 tests/qa/*.mjs 无 localhost:3000 字面；a2a667d 漏传 BASE_URL／L1-32 同族教训）

F5 fix：探针必须读 `tests/qa/lib/browser.mjs` 的 `BASE_URL` 导出，不要硬编码 `http://localhost:3000`。

### L1-19：eslint `globalIgnores` 必须包含 `.delta/**`

> **段位**：类型与 lint ｜ **拦截 gate**：③ lint（globalIgnores 本体在 eslint.config.mjs，含 .delta/**）｜ **机制状态**：部分机制化（拦截前提＝.delta 沙箱在盘时 0-warnings 破；配置缺失本身无专测）

F8 fix：`.delta/worktrees/**` 是 git worktree + 重元工具的沙箱（不入仓），`pnpm lint` 之前把扫描到这堆陈年源码上。W4 同步在 `eslint.config.mjs` 加 `.delta/**`。

## L2（按需读——AGENTS.md 完全外化）

### L2-1：LSP 服务端工具走 vp 全局安装

> **段位**：架构 ｜ **拦截 gate**：—（无 CI 负断言）｜ **机制状态**：无机制 → 重修：类型与 lint 段位候选（CI grep 负断言：language-server 不得入 dependencies）

typescript-language-server / yaml-language-server / bash-language-server 走 vp 全局安装，禁止作为项目 npm 依赖。详见 [`.omo/plans/lsp-revert-to-global.md`](../.omo/plans/lsp-revert-to-global.md) 与 [`.omo/plans/lsp-client-portable-config.md`](../.omo/plans/lsp-client-portable-config.md)。

### L2-2：RSC 页面读取可变数据必须声明 `dynamic = 'force-dynamic'`

> **段位**：架构 ｜ **拦截 gate**：⑥ result-fresh-qa W-F1（/result 首帧新鲜度）｜ **机制状态**：已机制化（flag 本体 /result force-dynamic；④ build 不拦静态烘焙，行为由探针承载）

Next.js 16 默认静态优化可能烘焙 build-time 异步数据（如 Drizzle DB 调用）的结果到 HTML，runtime 返回脏数据直到下次 build。B-3a 实证：`/result` RSC 实时成绩单即强制声明此 flag。

### L2-3：Service Worker fetch handler 必须按方法门控

> **段位**：架构 ｜ **拦截 gate**：⑥ pwa-sw-cache-qa（SW 缓存行为）＋机制本体 public/sw.js 方法门控 ｜ **机制状态**：部分机制化（非 GET 双发负断言无专测）

`event.respondWith(fetch(event.request))` 无门控会让 PUT/POST/DELETE 被发两次。可安装但不缓存的 SW 范式：`if (event.request.method !== 'GET') return;` 后再 respondWith。

### L2-4：store 的网络写 action 必须返回 Promise

> **段位**：架构 ｜ **拦截 gate**：① store seam 生命周期测试（await 面间接锁 Promise 形状）｜ **机制状态**：部分机制化（接口形状本身无静态断言）

让调用方可以 await 后再调 `router.refresh()`。在 `force-dynamic` 下无需 `revalidatePath`；在 ISR 下 Route Handler 必须调 `revalidatePath('/')` + `revalidatePath('/result')`。

### L2-5：网络写 action 必须带 AbortController timeout

> **段位**：测试 ｜ **拦截 gate**：① lib-game-net（TimeoutError→aborted）＋store abort 用例（phase 保持）＋NETWORK_TIMEOUT_MS 常量 ｜ **机制状态**：已机制化

Turso HTTP 在 iad1 偶发 30 s 默认 fetch 超时；client 必须主动 8 s `AbortController.timeout()` abort + Button `loading` state + 强制 disabled。`lib/store.ts:NETWORK_TIMEOUT_MS` 与 `lib/game-net.ts` 8s 约定同源。

### L2-6：静态资源缓存必须双层 + SW cache-bust

> **段位**：架构 ｜ **拦截 gate**：④ build（scripts/sw-bust.mjs prebuild 注入版本化 CACHE_NAME，实测有效）＋⑥ pwa-sw-cache-qa（SW 缓存名断言）——⑥ 面**常红基线中**：探针硬编码 tic-tac-toe-v1 未跟进 a380404 版本化（现 v0.1.0）、列 KNOWN_STALE 豁免，对新回归零分辨力（票 2／票 14 实测）｜ **机制状态**：部分机制化（④ sw-bust 面有效；⑥ 面待探针修复票〔decisions 队列 18〕清账）

`_next/static/**` 已被 Vercel 边缘 immutable 缓存；但 `manifest.webmanifest` / `icon.svg` 等默认 `max-age=0, must-revalidate` 会让浏览器每次 nav 都 304 roundtrip。**SW cache 名必须随版本失效（W-OPT-c a380404）**：`scripts/sw-bust.mjs` 在 prebuild/prestart/predev 从 package.json version 注入 `APP_VERSION` 到 `public/sw.js` 的 `CACHE_NAME`，activate 时 sweep 清理非当前 cache。

### L2-7：仓库内任何"清理/迁移/deslop"批量文件操作必须走 git 通道

> **段位**：文档 ｜ **拦截 gate**：—（呈报白名单「tracked 文件删除与改史」类＋herdr 协议在档）｜ **机制状态**：无机制 → 重修：候补池「批量删除绕 git」条目（队列票 11 D17 收录中）

删 tracked 文件前先 commit，删 untracked/ignored 内容前先备份。2026-09-12 00:00:08-23 实证：40 个 tracked 文件 + `.git/hooks` + `.omx/backups/repo.git.tar` 在 15 秒内被未知进程按清单删除。

### L2-8：herdr 多 pane 工作区内，同一 worktree 同时只允许一个 agent 写入

> **段位**：文档 ｜ **拦截 gate**：—（docs/herdr-session-hygiene.md 协议）｜ **机制状态**：无机制 → 重修：观察项（重犯即复评机械化）

2026-09-12 实证：仓库删除与 `/tmp/hooks-v2` 空骨架创建交错 6 秒，指向同一迁移脚本中途停止；reflog/index 零记录证明它绕过了 git。

### L2-9：DB schema 变更必须带 getDb reconcile + legacy 旧库迁移测试

> **段位**：测试 ｜ **拦截 gate**：① tests/db/db.test.ts「legacy name-column rebuild」describe（legacy 迁移测试）｜ **机制状态**：已机制化

任何对 `game_stats` 的列级变更必须在 `getDb()` bootstrap 后追加列探测 + 缺失即事务内重建。`tests/db/db.test.ts` 必须新增 describe「legacy DB migration」。详见 [`.omo/plans/ulw-hotfix-db-schema-drift.md`](../.omo/plans/ulw-hotfix-db-schema-drift.md)。

### L2-10：commit-msg hook 位于 `.git/` 内，git 永不跟踪

> **段位**：架构 ｜ **拦截 gate**：结构性保证（.git/ 天然不入版本库）＋⑤ commit-audit 侧翼 ｜ **机制状态**：已机制化（结构即机制）

契约三源：`docs/commit-policy.md` §commit-msg hook、`.omo/plans/commit-policy-enforcement.md` 与 `.omo/plans/recovery-from-unknown-cleanup.md` 附录 B。

### L2-11：`ttt.room.name.v1` 白名单必须与 `lib/room-name.ts:normalizeRoom` 同源

> **段位**：架构 ｜ **拦截 gate**：① lib-room-name.test.ts（normalize／isRoomName／storage round-trip）＋rooms 系 422 白名单用例 ｜ **机制状态**：已机制化（单一真相由 import 收敛＋双向测试锁）

W3 迁移：4 个 RESTful 端点全部 import `normalizeRoom` 作为 service-side 单一真相，`isRoomName` 是单一客户端真相。

### L2-12：dev 冷启 EMFILE 风暴（上游 #93175 OPEN）

> **段位**：文档 ｜ **拦截 gate**：—（上游 vercel/next.js #93175 OPEN，不可拦）｜ **机制状态**：无机制（终态：止血命令在档 docs/commands.md「端口约定」节；上游闭合前不机械化）

现象：`pnpm dev` 冷启后 watchpack 连续吐 `EMFILE: too many open files, watch`。止血：**`WATCHPACK_POLLING=true pnpm dev`**。上游 vercel/next.js #93175 OPEN。详见 `.omo/plans/ulw-dev-emfile-watch.md`。

### L2-13：主公 :3000 dev 服在线期间禁止在主 worktree 跑 `pnpm build`

> **段位**：文档 ｜ **拦截 gate**：—（波次构建独立 worktree 纪律）｜ **机制状态**：无机制 → 重修：候选（构建前置 dev 服探测脚本，票面外候补）

2026-09-19 实证：build 清写 `.next/` 连带删除 `.next/dev`，触发 dev 服「`.next/dev` was deleted」重启环撞死服务。对策：**波次构建一律独立 git worktree**，或与主公协调构建窗口。

## 交叉引用

- L0 全部已内联 [AGENTS.md](../AGENTS.md) 主项目块
- L1 每一行 digest 在 AGENTS.md 主项目块的「L1 路由指针」节对应一行
- L2 全部按需读——本节是按需参考页

## 追加（路由化后新增，2026-09-22 起）

> 本节收录 AGENTS.md §反模式迁移之后新增的条目，与上方 L0/L1/L2 同一判定框架。新增条目自 L1-35 续号；L1-20～26 断档保留不重排（详见文末四段位对照表·编号规约）。

### L1-27：绿测试自证陷阱（spec 缺反面场景 + characterization 锁死错误行为）

> **段位**：测试 ｜ **拦截 gate**：—（无门禁强制反面场景）｜ **机制状态**：部分机制化（文档载体＝docs/business-rules.md 正反面场景列在档）→ 重修：测试段位候选（「新 BR 必带反面场景」机械对账）

三个互锁的失效模式（实证：learnings §32 合并弹框事件）：
1. **验收只写正向场景**——「什么时候弹」写了，「什么时候不弹」没写，洞被测试固化成契约，六层门禁对着错误契约全绿。反面场景是验收的必备半边。
2. **把「当前行为」当「正确行为」锁死**——行为保持型重构（slop 清理 / characterization test）的前提是当前行为正确；此前应先过 `docs/business-rules.md` 清单。
3. **业务规则不外化**——用户可见的触发时机/拦截规则若只存在于主公脑中，每个 wave 都可能重新踩。必须落 `docs/business-rules.md` 条目 + tests/qa 可执行探针。

### L1-28：route-scoped 组件用自身 ref 记「上一个路径」

> **段位**：架构 ｜ **拦截 gate**：⑥ home-return-qa（CI job，BR-1/2/3/5）＋机制本体 NavPrevTracker（不卸载层）｜ **机制状态**：已机制化

只在 `/` 挂载的组件离开 `/` 即卸载，组件内 ref/`prevPathname` 在软导航下永远拿不到来源路由。正确机制：layout 层挂不卸载的 `NavPrevTracker`（`useLayoutEffect` 写 sessionStorage）+ 页级 consume-on-read（硬刷新天然无标记）。实证：`components/NavPrevTracker.tsx` + `HomeDialogMount` BR-1 触发条件。

### L1-29：假设「派发时意图绑定 = 全程意图保持」（执行中漂移）

> **段位**：文档 ｜ **拦截 gate**：—（dispatcher-playbook「意图锚定与防漂移」协议在档）｜ **机制状态**：无机制 → 重修：队列票 13 dispatch-discipline（干预率度量设施＝信任梯子 L4 第④锚）

实测（主公反复验证 + llm-wiki `agent-rule-decay`）：规则不是被违反而是被后续 token out-voted——**约 15 次 tool call 后 system prompt 规则可靠失效**，全程无报错（green-dashboard failures）；「模型能复述规则 ≠ 遵守规则」。已证伪修法：写大声 / 重复 5 遍 / 买更大窗口。已验证对策（全量协议见 [dispatcher-playbook §意图锚定与防漂移](./dispatcher-playbook.md)）：
1. 约束搬到动作时刻（gate 步骤 / 探针），使其成为 context 最新近内容；
2. 「禁止 X」改写为「要求执行的动作 Y」（transcript 留痕）；
3. 风险步骤前最后一轮重注入意图块 Scenario；
4. 漂移先分型再处置：注意力稀释（忘约束但方向大体对）→ 重锚定 / 新 session；上下文中毒（错误假设被反复加固、纠错后继续错）→ 弃会话重启，不在错误会话里辩论；
5. 能探针化的约束绝不依赖 LLM 记忆——探针没有上下文，所以不会漂。

### L1-30：断言「死代码 / 死键」前未跨包装层核验类型词汇表

> **段位**：测试 ｜ **拦截 gate**：—（证据纪律：逐层 file:line 词汇表清单）｜ **机制状态**：无机制 → 重修：候选 C3 ast-grep（D11 裁驳，复评触发器＝第二例「调用形状」缺陷再现，在档）

宣布任何键 / 分支 / 字段「永不被触达」之前，必须 grep **全链路每一层**的联合类型定义（service 返回 → store 包装层 → UI 消费），而不是只看被引用文件的那一层——「上游类型没有」不等于「下游包装层没有」。

实证（2026-09-23 卫生收口波 REJECT 返工）：`OutcomeErrorBanner` 的 `'not-found'` 文案键被当死键删除，依据是 `lib/game-net.ts` 的 `FetchResult` 词汇表只有 `aborted | network-error | http-error`。但 `lib/store.ts` 的 `StoreFetchResult` 包装层词汇表**额外含 `'not-found'`**，且 `apiRecordOutcome` 把 POST outcome 的 404 主动翻译成该 reason（房间被服务端删除后的局内记分正是这条链）。删除后该场景退化为裸 token fallback，属行为变更，违反「零行为改动」红线。分类「死代码」的合格证据是逐层 file:line 的全链路词汇表清单，缺一层即未证实。

### L1-31：退役文件时未同步其引用方（CI job / 脚本引用悬空）

> **段位**：测试 ｜ **拦截 gate**：① tests/qa/probe-reconciliation.test.ts（ci.yml／commands／operations 三源机械对账，头注自指本条为真源）｜ **机制状态**：已机制化

删除探针 / 模块时只删文件、不清理引用者，悬空引用在下次被触发时才爆——且常爆在最疼的场合（发版 PR 的 CI）。删除前的合格动作是 `rg '<被删文件名>' .github tests docs` 把引用方清一遍，而不是假定「没人引用」。

实证（2026-09-23 发版 PR #14）：`d07fd07` 语义清退删除 `tests/qa/stats-race-qa.mjs`（被测对象 `/api/stats` 链已随 `7765b3f` 御裁退役），但 `.github/workflows/ci.yml` 的 `stats-race` job 未同步删除，悬空此后一直未暴露（dependabot PR 基于旧 main workflow），直到 dev→main 发版 PR 首次触发即 MODULE_NOT_FOUND 红。对策：退役任何被引用文件前先清引用方（CI job / docs / 脚本）；「ci.yml 被引探针存在性 × tests/qa 清单」可做机械对账测试——能探针化的约束不靠记忆（L1-29 同款哲学）。注意：被退役能力若确需等价覆盖（如 `/api/rooms` 链竞态），那是**新探针票**，把旧 job 硬指到别的探针只会造出假覆盖。

### L1-32：探针 / CI 触发面盲区（CI workflow 变更不经 PR 实跑验证即沉默）

> **段位**：测试 ｜ **拦截 gate**：—（C6 未裁决不实施；Gap 6 入档 verification-gauntlet §3）｜ **机制状态**：无机制 → 重修：队列票 4 D14（触发面豁免显式化＋BASE_URL 契约断言）

任何探针 / CI workflow 变更，必须先回答「这段变更会在哪个触发面被实跑」——CI 仅 `pull_request` 触发时，凡不产生 PR 的改动面（如 dev 直推）对 CI 全部 job 静默；「改 CI 本身」也不例外，不能因为「只是改 CI」就免验。合格动作：变更 ci.yml 后构造一次真实触发亲见目标 job 实跑；暂无法触发时把盲区显式入档（verification-gauntlet §3 Gap 清单）待裁决，而不是当作「没问题」。

实证（2026-09-30 验证波次，PR #18 首跑红）：rooms-race job 自进 CI 起约 6.3 天从未绿过（`e1ea4b1` 2026-09-24 进 CI → `a2a667d` 2026-10-01 单行修复）——探针 step 漏传 `BASE_URL`；结构性成因是 CI 自 2026-09-15 移除 push trigger 起仅 `pull_request` 触发（ci.yml 历史可查），dev push 不触发任何 job，bug 沉默约 15.9 天（`ca7e6ad` 09-15 移除 push trigger → PR #18 首跑红 09-30）。主公亲令「不能让它就这样沉默的通过了」。血缘：L1-31 管「job 引用悬空」，本条管「job 活着但从未被实跑」；L1-18（探针 `BASE_URL` 不硬编码）是同族前置约定。

对策：触发面当作验证契约审视——每段改动先答「会被哪些门禁实跑」；「ci.yml 触发器 × 分支 × job」矩阵机械对账已列为机械化候选 C6（未裁决不实施）；Gap 记录见 verification-gauntlet §3 第 6 条。

> 【2026-10-04 勘误补注】本条实证段旧记「沉默 12 天」系两窗口错配——job 层（`e1ea4b1` 09-24 进 CI → `a2a667d` 10-01 修复）≈6.3 天；触发面盲区（`ca7e6ad` 09-15 移除 push trigger → PR #18 首跑红 09-30）≈15.9 天（粗值 15.6 系 UTC/本地混算，同日复核精确化）。verify 波实证更正，锚 .omo/verify-20261001-docs-wave.md:104-105/:186。

### L1-33：rerun 绿混同首跑绿（收口判据漂移）

> **段位**：测试 ｜ **拦截 gate**：—（C6 邻接候选未裁决；run_attempt=1 判据入档 gauntlet 2026-09-30 补充①）｜ **机制状态**：无机制 → 重修：队列票 4 D14（run_attempt 首跑绿断言）

PR 门禁的收口判据是 `run_attempt=1` 首跑全绿；rerun 转绿（可能掩盖 flaky / 时序性失败）与 admin bypass 混过（绕过 required checks）都不算收口，不得以「最终是绿的」汇报。合格动作：CI 结论必附 `run_attempt`；rerun 绿之前先定责首跑红因（本地复现定责法，见 L1-34 实证段）；bypass 合流必须在档案显式记 admin merge 及先例依据。

实证（2026-09-30 验证波次，PR #18 流程）：首跑红暴露 rooms-race 漏 `BASE_URL`（`a2a667d`）与 offline 探针违 BR-1（`1b80a99`）两处真问题；修复后按「首跑全绿才收口」执行，run_attempt=1 全绿方 admin merge（`37326b9`）。同波 PR #17（Dependabot 6 包，`e31e8a9`）approve 后被 stale 门拦，按 #16 先例 admin 合入——bypass 本身是合法工具，但必须显式留痕，不得混同「绿」。

对策：收口判据入 verification-gauntlet「2026-09-30 验证实践补充」；「CI 结论取 run_attempt=1 全绿」断言可机械化（候选 C6 邻接，未裁决不实施）。

### L1-34：探针期待漂移于业务 decree（探针比规则旧）

> **段位**：测试 ｜ **拦截 gate**：—（C9 未裁决；business-rules 表探针列＝文档对账载体）｜ **机制状态**：无机制 → 重修：候选 C9 双向对账＋队列票 12 features/ 地图（BR 覆盖对照强化）

探针红有两种：业务回归、探针过时。业务 decree 变更后（如 BR-1 收窄弹框触发时机），旧探针的期待不会自动跟着改——拿旧期待跑新 decree 就是假红；反过来拿旧探针绿当「行为没变」的证据也是假绿。合格动作：改 decree 时同步排查 business-rules 表「探针」列引用该 BR 的探针 step；探针红先本地复现定责（`pnpm build` + hermetic server + 三犯复现），定责为探针过时则改探针触发方式对齐 decree，探针修复与 decree 对齐同波收口。

实证（2026-09-30 验证波次，commit `1b80a99`）：offline 探针 A2a/A2b 期待停留在 W3 时代「硬 goto 首页也弹框」，违反 BR-1 decree（弹框只在软导航转场弹）——本地三犯复现定责为探针过时非业务回归，改合规软导航触发后本地 5/5 全绿。

对策：「探针期待 ↔ business-rules 表」双向对账可机械化（C2 文档契约测试推广，候选 C9，未裁决不实施）；本波完整复盘见 [`.omo/research-verification-trust-20260930.md`](../.omo/research-verification-trust-20260930.md)。

## 四段位对照表（架构＞类型与 lint＞测试＞文档）

> 2026-10-08 随队列票 1（D9 字段填充）入档（Plan: .omo/plans/ulw-verification-infra-roadmap-20261007.md §七）。段位＝「这条规则能被哪一层机械机制承载」：越靠左拦截越结构化、越不依赖执行者记忆；**无机制／部分机制化条目的重修方向一律向左迁段位**。字段行样例（每条标题下第一行，48 条同格式）：
>
> ```markdown
> > **段位**：测试 ｜ **拦截 gate**：—（无静态扫描） ｜ **机制状态**：无机制 → 重修：…
> ```

### 段位定义与 gate 映射

| 段位 | 定义 | 主要 gate 映射 | 条数 |
| --- | --- | --- | --- |
| 架构 | 结构性约束——规则由代码结构／构建机制／流程 gate 本体承载，违规即结构破绽 | ④ build（结构机制本体）、⑤ commit-audit（流程 hook）、结构性不可违反 | 16 |
| 类型与 lint | 静态可判——编辑期／CI 期机械拦截 | ② typecheck、③ lint | 1 |
| 测试 | 行为可判——运行期断言 | ① vitest、⑥ 浏览器探针（含 CI 探针 job） | 26 |
| 文档 | 仅约定可读——无机械拦截，靠档文／协议／呈报纪律承载 | —（重修方向＝向左三段位机械化） | 5 |

> 类型与 lint 段位仅 1 条并非失衡而是幸存者偏差：能被静态规则拦住的错误在引入前即被拦，不会沉淀为反模式条目；沉淀下来的多是行为面／流程面错误。

### 逐条对照（48 条）

**架构段位（16 条）**

| 条目 | 拦截 gate | 机制状态 |
| --- | --- | --- |
| L0-1 service/transport 分离 | — | 无机制 → 类型与 lint 候选 |
| L0-2 service 纯数据返回 | — | 无机制 → 类型与 lint 候选 |
| L0-3 设计令牌 | — | 无机制 → 类型与 lint 候选 |
| L0-4 SSR 首帧不读 localStorage | ⑥ hydration-check（常红基线中，零分辨力） | 失效 → 探针修复票 |
| L0-5 不引入新库 | — | 无机制 → 测试候选（依赖清单断言） |
| L0-6 UI 边界四禁 | —（③ lint 实测不拦：jsx-a11y 子集仅 aria/alt 且 warn 级） | 无机制 → lint error 级候选 |
| L0-7 禁 --no-verify | ⑤ commit-audit（hook 零豁免） | 已机制化 |
| L1-2 last-write-wins | — | 无机制 → 候补池时序/竞态族 |
| L1-28 route-scoped prev path | ⑥ home-return-qa（CI） | 已机制化 |
| L2-1 LSP 全局安装 | — | 无机制 → CI 负断言候选 |
| L2-2 force-dynamic | ⑥ result-fresh-qa | 已机制化 |
| L2-3 SW 方法门控 | ⑥ pwa-sw-cache-qa＋sw.js 本体 | 部分机制化 |
| L2-4 网络写返回 Promise | ① seam 测试（间接） | 部分机制化 |
| L2-6 缓存双层＋SW bust | ④ sw-bust 有效＋⑥ 常红基线中 | 部分机制化（⑥ 面待票 18） |
| L2-10 hook 不跟踪 | 结构性（.git/ 不入版本库） | 已机制化 |
| L2-11 normalizeRoom 同源 | ① lib-room-name＋rooms 系 422 | 已机制化 |

**类型与 lint 段位（1 条）**

| 条目 | 拦截 gate | 机制状态 |
| --- | --- | --- |
| L1-19 globalIgnores 含 .delta | ③ lint（本体在 eslint.config.mjs） | 部分机制化（前提＝沙箱在盘） |

**测试段位（26 条）**

| 条目 | 拦截 gate | 机制状态 |
| --- | --- | --- |
| L0-8 生产构建跑 QA | —（范式在档 commands.md） | 无机制 → 探针前置断言候选 |
| L1-1 /offline 零网络写 | ⑥ one-identity-qa b-step＋offline-qa A1（CI） | 已机制化 |
| L1-3 offline 纯本地 | ① store 族＋⑥ offline-mode/offline-qa（CI） | 已机制化 |
| L1-4 merge 用户主动确认 | ⑥ offline-qa A2（CI） | 已机制化 |
| L1-5 同步哨兵 | ① lib-offline-stats 全套 | 已机制化 |
| L1-6 /offline 页纯净化 | ⑥ offline-qa/offline-mode-qa（CI） | 部分机制化（负断言随旧探针退役） |
| L1-7 首页点击零拦截 | ⑥ one-identity-qa b-step＋① store | 已机制化 |
| L1-8 首页零 API | ⑥ one-identity-qa Q1 三态 | 已机制化 |
| L1-9 declined 哨兵 | ⑥ offline-qa＋one-identity-qa | 已机制化 |
| L1-10 merge 409 | ① rooms-stats merge＋lib-game-net | 已机制化 |
| L1-11 outcomes 404 | ① rooms-stats outcomes＋lib-game-net | 已机制化 |
| L1-12 reset 保留身份 | ① reset 用例＋⑥ room-reset-qa（CI） | 已机制化 |
| L1-13 await 在途写 | ① seam（W-F）＋⑥ result-fresh-qa | 已机制化 |
| L1-14 identity bootstrap | ⑥ one-identity-qa q6＋online-direct-qa（CI） | 已机制化 |
| L1-15 庆祝哨兵 | ⑥ result-celebration-qa＋① store | 已机制化 |
| L1-16 online 需 room | ⑥ online-direct-qa（CI） | 已机制化 |
| L1-17 弹框初焦主 CTA | —（tests/qa 无 focus 断言） | 无机制 → 探针 step 候选 |
| L1-18 BASE_URL 不硬编码 | —（无静态扫描） | 无机制 → 静态断言候选 |
| L1-27 绿测试自证陷阱 | —（business-rules 正反面列在档） | 部分机制化 |
| L1-30 死代码跨层核验 | —（证据纪律） | 无机制 → C3 复评触发器在档 |
| L1-31 退役清引用 | ① probe-reconciliation.test.ts | 已机制化 |
| L1-32 触发面盲区 | —（C6 未裁决） | 无机制 → 队列票 4 |
| L1-33 rerun≠首跑绿 | —（C6 邻接未裁决） | 无机制 → 队列票 4 |
| L1-34 探针期待漂移 | —（C9 未裁决） | 无机制 → C9 候选＋队列票 12 |
| L2-5 AbortController 超时 | ① lib-game-net＋store abort 用例 | 已机制化 |
| L2-9 schema reconcile | ① db.test.ts legacy describe | 已机制化 |

**文档段位（5 条）**

| 条目 | 拦截 gate | 机制状态 |
| --- | --- | --- |
| L1-29 意图漂移 | —（playbook 协议在档） | 无机制 → 队列票 13 |
| L2-7 批量清理走 git | —（呈报白名单＋herdr 协议） | 无机制 → 候补池（队列票 11） |
| L2-8 herdr 单写者 | —（session 协议在档） | 无机制 → 观察项 |
| L2-12 EMFILE 止血 | —（上游 #93175 OPEN） | 无机制（终态，不机械化） |
| L2-13 主 worktree 禁 build | —（独立 worktree 纪律） | 无机制 → 探测脚本候选 |

### 无机制条目重修索引（20 条）

按重修去向分四类（明细见各条字段行）：

1. **随队列票已排期（7 条）**：L1-32／L1-33 → 票 4（D14 CI 契约）；L1-29 → 票 13（dispatch-discipline 干预率度量）；L1-34 → 票 12（features/ 地图）＋候选 C9；L1-2／L2-7 → 票 11（D17 候补池：时序/竞态族、批量删除绕 git）；L0-4 → 探针修复票（decisions 自排期队列第 18 项，2026-10-08 评审修复波立项——hydration-check 常红清账后回已机制化）。
2. **候补池 C 族·未裁决不实施（2 条）**：L1-30（C3 ast-grep，复评触发器＝第二例「调用形状」缺陷再现）；L2-13（构建前置 dev 服探测脚本候选）。
3. **段位重修候选·票面外（8 条）**：L0-1／L0-2／L0-3／L0-6（类型与 lint 段位，eslint 零新依赖路径；L0-6 系 2026-10-08 评审勘误「lint 实测不拦」后自部分机制化转入）；L0-5／L1-17／L1-18／L2-1（测试段位断言）。
4. **终态·不机械化（3 条）**：L2-12（上游 OPEN，止血命令在档）；L2-8（观察项，重犯即复评）；L0-8（范式文档在档，机械断言仅候选）。

部分机制化 6 条（L1-6／L1-19／L1-27／L2-3／L2-4／L2-6）缺面已在各字段行注明，重修同「向左迁段位」原则。计数：已机制化 22／部分机制化 6／无机制 20＝48（L0-6 系 2026-10-08 评审勘误「lint 实测不拦」自部分机制化转无机制；L0-4 系同波勘误「探针常红零分辨力」自已机制化计入无机制档〔失效〕、L2-6 同波自已机制化转部分机制化）。

### 挖错素材落注（三笔已更正提交）

- **385005b**（commit-audit 豁免三类本地实测）：L0-7 机制描述以「hook 层零豁免」实测口径入字段——gate 行为描述不再依赖推演；同款实测方法论＝「对 gate 行为的想当然假设」解药（两处边界澄清：Merge branch 形态不豁免、dependabot 身份豁免不盖 R1）。
- **c6eed4f＋9a4c3c7**（273 断言勘误两笔）：教训＝「文档断言漂移于事实」族——断言唯一载体不可达（gitignored）、数字无锚、节号误载。本票全部新增注记零行号锚（机制引用一律文件名＋describe／step 名）；「会话侧数字不入正文」口径已立 docs/conventions.md；tests/qa/probe-reconciliation.test.ts 头注的行号锚随本票去行号化（改引 L1-31 编号，编号稳定不随编辑漂移）。

### 编号规约

- 新增条目自 **L1-35** 续号（2026-10-08 时点现存最大号＝L1-34）。
- L1-20～L1-26 断档系历史迁移遗留，**有意保留、不补号、不重排**——重排将破坏既有编号引用（如 tests/qa/probe-reconciliation.test.ts 头注引用 L1-31）。
