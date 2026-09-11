# stats-server-authoritative-delta - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 把"战绩"从"两端各自算后覆盖写入"改成"服务端权威累加"——任一端完成一局，服务器自己读档、记账、回写新档案。两端同时玩不会再丢成绩。顺手把 README 关于"零网络"的措辞改成与现实一致，加一条说明"战绩需要网络"。

**Why this approach:** 客户端只发"这一局谁赢"（三个字面量之一），由服务端读当前战绩、做累加、写回新战绩——这是消除跨端覆盖唯一干净的解，且不增加网络往返次数。Aborting、超时、本地 UI 状态保留的逻辑全部沿用既有 shape，不动既有 AbortController 兜底、不动 SW 缓存策略。

**What it will NOT do:** 不加新依赖、不引入 Server Action、不动游戏纯规则、不切 Vercel 区域、不接账号体系（用户提的"用户/账号/3 天清库"作为未来候选单独记录，本 plan 不实施）。

**Effort:** Short
**Risk:** Medium - 服务端是 hot path；store 行为变更需逐条断言迁移；既有 4 处 PUT-全行 断言要重写为 POST-增量。
**Decisions to sanity-check:** (1) 服务端权威累加 vs 客户端乐观锁——选前者因为直觉与你原话一致；可逆。(2) 保留旧的全行写入接口作后台/迁移用途并标记废弃，删除会破坏既有 QA 截图 seed。(3) 用户提的"加账号/3 天清库"作为未来候选文档占位，本 plan 不实施——产品形态变更不该跟 bugfix 混。

Your next move: approve 后由独立 worker session 跑执行（任何产品代码改动都不在本会话发生）。

---

> TL;DR (machine): Short, Medium risk, 11 atomic commits + 4 final-verifiers; eliminates cross-end lost-update via server-authoritative delta; preserves network/cache contracts.

## Scope
### Must have
1. **新增 `POST /api/stats/outcome` route handler** (`app/api/stats/outcome/route.ts`)：body `{outcome: 'X'|'O'|'draw'}` → `recordAndSave(current, outcome)` → 200 `{stats: GameStats}`；422 on invalid outcome；400 on invalid JSON
2. **`lib/db.ts` 新增 `recordAndSave(outcome: 'X' | 'O' | 'draw')`**（单参；内部 loadStats → recordOutcome → saveStats）：（用 `lib/game.ts` 纯函数）→ saveStats；返回新全行
3. **`lib/store.ts` 替换 `apiPutStats` → `apiRecordOutcome(outcome)`**：复用 `withTimeout` 8s + `{ok, reason}` shape；makeMove win/draw 分支：send `{outcome}`，response 内 stats 反向写 internalStats
4. **`app/api/stats/route.ts` PUT handler 加 `@deprecated` 注释**：明示"客户端禁止使用；仅作 QA seed / admin / migration"
5. **`lib/store.ts` 替换 + `tests/store/store.test.ts` 同步迁移**（合并 commit 3+5）：store 改 `apiRecordOutcome`，测试 4 处 PUT 断言改 POST outcome 断言
6. **`lib/db.test.ts` 新增 outcome 测试**：`recordAndSave(empty, 'X')` → `{totalGames:1, xWins:1, ...}`；连续两次 `'X'` → `xWins: 2`
7. **`tests/qa/stats-race-qa.mjs` step 6 改 multi-POST ordering**：连续 5 次 POST `{outcome:'X'}` → 服务端 `xWins: 5`
8. **新增 `tests/qa/concurrent-surface-qa.mjs`**：两个 chromium context（PWA + website 模拟）各点完一局 → `GET /api/stats` 后 `totalGames === 2` 且 `xWins + oWins === 2`（容忍 `randomizeFirstPlayer` 50/50）
9. **`README.md` 三段更新**：§路由表加 POST / §Features 删"零网络依赖" / §FAQ 加网络依赖说明
10. **`AGENTS.md` §反模式 加 bullet** "客户端不得预计算 newStats 后 PUT 全行；recordOutcome 必须在 server 侧执行"
11. **`.omo/plans/multi-user-stats-future-work.md` 占位**：4 个前置问题清单，不实施

### Must NOT have (guardrails, anti-slop, scope boundaries)
- ❌ 新增任何 npm 依赖（AGENTS.md §反模式）；LSP 工具除外（与本 plan 无关）
- ❌ 引入 Serwist / next-pwa / Workbox / `'use server'` / `cacheComponents` / `unstable_cache`
- ❌ 删 `PUT /api/stats`（`tests/qa/ux-qa.mjs:39` seed 路径需要）
- ❌ 重试 / 指数退避（`{ok, reason}` 已够；HAR 未见高频抖动）
- ❌ 改 `lib/game.ts` 纯函数 recordOutcome 签名或语义
- ❌ 动 SW / `next.config.ts` cache headers / `withTimeout`（上一 plan 已稳）
- ❌ 切 Vercel region（HAR P1 出 scope）
- ❌ 接多用户账号体系 / 加 cron 调度 / 改 schema（future-work）
- ❌ 动 `DESIGN.md` / 视觉契约 / 暗色令牌
- ❌ 动 commit-msg hook / Stryker scope / vitest 阈值
- ❌ omnibus commit（AGENTS.md "atomic commits"）
- ❌ `git commit --no-verify` 绕过 hook
- ❌ 改 `StatsHydrator` 行为
- ❌ 调整 engines.node
- ❌ 删除 deprecated PUT handler 标记（即使是 deprecated 也要保留可调）

## Verification strategy
> Zero human intervention - all verification is agent-executed.

**Test decision**: tests-after（每个 commit 单独跑 6 层 Gauntlet）+ 新增 1 个 vitest 套（db outcome）+ 新增 1 个 Playwright 探针（concurrent-surface-qa）。
**Framework**: vitest 5 + jsdom 30（现 88 例 → 落地后 ~96 例）；Playwright（production build + real Chromium）

**6 层 Gauntlet（每 commit 必跑）**：

| 层 | 工具 | scope | 触发条件 |
|---|---|---|---|
| Tests | vitest 5 + jsdom 30 | 全 | 每 commit |
| Types | tsc 5 strict | 全 | 每 commit |
| Lint | eslint 9（含 `tests/qa/**` ignore） | 全 | 每 commit |
| Build | next build | 全 | 每 commit |
| Commit-audit | `tests/qa/commit-audit.mjs --branch main` | commit message | 每 commit |
| Browser QA | `tests/qa/*.mjs` 探针 | 触及 UI 时 | 触发 commit 3、5、7、8 |
| Coverage | vitest --coverage（v8, `lib/**`+`db/**`, thresholds 80/80/70/80） | on-demand | commit 2、3 触发 |
| Mutation | Stryker（scope 4 文件：`lib/game.ts` `lib/db.ts` `lib/store.ts` `db/schema.ts`，break: null） | on-demand | commit 2、3 触发 |

**Final verification wave**：见下方 ## Final verification wave。

**Evidence root**: `.omo/evidence/stats-server-authoritative-delta/task-<N>-<short-slug>.<ext>`

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

**Wave 1 — Server-side primitive（顺序 commit；route 依赖 helper）**
- commit 1：`lib/db.ts` 加 `recordAndSave` 原子 helper
- commit 2：`app/api/stats/outcome/route.ts` 新增 POST handler（依赖 commit 1 的 helper）

**Wave 2 — Store & API 标记（可并行 commit）**
- commit 3：`lib/store.ts` `apiRecordOutcome` 替换 `apiPutStats` in makeMove
- commit 4：`app/api/stats/route.ts` PUT handler 加 `@deprecated` 注释

**Wave 3 — 测试（可并行 commit）**
- commit 5：`lib/db.test.ts` 新增 outcome 测试
- commit 6：`tests/qa/stats-race-qa.mjs` step 6 改 multi-POST ordering
- commit 7：`tests/qa/concurrent-surface-qa.mjs` 新探针

**Wave 4 — 文档 & 占位（可并行 commit）**
- commit 8：`README.md` §路由表加 POST / §Features 删"零网络依赖" / §FAQ 加网络依赖
- commit 9：`AGENTS.md` §反模式 加 bullet
- commit 10：`.omo/plans/multi-user-stats-future-work.md` 占位文档

**Wave 5 — Final verification**
- F1 / F2 / F3 / F4（见 ## Final verification wave）

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 (POST route) | 2 (recordAndSave) | 3 (store) | — |
| 2 (recordAndSave) | — | 1, 3 (route + store depend on helper) | — |
| 3 (store apiRecordOutcome) | 1, 2 | 4 (parallel), 6 (stats-race-qa), 7 (concurrent-surface-qa) | — |
| 4 (@deprecated PUT) | — | — | 3 |
| 5 (db test) | 2 | — | 6, 7 |
| 6 (stats-race-qa step 6) | 3 | — | 5, 7 |
| 7 (concurrent-surface-qa) | 3 | — | 5, 6 |
| 8 (README) | — | — | 9, 10 |
| 9 (AGENTS.md) | 3 | — | 8, 10 |
| 10 (future-work placeholder) | — | — | 8, 9 |


## Todos
> Implementation + Test = ONE todo. Never separate.

- [ ] 1. feat(api): 新增 POST /api/stats/outcome route handler
  What to do / Must NOT do:
  - 新建 `app/api/stats/outcome/route.ts`，导出 `export const runtime = 'nodejs'` + `export const dynamic = 'force-dynamic'`
  - 导出 `async function POST(request: Request)`：解析 JSON → `isOutcome(v)` 校验（`v.outcome` 必须字面 `'X' | 'O' | 'draw'`）→ `recordAndSave(...)` → 200 `NextResponse.json({stats})`；**`stats` 字段语义**：响应构建时该行的最新已提交状态（POST 单实例内含本次写本身；多实例并发下可能含另一个并发写的结果，**这是 best-effort snapshot，不是 linearizable**）
  - 不导出 GET / PUT / DELETE（只 POST）；不引入新依赖；不调 `revalidatePath`（既有 `force-dynamic` 已稳定）；不改其他 route handler
  - `isOutcome` 校验严格 `===` 三个字面量；空字符串、数字、对象、null 全部 reject
  - **DB 失败契约**：`recordAndSave` 抛错时（`loadStats` 抛 / `saveStats` 抛 / Drizzle 连接错）→ catch 后返回 500 `{error: 'db unavailable'}`；store 映射为 `r.ok=false, reason: 'network-error'`
  Parallelization: Wave 1 | Blocked by: 2 (recordAndSave helper) | Blocks: 3
  References (executor has NO interview context - be exhaustive):
  - `app/api/stats/route.ts:1-49` 现有 GET/PUT/DELETE handler 风格（runtime / dynamic / isGameStats 模式）
  - `lib/db.ts:160-180` `loadStats()` + `saveStats(stats)` 已就绪；`recordAndSave` 在 todo 2 加
  - `lib/game.ts:78-115` `recordOutcome(stats, outcome)` 纯函数语义不变；本 route 直接复用
  - AGENTS.md §反模式 "RSC 页面读取可变数据必须声明 `dynamic = 'force-dynamic'`"（同款约束）
  - AGENTS.md §反模式 "新增第二个水合触发点" 禁止
  - 必读 `node_modules/next/dist/docs/` 在写代码前（AGENTS.md §查找入口）
  Acceptance criteria (agent-executable):
  - `pnpm typecheck` 0 error（重点：`NextResponse.json({stats})` 返回类型 + `isOutcome` 类型谓词严格）
  - `pnpm lint` 0 error
  - `pnpm build` 0 error（注意 Next.js 16 路由文件命名 `route.ts` 必须直接放在 `outcome/` 下）
  - `pnpm vitest run` 88 例全绿（route 不被 vitest 直接覆盖，间接通过 db test 验证）
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - happy：`pnpm build && pnpm start &`；`curl -X POST -H 'content-type: application/json' -d '{"outcome":"X"}' http://localhost:3000/api/stats/outcome` 返回 200 `{"stats":{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1}}`
  - happy2：再 POST `{"outcome":"X"}` 一次 → 200 `{"stats":{"totalGames":2,"xWins":2,...,"currentStreak":2}}`（证明 server 增量正确）
  - failure1：`curl -X POST -d 'not-json'` → 400 `{error:'invalid json'}`
  - failure2：`curl -X POST -d '{"outcome":"Z"}'` → 422 `{error:'invalid outcome shape'}`
  - failure3：`curl -X POST -d '{}'` → 422（outcome 字段缺失）
  - failure4：`curl -X GET http://localhost:3000/api/stats/outcome` → 405（路由只 POST）
  - Evidence `.omo/evidence/stats-server-authoritative-delta/task-1-post-route-curl.txt`
  Commit: Y | feat(api): 新增 POST /api/stats/outcome route handler
  Lore trailer: Constraint 0 new deps / Rejected 'use server' (AGENTS.md forbidden), Server Action (overkill for one route), GraphQL (out of stack), tRPC (new dep) / Confidence High / Scope-risk Low (single new file, mirrors existing route handler style) / Directive body shape {outcome:'X'|'O'|'draw'}; response {stats:GameStats}; 422 on shape mismatch; 400 on JSON parse error / Tested vitest, tsc, eslint, next build, commit-audit, curl prod build / Not-tested real Turso HTTP under high concurrency (manual QA in F3)

- [ ] 2. feat(db): recordAndSave(outcome) 原子 helper
  What to do / Must NOT do:
  - `lib/db.ts` 新增 `export async function recordAndSave(outcome: 'X' | 'O' | 'draw'): Promise<GameStats>`
  - 内部顺序：`const current = await loadStats(); const next = recordOutcome(current, outcome); await saveStats(next); return next;` // 注：单实例 Node 内串行化；Vercel 多实例并发超出本 plan 范围
  - 不在 `saveStats` 上加新参数；不重构 `loadStats` / `saveStats` 已有签名；不破坏单行 UPSERT 语义；不在 `lib/db.ts` 写 raw SQL（Drizzle 保持）
  - `recordOutcome` 复用 `lib/game.ts:107` 纯函数；不重新实现累加逻辑
  - **不引入 `Mutex` / `transaction`**：Node 单实例内 request-level 串行化已够（本游戏吞吐低 + 单 Vercel 实例）；Vercel 多实例并发 + Turso HTTP 跨实例 race 是 future-work（`multi-user-stats-future-work.md` 候选清单第 4 项）
  - 本 plan 验收：`pnpm build && pnpm start` 单进程压测两个并发 POST 顺序写成功；多实例不在 scope
  Parallelization: Wave 1 | Blocked by: 2 (recordAndSave helper) | Blocks: 3, 6
  References:
  - `lib/db.ts:128-140` `loadStats` 实现
  - `lib/db.ts:142-159` `saveStats` 实现（onConflictDoUpdate 已是单行原子）
  - `lib/game.ts:107-125` `recordOutcome(stats, outcome)` 纯函数（已存在，直接 import）
  - `lib/db.ts:35-65` 测试接缝 `__setDbOpDelayForTests` 已支持并发复现； **executor 必须确认**：当前 `dbOpDelayMs` 在 `getDb()` 内 `if (cachedDb) return cachedDb;` 之后才 sleep → 第二次以后无延迟。**必须在 commit 2 把 `await sleep(dbOpDelayMs)` 移到 `cachedDb` 检查之前**（仅测试路径，零产品影响），否则 todo 6 的 slow-DB 探针失效
  - Stryker scope 含 `lib/db.ts`（commit 2 触发 mutation testing）
  - coverage scope 含 `lib/**`+`db/**`（commit 2 触发 vitest --coverage 阈）
  Acceptance criteria:
  - `pnpm typecheck` 0 error（`outcome` 字面类型必须严格 `'X' | 'O' | 'draw'`，不取 `string`）
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 88 例全绿（间接通过 db.test.ts 验证）
  - `pnpm test:coverage -- lib/db.ts` ≥ 80% lines / 80% functions / 70% branches / 80% statements（commit 2 触发 on-demand）
  - `pnpm test:mutation` score ≥ pre-fix baseline（Stryker break:null，db 在 scope；commit 2 触发）
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - vitest：连续两次 `recordAndSave('X')`（base = emptyStats）→ 第一次 `xWins: 1` 第二次 `xWins: 2`
  - vitest：`recordAndSave(emptyStats, 'draw')` → `draws: 1, currentStreak: 0`
  - vitest：`recordAndSave({...seed: streak 1}, 'O')` → `currentStreak: -1`（streak 翻转语义来自 lib/game.ts 不变）
  - failure：mock loadStats 抛错 → `recordAndSave` 抛错向上冒泡（不静默吞）
  - Evidence `.omo/evidence/stats-server-authoritative-delta/task-2-db-helper-vitest.txt`
  Commit: Y | feat(db): recordAndSave(outcome) 原子 helper
  Lore trailer: Constraint 0 new deps / Rejected better-sqlite3 transaction (Turso HTTP not atomic anyway; Node single-process serializes), Mutex wrapper (premature), optimistic locking via updatedAt (deferred per Q1 default) / Confidence High / Scope-risk Low (one new function in lib/db.ts; loadStats+saveStats signature unchanged) / Directive order: load → recordOutcome → saveStats; return new full stats; no result-discarding branches / Tested vitest 88 + new outcome cases, tsc, eslint, next build, commit-audit, coverage on lib/db.ts, mutation on lib/db.ts / Not-tested real Turso HTTP concurrent commits (manual QA in F3)

- [ ] 3. feat(store) + test(store): apiRecordOutcome 替换 apiPutStats in makeMove 并迁移断言
  What to do / Must NOT do:
  - **Source 改动**（`lib/store.ts`）：
    - 替换 `apiPutStats(stats)` → `apiRecordOutcome(outcome): Promise<StoreFetchResult<{ stats: GameStats }>>`
    - 复用既有 `withTimeout(fetch, 8000)`；POST `/api/stats/outcome` body `{outcome}`；response body 解析 `{ stats: GameStats }`
    - `makeMove` win 分支：删 `recordOutcome(internalStats, win.player)` 客户端调用；删 `await apiPutStats(newStats)`；改为 `const r = await apiRecordOutcome(win.player); if (r.ok) internalStats = r.value.stats; set({lastWriteAt: Date.now()})`
    - `makeMove` draw 分支同款替换（outcome: 'draw'）
    - `setInitialStats` 不变；`resetAll` 不变（DELETE 路径）；`internalStats` 仅在 `apiRecordOutcome` 成功路径写
    - `apiPutStats` 函数彻底删除（不再被调用）；`StoreFetchResult<void>` 不再使用；新 `StoreFetchResult<{stats: GameStats}>`
    - `NETWORK_TIMEOUT_MS = 8000` 保持；AbortController 逻辑保持；导出 `withTimeout` 保持（测试接缝）
    - 不动 `withTimeout` 实现；不动 `playSound` 调用顺序；不动 `lastWriteAt` 语义；不动 `__resetInternalForTests`
  - **Test 改动**（`tests/store/store.test.ts`）：
    - 4 处 PUT-body 断言改为 POST `/api/stats/outcome` body 断言 + response body 含 stats
    - mockFetch 入参：URL 从 `/api/stats` 改为 `/api/stats/outcome`；method 从 PUT 改为 POST；body 从 `{totalGames, xWins, ...}` 改为 `{outcome: 'X' | 'O' | 'draw'}`；response.body 从 `{}` 改为 `{stats: {...}}`
    - 新增 1 个用例：mock 500 → makeMove 不抛；local phase=won 保留
    - 新增 1 个用例：mock 永 resolve + abort → makeMove 不抛；`internalStats` 不变；`lastWriteAt` 打点
    - 不动 `setInitialStats` / `restart` / `resetAll` 的现有断言；不改 mockFetch / mockFetchWithAbort helper；不改 `seedInternalStats` / `resetStore`
  - **合并理由**：原子提交要求"每 commit 独立绿"；store 行为变更 + 测试断言迁移必须同 commit 落地，否则 commit 3 改源后 store.test.ts 红，无法独立构建。
  Parallelization: Wave 2 | Blocked by: 1, 2 | Blocks: 6, 7
  References (executor has NO interview context - be exhaustive):
  - `lib/store.ts:80-95` `StoreFetchResult` 类型定义；扩展为 `StoreFetchResult<{stats: GameStats}>` 仍兼容 `{ok, reason}`
  - `lib/store.ts:118-133` `apiPutStats`（commit 3 删除）
  - `lib/store.ts:135-148` `apiDeleteStats`（保留）
  - `lib/store.ts:200-230` makeMove win + draw 分支（commit 3 改写）
  - `lib/store.ts:240-260` `resetAll`（保持）
  - `lib/store.ts:105-117` `withTimeout` 保持
  - `lib/store.ts:177-185` `setInitialStats` 保持（hydration 是写事件，lastWriteAt 仍打点）
  - `lib/store.ts:90-95` `StoreFetchResult` 类型签名变更 `{ ok: true, value: GameStats }` → `{ ok: true, value: { stats: GameStats } }`
  - AGENTS.md §反模式 "store 的网络写 action 必须返回 Promise" — 仍满足
  - AGENTS.md §反模式 "网络写 action 必须带 AbortController timeout" — 仍满足
  - Stryker scope 含 `lib/store.ts`（commit 3 触发 mutation）
  - coverage scope 含 `lib/**`（commit 3 触发 vitest --coverage）
  - `tests/store/store.test.ts:200-310` 既有 PUT-body 断言（commit 3 同步迁移）
  - `tests/store/store.test.ts:30-65` `mockFetch` helper（commit 3 caller 入参改）
  - `tests/store/store.test.ts:50-70` `mockFetchWithAbort` helper（保持）
  Acceptance criteria (agent-executable):
  - `pnpm typecheck` 0 error（`StoreFetchResult<{stats: GameStats}>` 类型严格；`internalStats = r.value.stats` 在 `r.ok === true` 分支内）
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 92 例全绿（旧 88 + 新增 4 outcome 用例 - 失败不抛 + abort + win response body + draw response body）
  - `pnpm test:coverage -- lib/store.ts` ≥ 80% lines / 80% functions / 70% branches / 80% statements
  - `pnpm test:mutation` score ≥ pre-fix baseline
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - vitest：makeMove 触发 X win → fetch calls[0].url === '/api/stats/outcome'；method === 'POST'；body === '{"outcome":"X"}'
  - vitest：makeMove draw → body === '{"outcome":"draw"}'；response 含 `stats.draws === 1`
  - vitest：mock 500 → `r.ok === false, reason: 'network-error'`；`internalStats` 不变；`lastWriteAt` 仍打点
  - vitest：mock 永 resolve + abort → `{ok:false, reason:'aborted'}` 同款
  - vitest：resetAll 不动 — DELETE 路径行为不变
  - vitest：restart 不触发网络
  - Evidence `.omo/evidence/stats-server-authoritative-delta/task-3-store-vitest.txt`
  Commit: Y | feat(store) + test(store): apiRecordOutcome 替换 apiPutStats in makeMove 并迁移断言
  Lore trailer: Constraint 0 new deps / Rejected 'use server' directive, Server Actions (AGENTS.md forbidden), client-side recordOutcome persistence (anti-pattern) / Confidence High / Scope-risk Medium (store is hot path; source + test changes in one commit to keep atomic-green; 4 callers in makeMove + resetAll branches; setInitialStats unchanged) / Directive outcome='X'|'O'|'draw' via new apiRecordOutcome; internalStats updated only on ok:true; lastWriteAt stamped regardless; NETWORK_TIMEOUT_MS unchanged / Tested vitest 88 + 4 new outcome cases, tsc, eslint, next build, commit-audit, coverage on lib/store.ts, mutation on lib/store.ts / Not-tested cross-tab broadcast (Q1 deferred; not in scope)

- [ ] 4. chore(api): @deprecated marker on PUT /api/stats handler
  What to do / Must NOT do:
  - `app/api/stats/route.ts:35-43` PUT handler 前加 `/** @deprecated 客户端禁止使用；仅作 QA seed / admin / migration 入口。生产记录请用 POST /api/stats/outcome。 */`
  - 不删 PUT handler 函数体；不删 route 文件；不改 PUT 校验（`isGameStats` 保持）；不改 GET / DELETE
  - **deprecated PUT 无鉴权**：保留公开可调用是为兼容 `tests/qa/ux-qa.mjs:39` seed 路径；admin / migration 用法靠 Vercel env 或运维约束，本 plan 不引入 token / auth
  - 不引入新依赖；不改 `next.config.ts`；不改 SW
  Parallelization: Wave 2 | Blocked by: — | Blocks: —
  References:
  - `app/api/stats/route.ts:35-43` 当前 PUT handler 实现
  - `tests/qa/ux-qa.mjs:39-49` `home-with-history` 用 PUT seed 历史（保留路径）
  - `docs/learnings.md` 已记录 stats PUT-as-replace 弃用理由（todo 10 future-work 占位文档里复用同一段）
  Acceptance criteria:
  - `pnpm typecheck` 0 error
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 88 例全绿（PUT 行为不变）
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - happy：`pnpm build && pnpm start &`；`curl -X PUT -d '{"totalGames":3,...}' http://localhost:3000/api/stats` 仍 200（admin / seed 路径）
  - failure：lint 校验 JSDoc 注释格式不报错
  - Evidence `.omo/evidence/stats-server-authoritative-delta/task-4-deprecated-curl.txt`
  Commit: Y | chore(api): 给 PUT /api/stats handler 加 @deprecated 标记
  Lore trailer: Constraint 0 new deps / Rejected removing PUT (ux-qa.mjs:39 seed path; admin / migration use case) / Confidence High / Scope-risk Low (single line JSDoc comment) / Directive deprecation message must point to POST /api/stats/outcome / Tested vitest, tsc, eslint, next build, commit-audit, curl prod build / Not-tested admin tooling (out of project scope)

- [ ] 5. test(db): server-side outcome endpoint unit tests
  What to do / Must NOT do:
  - 在 `lib/db.test.ts` 内（已存在）追加用例；如文件不存在则新建
  - 用例 1：`recordAndSave('X')`（base = emptyStats）→ 第一次 → `xWins: 1, totalGames: 1, currentStreak: 1`
  - 用例 2：连续两次 `recordAndSave('X')` → 第二次 `xWins: 2, currentStreak: 2`（证明 server 增量累加）
  - 用例 3：`recordAndSave('draw')`（base = seeded 3 wins） → `draws: 1, currentStreak: 0`（streak 翻转）
  - 用例 4：`recordAndSave('O')`（base = seeded X streak 5） → `currentStreak: -1`（streak 极性翻转）
  - 用例 5：mock `loadStats` 抛错 → `recordAndSave` 抛错向上冒泡（不静默吞）
  - 用例 6：`recordAndSave('X')` 后再 `loadStats()` → 读回相同 stats（写后读一致）
  - 复用既有 `__setCreateClientForTests` / `__setDbOpDelayForTests` / `closeDb` 测试接缝；不引入 mock 框架；不引入新依赖
  Parallelization: Wave 3 | Blocked by: 2 | Blocks: —
  References:
  - `lib/db.ts:35-65` 测试接缝（`__setCreateClientForTests`、`__setDbOpDelayForTests`）
  - `lib/db.ts:128-140` `loadStats`；本 todo 测试其调用
  - `lib/db.ts:142-159` `saveStats`；本 todo 测试其调用
  - `lib/db.ts:160-180` `recordAndSave`（todo 2 加）
  - `lib/game.ts:107-125` `recordOutcome`（已存在，本 todo 不重测，仅验证集成）
  - `lib/game.ts:84-93` `emptyStats`（测试 fixture 用）
  Acceptance criteria:
  - `pnpm typecheck` 0 error
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 88 例 + 6 新用例全绿
  - `pnpm test:coverage -- lib/db.ts` ≥ 80% lines / 80% functions / 70% branches / 80% statements（覆盖 recordAndSave 全部分支）
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - happy：5 个用例覆盖 X 连胜 / draw streak reset / 极性翻转 / 写后读一致
  - failure：mock loadStats throw → recordAndSave reject
  - Evidence `.omo/evidence/stats-server-authoritative-delta/task-6-db-test-vitest.txt`
  Commit: Y | test(db): recordAndSave 覆盖 X 连胜 / draw reset / 极性翻转 / 写后读一致
  Lore trailer: Constraint 0 new deps / Rejected migrating to better-sqlite3 transaction (Turso HTTP not atomic; Node single-process serializes), adding time-travel tests (premature) / Confidence High / Scope-risk Low (single test file) / Directive cover all 4 outcome types in streak transitions; assert read-after-write to catch lost-update window / Tested vitest 88 + 6 new cases, tsc, eslint, commit-audit, coverage on lib/db.ts / Not-tested real Turso HTTP concurrency (manual QA in F3)

- [ ] 6. test(stats-race-qa): step 6 multi-PUT → multi-POST ordering
  What to do / Must NOT do:
  - `tests/qa/stats-race-qa.mjs` STEP 06 当前断言"连续 5 次 PUT 落库后服务端 total 累加正确"——改写为"连续 5 次 POST /api/stats/outcome `{outcome:'X'}` 落库后服务端 xWins:5"
  - 沿用既有的 `DATABASE_URL_SLOW_DELAY_MS` 慢 DB 复现机制；不引入新依赖；不改其他 STEP 01-05、07-14
  - 复用既有 `driveTopRowWin` / `launchQA` / `BASE_URL` 工具
  - 不动 `tests/qa/lib/browser.mjs`；不动 `tests/qa/lib/win-drive.mjs`
  Parallelization: Wave 3 | Blocked by: 3 | Blocks: —
  References:
  - `tests/qa/stats-race-qa.mjs:1-15` header 说明 + import
  - `tests/qa/stats-race-qa.mjs` 现有 STEP 06（约 line 350-420，需落地后 grep 精确定位）
  - `tests/qa/lib/browser.mjs:7+` `launchQA` / `BASE_URL`
  - `tests/qa/lib/win-drive.mjs` `driveTopRowWin`（已存在；本 todo 不调它，POST 直接 page.request）
  Acceptance criteria:
  - `pnpm typecheck` 0 error（QA 脚本 .mjs 不参与 typecheck，但 commit-audit 仍校验）
  - `pnpm lint` 0 error（eslint config 仍 ignore `tests/qa/**`）
  - `pnpm build` 0 error
  - `pnpm vitest run` 92 例全绿（commit 5、6 后）
  - `node tests/qa/stats-race-qa.mjs` 14 STEP 全 PASS
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - happy：连续 5 次 `page.request.post('/api/stats/outcome', {data:{outcome:'X'}})` → `await fetch('/api/stats').then(r=>r.json()).xWins === 5`
  - failure：slow DB（DATABASE_URL_SLOW_DELAY_MS=1500）下 5 次 POST 仍全累加（顺序写）
  - 兼容性：原有 STEP 01-05、07-14 不回归
  - Evidence `.omo/evidence/stats-server-authoritative-delta/task-7-stats-race-qa.txt`
  Commit: Y | test(stats-race-qa): step 6 改为 multi-POST ordering（慢 DB 下验证）
  Lore trailer: Constraint 0 new deps / Rejected adding fake timers (commit 7 lore directive: real-timer abort path), splitting into separate probe (commit 7 §QA 探针覆盖矩阵 unchanged) / Confidence High / Scope-risk Low (single STEP within existing probe) / Directive same DATABASE_URL_SLOW_DELAY_MS knob; same launchQA / BASE_URL; assert server xWins === N after N POSTs / Tested vitest, tsc, eslint, next build, commit-audit, stats-race-qa probe / Not-tested Vercel CDN cache (production cache is irrelevant for POST)


- [ ] 7. test(qa): new concurrent-surface-qa.mjs probe
  What to do / Must NOT do:
  - 新建 `tests/qa/concurrent-surface-qa.mjs`
  - 两个 chromium context 由 `launchQA` 各启一次 `chromium.launch()`，每个 context 独立 page；**不需要 PWA 安装激活 Service Worker**（Service Worker 在两 context 间独立，且本探针测的是 server 端 atomicity，不是 SW cache；同一 localhost 服务，cookie / storage 自然不共享）
  - 关键断言：`fetch('/api/stats').then(r=>r.json()).xWins + oWins === 2`（消除 last-write-wins 丢更新）
  - 沿用 `tests/qa/lib/browser.mjs` `launchQA` 风格；不复用 `stats-race-qa.mjs` 的 helper（独立 probe，逻辑更清晰）
  - 不引入新依赖；不引入并发框架；不动其他 probe
  - 不测"两局同时 PUT"——本探针是 POST endpoint 验证，PUT deprecated 不再测
  Parallelization: Wave 3 | Blocked by: 3 | Blocks: —
  References:
  - `tests/qa/lib/browser.mjs:7+` `launchQA` / `BASE_URL` 复用
  - `tests/qa/lib/win-drive.mjs` `driveTopRowWin`（本 probe 直接复用）
  - `tests/qa/stats-race-qa.mjs` 1-50 header / step pattern（结构风格参考）
  - `app/api/stats/outcome/route.ts`（todo 1 加）— 本 probe 验证此 endpoint
  Acceptance criteria:
  - `pnpm typecheck` 0 error
  - `pnpm lint` 0 error（eslint config 仍 ignore `tests/qa/**`）
  - `pnpm build` 0 error
  - `pnpm vitest run` 92 例全绿
  - `node tests/qa/concurrent-surface-qa.mjs` 1+ STEP PASS
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - happy：PWA context win 一局（X first）→ POST `{outcome:'X'}` → xWins:1
  - happy2：website context win 一局（X 或 O first 因 randomizeFirstPlayer）→ POST `{outcome:winner}` → xWins + oWins === 2
  - 关键：两个 context 的 GET /api/stats 在两局都结束后，server side `totalGames === 2`
  - failure：单边网络失败 → 另一边的成绩仍正确落库（GET /api/stats.totalGames === 1）
  - 兼容：与 stats-race-qa.mjs 不冲突（独立 probe，可并行跑）
  - Evidence `.omo/evidence/stats-server-authoritative-delta/task-8-concurrent-surface-qa.txt`
  Commit: Y | test(qa): 新增双 chromium context 并发探针验证零丢更新
  Lore trailer: Constraint 0 new deps / Rejected using Turso local emulator (Turso HTTP not the bottleneck; concurrency is server-authoritative atomicity), splitting into Turso + file: dual-probe (premature; future-work) / Confidence Medium / Scope-risk Medium (new probe; first Playwright multi-context in this repo) / Directive two chromium contexts each driveTopRowWin; assert server totalGames === 2; tolerate first-player randomization / Tested vitest, tsc, eslint, next build, commit-audit, concurrent-surface-qa probe / Not-tested real Vercel production (manual QA in F3 with Vercel preview deploy)

- [ ] 8. docs(readme): §路由表加 POST / §Features 删"零网络依赖" / §FAQ 加网络依赖说明
  What to do / Must NOT do:
  - `README.md:31` "🎯 Pass-and-play：同设备轮流落子，零网络依赖，纯前端 + Node API。" — 删"零网络依赖"，改为"两人同设备轮流下；战绩需网络持久化"
  - `README.md:36-43` §路由 表加一行：`POST /api/stats/outcome` — body `{outcome: 'X'|'O'|'draw'}` → 200 `{stats: GameStats}`
  - `README.md:152-164` §FAQ 加新 Q："Q: 离线能玩吗？A: 走棋可以（前端规则不依赖网络），但战绩落库需 `POST /api/stats/outcome`；离线时玩的一局战绩会丢，下次上线 PUT/DELETE 不补。" + 一句"Vercel Analytics 噪声（POST 到 `5376560351325243/view`）无法消除，是 Vercel 平台侧"
  - 不动其他 Features 行；不动 Quick start；不动技术栈描述；不动部署章节；不动 CONTRIBUTE 链接
  - 不引入 emoji 装饰；不引入截图；不动 `p align="left"` HTML 块
  Parallelization: Wave 4 | Blocked by: — | Blocks: —
  References:
  - `README.md:31-46` §Features
  - `README.md:53-60` §路由 表
  - `README.md:140-160` §FAQ
  - `app/api/stats/outcome/route.ts`（todo 1 加）— 路由契约
  - `AGENTS.md` §反模式 "不要用 emoji 图标" — 仅保留现有 🎯/💾/🌒/⌨️/🔇/✨/🧪/🚀（不新增）
  Acceptance criteria:
  - `pnpm typecheck` 0 error
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 92 例全绿（README 改动不触发）
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - happy：`grep -nE '零网络依赖' README.md` 返回空（已删）
  - happy2：`grep -nE 'POST.*outcome' README.md` 返回至少 1 行（已加路由）
  - happy3：`grep -nE '离线' README.md` 返回至少 1 行（FAQ 已加）
  - 不回归：`grep -nE '🎯.*Pass-and-play' README.md` 仍 1 行（emoji 保留）
  - Evidence `.omo/evidence/stats-server-authoritative-delta/task-9-readme-grep.txt`
  Commit: Y | docs(readme): 删"零网络依赖"说法 + 加 POST /outcome 路由 + FAQ 网络依赖说明
  Lore trailer: Constraint 0 new deps / Rejected adding architecture diagrams (DESIGN.md scope; out of plan), splitting into multiple docs PRs (single README update atomic) / Confidence High / Scope-risk Low (3 sections within single file) / Directive keep emoji set unchanged; preserve Quick start & deploy sections verbatim; FAQ answer cites concrete endpoint URL / Tested vitest, tsc, eslint, next build, commit-audit, grep / Not-tested docs site render (no docs site in repo)

- [ ] 9. docs(agents-md): §反模式 bullet "客户端不得预计算 newStats 后 PUT"
  What to do / Must NOT do:
  - `AGENTS.md` §反模式 段（在 `<!-- BEGIN:project-contribution-guidelines -->` 块内）新增 bullet："store 不得在客户端调用 `recordOutcome(internalStats, outcome)` 后 PUT 全行；last-write-wins 会丢跨端更新。`recordOutcome` 必须在 server 侧执行，client 只 POST `{outcome}`。"
  - 不动 AGENTS.md 其他章节；不动 `<!-- BEGIN:nextjs-agent-rules -->` 块；不动代码地图 / 约定 / 本项目反模式 / 命令 / 备注
  - 不新增反模式章节（继续加在已有 bullet 列表）；不删既有反模式 bullet
  - 不改 `commit-msg hook` 段
  Parallelization: Wave 4 | Blocked by: 3 | Blocks: —
  References:
  - `AGENTS.md` §本项目反模式 段（行号近似，落地后 `grep -n '本项目反模式\|## 反模式' AGENTS.md` 定位）
  - `lib/store.ts:200-230` makeMove 旧逻辑（反模式来源）
  - `lib/db.ts:160-180` `recordAndSave` 新位置（反模式修复点）
  - 必读 `AGENTS.md` `<!-- BEGIN:project-contribution-guidelines -->` 块（这是规则真源）
  Acceptance criteria:
  - `pnpm typecheck` 0 error
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 92 例全绿
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  - AGENTS.md 文件长度增加 ≤ 5 行（一条 bullet）
  QA scenarios:
  - happy：`grep -nE 'last-write-wins|客户端不得预计算' AGENTS.md` 返回至少 1 行
  - 不回归：`grep -c '## 本项目反模式' AGENTS.md` 仍为 1（不新增独立小节）
  - 兼容：`node tests/qa/commit-audit.mjs --branch main` 通过（commit message 仍合规）
  - Evidence `.omo/evidence/stats-server-authoritative-delta/task-10-agents-md-grep.txt`
  Commit: Y | docs(agents-md): §反模式 加 bullet 禁客户端预计算战绩
  Lore trailer: Constraint 0 new deps / Rejected expanding into dedicated section (over-scoped; bullet suffices), linking to todo 8 README (cross-doc drift; AGENTS.md is source of truth) / Confidence High / Scope-risk Low (single bullet) / Directive bullet must mention both 'last-write-wins' failure mode and 'POST {outcome}' fix; must NOT edit nextjs-agent-rules block / Tested vitest, tsc, eslint, next build, commit-audit, grep / Not-tested doc site render

- [ ] 10. docs(plans): multi-user-stats-future-work.md placeholder
  What to do / Must NOT do:
  - 新建 `.omo/plans/multi-user-stats-future-work.md`：candidate-only 占位文档，**不实施**
  - 文档结构：Context（用户原消息引用）/ Deferred rationale（4 个前置问题：身份方案 / schema 变更 / cron 调度 / 新依赖预算）/ Open questions / "DO NOT implement until user explicitly scopes this as a separate plan" 声明
  - 不动现有 `.omo/plans/` 内容；不动 `.omo/drafts/`；不创建 issue / PR；不写代码
  - 不在 commit footer 引用此文档（本 commit 不进入产品代码路径）
  Parallelization: Wave 4 | Blocked by: — | Blocks: —
  References:
  - 本 plan 的 draft `Open assumptions` 段：用户原消息候选需求
  - `lib/db.ts` 单行 game_stats 表契约（变更需前置评估）
  - `AGENTS.md` §反模式 "不要引入新依赖"（cron 方案受影响）
  - `.omo/plans/` 目录约定（kebab-case slug + 中文/英文混排 commit footer）
  Acceptance criteria:
  - `pnpm typecheck` 0 error
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 92 例全绿（plan 文件不参与）
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - happy：`ls -la .omo/plans/multi-user-stats-future-work.md` 文件存在
  - happy2：`grep -c 'DO NOT implement' .omo/plans/multi-user-stats-future-work.md` ≥ 1（占位声明明确）
  - 不回归：`ls .omo/plans/ | wc -l` 增加 1
  - Evidence `.omo/evidence/stats-server-authoritative-delta/task-11-future-work-md.txt`
  Commit: Y | docs(plans): 多用户战绩候选需求占位文档
  Lore trailer: Constraint 0 new deps / Rejected implementing user/identity layer (out of scope; product-shape change), adding Vercel Cron config (premature), committing inline in another plan (atomic commits; placeholder belongs to a separate plan file) / Confidence High / Scope-risk Low (single new markdown file) / Directive file MUST contain explicit 'DO NOT implement' notice; no code changes; commit footer Plan: .omo/plans/stats-server-authoritative-delta.md (NOT the placeholder) / Tested vitest, tsc, eslint, next build, commit-audit, ls + grep / Not-tested user-facing flow (none; placeholder only)


## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.

- [ ] F1. Plan compliance audit
  - executor 用 6 层 Gauntlet 跑过 todos 1-10 全部 acceptance criteria；每 commit `pnpm vitest run` + `pnpm typecheck` + `pnpm lint` + `pnpm build` + `node tests/qa/commit-audit.mjs --branch main` 全绿
  - 验 `git log --oneline -10` 含 todos 1-10 对应 10 个 commit（commit message 含正确 type/scope、Plan: footer）
  - 验 `git diff HEAD~11 -- lib/store.ts lib/db.ts app/api/stats/outcome app/api/stats/route.ts` diff 落点对应本 plan 描述
  - Evidence `.omo/evidence/stats-server-authoritative-delta/f1-plan-compliance.txt`

- [ ] F2. Code quality review
  - 独立 reviewer agent 审查 diff：POST /api/stats/outcome route shape 严格 / `recordAndSave` 顺序正确（load → recordOutcome → saveStats）/ Store `apiRecordOutcome` 类型严格 `{ok,reason}` / 旧 PUT 断言全部迁移到 POST outcome / QA 探针两条新 + 1 改写 / README 改动小且事实正确 / AGENTS.md bullet 措辞与 todo 3 实际修复对齐
  - 关注：Stryker 不退化（`lib/store.ts` + `lib/db.ts` 改动后 mutation score ≥ baseline）/ coverage 阈值（≥ 80/80/70/80 on `lib/**` + `db/**`）
  - Evidence `.omo/evidence/stats-server-authoritative-delta/f2-code-review.md`

- [ ] F3. Real manual QA
  - `pnpm build && pnpm start &` 启动 production build + 真实 Chrome（chrome-devtools-axi）
  - 双 tab 模拟"PWA + website"：每个 tab 各赢一局 → 双 tab GET /api/stats 都看到 `totalGames: 2`
  - 验证 abort：模拟 Turso 慢响应（`DATABASE_URL_SLOW_DELAY_MS=12000` → 超过 8s timeout）→ 重置按钮 8s 后 loading→disabled，DB 写被 AbortController 取消
  - 验证 manifest / icon cache headers 仍在（上一 plan P3 未回归）：DevTools Network panel `manifest.webmanifest` `cache-control: public, max-age=300`
  - 验证 RSC force-dynamic 未回归：DevTools Network panel `?_rsc=...` `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`
  - Evidence `.omo/evidence/stats-server-authoritative-delta/f3-manual-qa.txt`

- [ ] F4. Scope fidelity
  - `grep -rE 'use server|cacheComponents|unstable_cache|Serwist|next-pwa|Workbox' lib/ app/ components/ db/ next.config.ts` 无新增匹配（Must NOT §反模式 一致性）
  - `grep -E '"[a-z-]+":\s*"\^?[0-9]' package.json` 与 todo 1 前 baseline 一致（无新依赖）
  - `git log --oneline | grep -vE '^(feat|fix|refactor|test|docs|chore|build|ci|perf)\(' | head` 无 omnibus commit
  - `grep -c 'DO NOT implement' .omo/plans/multi-user-stats-future-work.md` ≥ 1（占位声明保留）
  - Evidence `.omo/evidence/stats-server-authoritative-delta/f4-scope-fidelity.txt`

## Commit strategy

10 个原子 commit，按 wave 分组（见 Execution strategy）。

**Staging 纪律**：`git status` 当前显示 plan 文件 + 2 个 HAR + 1 个其他 plan 均未跟踪。executor 必须：
- 每个 commit 单独 `git add` 本 commit 涉及的文件，**不**用 `git add .` / `git add -A`
- 不 commit `.omx/` / `.stryker-tmp/` / `data/` / `coverage/` / `reports/`（已在 .gitignore）
- commit 10 加 `.omo/plans/multi-user-stats-future-work.md` 时，**不**把其他未跟踪的 `.omo/plans/*.md` 一并 add
- commit 9 不改 README 中无关章节（仅 §Features / §路由 / §FAQ 三处）

每个 commit 必须满足 AGENTS.md §commit-msg hook 契约：
- type/scope 英文；description 默认中文（按 Unicode 码点计 ≤100）
- 正文 schema: WHAT / WHY / HOW
- 非平凡 commit 必带 lore trailer：Constraint / Rejected / Confidence / Scope-risk / Directive / Tested / Not-tested
- commit footer `Plan: .omo/plans/stats-server-authoritative-delta.md`（**所有 11 个 commit 都加**，作为 plan 与 commit 的关联审计点）

Commit 序列：

| # | Commit subject |
|---|---|
| 1 | `feat(api): 新增 POST /api/stats/outcome route handler` |
| 2 | `feat(db): recordAndSave(outcome) 原子 helper` |
| 3 | `feat(store) + test(store): apiRecordOutcome 替换 apiPutStats in makeMove 并迁移断言` |
| 4 | `chore(api): 给 PUT /api/stats handler 加 @deprecated 标记` |
| 5 | `test(db): recordAndSave 覆盖 X 连胜 / draw reset / 极性翻转 / 写后读一致` |
| 6 | `test(stats-race-qa): step 6 改为 multi-POST ordering（慢 DB 下验证）` |
| 7 | `test(qa): 新增双 chromium context 并发探针验证零丢更新` |
| 8 | `docs(readme): 删"零网络依赖"说法 + 加 POST /outcome 路由 + FAQ 网络依赖说明` |
| 9 | `docs(agents-md): §反模式 加 bullet 禁客户端预计算战绩` |
| 10 | `docs(plans): 多用户战绩候选需求占位文档` |

## Success criteria

本 plan 完成的明确信号（executor 必须全部 satisfy）：

1. **零丢更新**：双 chromium context（PWA + website）各赢一局后，server `GET /api/stats.totalGames === 2`（`tests/qa/concurrent-surface-qa.mjs` STEP PASS）
2. **服务端权威**：client 不再预计算 newStats；`recordOutcome` 永远在 `lib/db.ts:recordAndSave` 内部执行（commit 3 grep 验证 `lib/store.ts` 无 `recordOutcome` 调用）
3. **API 形状扩展**：`POST /api/stats/outcome` 存在；`PUT /api/stats` 保留 + @deprecated 标记；`GET /api/stats` / `DELETE /api/stats` 不变
4. **README 事实正确**：`grep -nE '零网络依赖' README.md` 返回空；`grep -nE 'POST.*outcome' README.md` 返回至少 1 行
5. **AGENTS.md 反模式沉淀**：AGENTS.md §反模式 段含"client 不得预计算" bullet（`grep -nE 'last-write-wins' AGENTS.md` 返回至少 1 行）
6. **Future-work 占位**：`.omo/plans/multi-user-stats-future-work.md` 存在；含 `DO NOT implement` 声明
7. **6 层 Gauntlet 全绿**：todos 1-10 全部通过 acceptance criteria；F1-F4 全部 APPROVE
8. **Stryker 不退化**：`pnpm test:mutation` 改 `lib/store.ts` + `lib/db.ts` 后 score ≥ pre-fix baseline（commit 2、3 触发 on-demand）
9. **Coverage 不退化**：`pnpm test:coverage -- lib/store.ts lib/db.ts` ≥ 80/80/70/80
10. **无 omnibus commit**：`git log --oneline -10` 10 个独立 commit，每个只触及 plan 描述的对应文件
