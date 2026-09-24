# ulw-rooms-race-qa-ticket - Work Plan

## TL;DR (For humans)
<!-- Filled LAST after detailed plan below -->

**What you'll get:** 一套覆盖 `/api/rooms` 链六类竞态的端到端探针（merge×outcomes、reset×in-flight、POST 幂等、删除后 404、SW 透传、慢 DB 排序），加一个自维护「ci.yml ↔ tests/qa/*.mjs」双向对账的 vitest 用例，加 `rooms-race` CI job；同时按贡献删除已死的 `concurrent-surface-qa.mjs`，让仓库回到「每个 .mjs 要么被引用要么显式标记 DISABLED」的状态。

**Why this approach:** 双上下文编排 + `page.route` 慢 DB 拦截 + 服务端权威 GET 收尾断言（与 room-reset-qa 同一形态），复用 `launchQA` / `driveTopRowWin` / EVIDENCE_DIR 既有基建，最小新依赖；探针 BR header 仅标 BR-7/BR-10 直接相关项，禁 claim BR-6（防 step 1 范围外误承诺），禁重写 ws.js / lib/db；R6 dangle 用「报告 + 等 T-B2/T-C 转正」处理而非改 docs/，保持 ticket 负面清单 `docs/**` 边界。

**What it will NOT do:** 不实现 step 1（双设备并发 outcomes — T-B2 票）、不改 `lib/`/`app/`/`components/`/`db/`/`docs/`/`tests/db/`、不 push、不发 gh api、不动 package.json / knip.json、不 `--no-verify`、不引入 yaml 库、不重写 sw.js、不动 lib/db.ts 失实注释（T-C 票）。

**Risk:** Medium — 探针必须在 `:3101` hermetic 生产构建下绿；branches 分支为 `feat/rooms-race-qa`；唯一外发动作（同步 ruleset）刻意推迟到主公确认；R6 本地已知 fail 不进 CI 门禁。

**Decisions to sanity-check:** 拍板 1=A（BR-6 行 dangle 用「plan/report 标注 + 等 T-B2/T-C」），拍板 2=A（KNOWN_ORPHANS 白名单 10 条带 TODO），拍板 3=A（step 5 房间被删用 `child_process` + libsql 子进程 DELETE）。

Your next move: 启动执行席（`$start-work ulw-rooms-race-qa-ticket --worktree /private/tmp/ttt-wt-20260924/probe`）。

---

> TL;DR (machine): Medium · 9 todos (8 实现 + 1 final verify) · :3101 hermetic + vitest 对账 · diff 面 tests/qa/** + ci.yml + plan

## Scope
### Must have
- `tests/qa/rooms-race-qa.mjs`（step 2-7 端到端探针，6 个 step；文件头标 `BR: BR-7, BR-10`）
- `tests/qa/probe-reconciliation.test.ts`（vitest；解析 ci.yml + docs/commands.md；DISABLED 存根豁免；KNOWN_ORPHANS 白名单；注入对照）
- `.github/workflows/ci.yml` 加 `rooms-race` job（参照 visual-qa 形态：`needs: [build]`、`:3101` hermetic、`pnpm exec node tests/qa/rooms-race-qa.mjs`、playwright install、artifact 上传）
- `tests/qa/AGENTS.md` 探针地图表新增 rooms-race-qa 行（一致性同步）
- 删 `tests/qa/concurrent-surface-qa.mjs`（L1-31 双保险：删前 rg 引用方）
- plan 文件 `.omo/plans/ulw-rooms-race-qa-ticket-20260924.md`（即本文件）
- 证据文件 `.omo/evidence/ulw-rooms-race-qa-ticket/{report.md, orphans-found.md, probe-summary.md}`
- 一次原子 commit（`feat(qa): rooms-race 探针 + 机械对账 + ci.yml job + 删僵尸`）

### Must NOT have (guardrails, anti-slop, scope boundaries)
- ❌ step 1 双设备并发 outcomes 探针（T-B2 票）
- ❌ 任何 `lib/`、`app/`、`components/`、`db/`、`docs/`、`tests/db/` 改动
- ❌ 修改既有探针（home-return-qa / room-reset-qa / one-identity-qa 等）— 即使 reconciliation test 发现其真悬空也只报告不改
- ❌ 修改 package.json / knip.json / .gitignore / next-env.d.ts
- ❌ 引入新依赖（yaml 库、test helpers 等都不引入）
- ❌ push、PR 创建、gh api 命令
- ❌ 重写 sw.js / lib/db.ts / lib/store.ts（探针只观测，不修产品）
- ❌ `--no-verify` 绕过 commit-msg hook
- ❌ 同步 GitHub `main-gate` ruleset（外发动作，写进 commit 后续动作）

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + 自带 reconciliation vitest 用例（防悬空）
- 验证六层（每 commit 必跑）：
  1. `pnpm vitest run`（含 probe-reconciliation.test.ts）
  2. `pnpm typecheck`（`tsc --noEmit`）
  3. `pnpm lint`（`eslint`，含 tests/qa/** 因 globalIgnores 跳）
  4. `pnpm build`（`next build`，确保 rooms-race job 可复现）
  5. `node tests/qa/commit-audit.mjs --branch main`（commit message 契约 + R6 BR↔probe 检查会 FAIL 因 BR-6 dangle，已用 A1 默认纳入报告；其余 PASS）
  6. `:3101` hermetic 生产构建 + `node tests/qa/rooms-race-qa.mjs`（6 step 全绿）
- Evidence: `.omo/evidence/ulw-rooms-race-qa-ticket/`（`report.md` 终报 + `orphans-found.md` reconciliation 白名单源 + `probe-summary.md` 各 step 输出）

## Execution strategy
### Parallel execution waves
- Wave 1 (1 todo)：骨架 + 探针导入（先写 rooms-race-qa.mjs 的 lib 引入 + step runner + 不写 step 实现）
- Wave 2 (4 todos)：step 2、3、4、5（同一探针文件内分段、独立 commit)
- Wave 3 (2 todos)：step 6、step 7（独立 commit，慢 DB harness 与 SW 探针分层）
- Wave 4 (1 todo)：reconciliation test（含正向 + 反向 + 注入对照）
- Wave 5 (2 todos)：ci.yml job + 删 concurrent-surface-qa + plan sync
- Wave 6 (1 todo)：final verify（F1-F4 平行）

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 探针骨架 + lib 引用 | — | T2-T5 | — |
| T2 step 2 (merge × outcomes) | T1 | F1-F4 | T3, T4, T5 |
| T3 step 3 (reset × in-flight) | T1 | F1-F4 | T2, T4, T5 |
| T4 step 4 (双发 POST 幂等) | T1 | F1-F4 | T2, T3, T5 |
| T5 step 5 (404 + OutcomeErrorBanner) | T1 | F1-F4 | T2, T3, T4 |
| T6 step 6 (SW non-GET + 激活) | T1 | F1-F4 | T7 |
| T7 step 7 (慢 DB ordering) | T1 | F1-F4 | T6 |
| T8 probe-reconciliation.test.ts | T1（rooms-race-qa 已存在） | F1-F4 | T9 |
| T9 ci.yml job + DELETE | T8（reconciliation 先建好决定 ci.yml 引用关系） | F1-F4 | — |
| F1-F4 final verify | T9 | — | 平行 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. tests/qa/rooms-race-qa.mjs: 写探针骨架（shebang + 头注释 `// BR: BR-7, BR-10` + 用法说明 + lib imports + RUN_SUFFIXUE + findings 数组 + step() helper + EVIDENCE_DIR 初始化 + shootTo + unhandledRejection/uncaughtException 守卫 + writeQaLog + process.exit）；不写 step 实现（仅 0/N0/Diag 三块不依赖 step 的占位） for step 2-7
  What to do / Must NOT do: 复用 `tests/qa/room-reset-qa.mjs:1-50` 与 `tests/qa/home-return-qa.mjs:1-90` 头部形态；禁 claim `BR: BR-6`（step 1 范围外，防 commit-audit R6 误判）
  Parallelization: Wave 1 | Blocked by: — | Blocks: T2-T7
  References (executor has NO interview context - be exhaustive):
    - tests/qa/room-reset-qa.mjs:1-50（探针模板）
    - tests/qa/home-return-qa.mjs:1-95（头部 + step helper + 软导航 + captureLocalStorage）
    - tests/qa/lib/browser.mjs:36-58（launchQA）
    - tests/qa/lib/win-drive.mjs:4-12（driveTopRowWin）
    - tests/qa/lib/evidence.mjs（ensureDir/shootTo/writeQaLog）
    - docs/commands.md:14-43（端口约定、探针启动范式）
    - .omo/research-rooms-race-probe-20260924.md:46（step 表）
    - .omo/plans/ulw-rooms-race-map-20260924.md:42-49（T-B1 票面）
  Acceptance criteria (agent-executable):
    - `node tests/qa/rooms-race-qa.mjs` 退出码 1（无 step 注册），stdout 显示 `0/0 PASS / 0 FAIL`
    - `node -e "require('./tests/qa/rooms-race-qa.mjs'.replace...)"` 解析无 syntax 错（用 node --check 验证）
    - 头部 1-3 行含 `// BR: BR-7, BR-10`
  QA scenarios (name the exact tool + invocation):
    - happy — `cd /private/tmp/ttt-wt-20260924/probe && node --check tests/qa/rooms-race-qa.mjs && echo OK_syntax` → exit 0
    - failure — 故意写 `node --check` 一个含语法错的小 mjs → exit 1（验 happy-path 真能区分错）
    - Evidence: `.omo/evidence/ulw-rooms-race-qa-ticket/task-1-skeleton.log`
  Commit: Y | `test(qa): rooms-race-qa 探针骨架（header + step helper + lib）`

- [ ] 2. tests/qa/rooms-race-qa.mjs: 实现 step 2（S3 merge × outcomes 交错 → 终值 = 两源严格相加） — POST /api/rooms 建房间 → POST 1 次 outcome X → 捕获请求间值等 → POST 1 次 merge（partial stats 包含 1 次 X 胜） → 服务端 GET /api/rooms/{room}/stats → 断言 totalGames=2, xWins=2, oWins=0, draws=0, currentStreak=X2
  What to do / Must NOT do: 顺序执行（交错已在 step 1 范围内禁了；本 step 是「客户端混合调用」非真并发）；禁依赖 await ordering 隐式假设
  Parallelization: Wave 2 | Blocked by: T1 | Blocks: F1-F4
  References:
    - app/api/rooms/route.ts:71-90（POST /api/rooms）
    - app/api/rooms/[room]/stats/merge/route.ts:53-69（POST merge 契约）
    - app/api/rooms/[room]/stats/outcomes/route.ts:55-72（POST outcomes 契约）
    - app/api/rooms/[room]/stats/route.ts:31-44（GET stats 契约）
    - lib/db.ts:355-366（mergeRecordByRoom 实现）
    - lib/db.ts:384-394（recordOutcomeForRoom 实现）
    - lib/game.ts:recordOutcome + accumulateMergeStats（纯函数）
    - tests/qa/room-reset-qa.mjs:95-145（S1 seed 形态参照）
  Acceptance criteria (agent-executable):
    - step 2 PASS 输出 `=== QA SUMMARY: 1 PASS / 0 FAIL / 1 total ===`
    - 服务端 GET stats.totalGames === 2（精确累加，无丢失）
    - 服务端 GET stats.xWins === 2（merge 含 1 X 胜 + outcome 1 X 胜）
  QA scenarios:
    - happy — `:3101` hermetic + `node tests/qa/rooms-race-qa.mjs` → exit 0，stdout 含 `STEP: step 2 (S3 merge × outcomes 交错) ... PASS`
    - failure — 故意写 `assert.equal(stats.totalGames, 999)` 看能否红（验完撤回）
    - Evidence: `.omo/evidence/ulw-rooms-race-qa-ticket/task-2-step2.log`
  Commit: Y | `test(qa): rooms-race-qa step 2 — merge × outcomes 累加契约`

- [ ] 3. tests/qa/rooms-race-qa.mjs: 实现 step 3（S4 reset 撞 in-flight outcome → 终态全零或 404 → banner 可见） — POST /api/rooms 建房间 → POST 1 次 outcome X → 并行 [POST /reset, POST 1 次 outcome] → 服务端 GET → 断言 final.totalGames ∈ {0, 1}（reset 落地则 0；outcome 在 reset 前落地则 1 次计入 → 但 reset 后 must 0 故 final=0 或 1 后被 reset 清掉 → 实际只 0），data-testid="outcome-error-banner" 不出现（除非 outcome 在 reset 后）
  What to do / Must NOT do: 用 `Promise.all` 并行而非 race；禁等待任意一边 done 才发另一边（必须同时发）
  Parallelization: Wave 2 | Blocked by: T1 | Blocks: F1-F4
  References:
    - app/api/rooms/[room]/stats/reset/route.ts:30-49（reset 契约；清零保留身份）
    - app/api/rooms/[room]/stats/outcomes/route.ts:55-72（outcomes 404 路径）
    - lib/store.ts:108,266,462（__resetInternalForTests — 仅作 step 5 banner 验证用）
    - components/OutcomeErrorBanner.tsx:1-50（banner data-testid="outcome-error-banner"）
    - app/result/page.tsx:94,169（banner 挂载点）
  Acceptance criteria:
    - step 3 PASS 输出 `STEP: step 3 (S4 reset × in-flight) ... PASS`
    - 服务端 GET stats.totalGames === 0（reset 终态干净）
    - 服务器端 GET stats.room === room（身份保留，BR-7 不丢身份契约）
    - 浏览器侧：outcome 在 reset 后落地的极端 race → banner 可见
  QA scenarios:
    - happy — `:3101` hermetic + 探针运行 → exit 0，stdout `STEP: step 3 ... PASS`
    - failure — 故意断 Promise.all 改 sequential 顺序 → 仍 PASS 但失去并行 race 含义；为 race 含义的 RED 必须改 lock ordering（删代码：本表断言 reset → 标 Total X）
    - Evidence: `.omo/evidence/ulw-rooms-race-qa-ticket/task-3-step3.log`
  Commit: Y | `test(qa): rooms-race-qa step 3 — reset × in-flight outcome race`

- [ ] 4. tests/qa/rooms-race-qa.mjs: 实现 step 4（S6 双发 POST /api/rooms 幂等 → 单行 + existed 语义） — `Promise.all([POST /api/rooms {room:A}, POST /api/rooms {room:A}])` → 断言 [r1.status, r2.status] === [200, 200]、DB 行数 = 1（GET /api/rooms/A/stats 应 200 而非 500）、[r1.body.existed, r2.body.existed] = 至少一个 true 一个 false（顺序随机因 race）
  What to do / Must NOT do: 用 `Promise.all` 真正并行；禁串行（失去 race 含义）；禁依赖 DB 行数探测（用 server GET 即可）
  Parallelization: Wave 2 | Blocked by: T1 | Blocks: F1-F4
  References:
    - app/api/rooms/route.ts:71-90（POST 契约、200/422/500）
    - lib/db.ts:466-490（registerOrLoginRoom 内部 UNIQUE race-safe read-then-upsert）
    - db/schema.ts:gameStats 表 + room TEXT UNIQUE（db/schema.ts:50 附近）
    - tests/qa/concurrent-surface-qa.mjs:78-90（SINGLE_SIDE 已废，本票禁复用——step 1 范围外）
  Acceptance criteria:
    - step 4 PASS 输出 `STEP: step 4 (S6 双发 POST 幂等) ... PASS`
    - [r1.status, r2.status] === [200, 200]
    - DB 仅一行（GET /stats 200，stats.totalGames=0）
    - [r1.existed, r2.existed] === [true, false] 或 [false, true]（顺序随机）
  QA scenarios:
    - happy — `:3101` hermetic + 探针运行 → exit 0
    - failure — 故意把第二个 POST 改成不同 room（race=2 行）→ RED（验完撤回）
    - Evidence: `.omo/evidence/ulw-rooms-race-qa-ticket/task-4-step4.log`
  Commit: Y | `test(qa): rooms-race-qa step 4 — 双发 POST /api/rooms 幂等`

- [ ] 5. tests/qa/rooms-race-qa.mjs: 实现 step 5（S5 房间删除后 outcome → 404 stats-not-found + banner 端到端） — POST /api/rooms 建房间 → 用 `child_process.execFileSync('node', ['-e', script])` 起子 libsql client 直连 `file:${DB_PATH}` 跑 `DELETE FROM game_stats WHERE room = ?` → POST 1 次 outcome → 浏览器侧：goto /result?room= → 软刷新触发 outcomeError 状态写入（直接调用 store.setOutcomeError 不行；必须 POST outcome 走真实链）→ 断言 response.status === 404、response body type === `https://docs.example.com/probs/stats-not-found`、浏览器侧 data-testid="outcome-error-banner" 可见（先玩一局触发 → 行不存在 → banner 出现）
  What to do / Must NOT do: 子进程 libsql 用 `createClient({ url })` 而非 `@libsql/client/web`（保持 file: 兼容）；禁假定行存在（必须先 DELETE）；禁依赖 store.setOutcomeError 直调（端到端必须 POST outcome 触发 apiRecordOutcome 的 404→'not-found' 翻译）
  Parallelization: Wave 2 | Blocked by: T1 | Blocks: F1-F4
  References:
    - app/api/rooms/[room]/stats/outcomes/route.ts:55-72（404 路径）
    - lib/api-problem.ts（problem+json 形态、TAG 类型 URI base）
    - lib/store.ts:78,461-500（outcomeError 单点翻转 + apiRecordOutcome 的 404→'not-found' 翻译）
    - components/OutcomeErrorBanner.tsx:11-22（REASON_COPY not-found 文案 + data-testid）
    - app/result/page.tsx:94,169（banner 挂载点）
    - app/online/page.tsx:49（banner 挂载点）
    - lib/game-net.ts（POST outcome error 包装 — `FetchResult` 词汇表含 'not-found'）
    - tests/db/ta-transaction-feasibility.test.ts:80-120（libsql 子进程 + createClient 范式）
  Acceptance criteria:
    - step 5 PASS 输出 `STEP: step 5 (S5 404 + OutcomeErrorBanner 端到端) ... PASS`
    - POST outcome response.status === 404
    - response.body.type === `https://docs.example.com/probs/stats-not-found`
    - 浏览器侧 data-testid="outcome-error-banner" 可见，含「战报上传失败（房间不存在）」文案
  QA scenarios:
    - happy — `:3101` hermetic + 探针运行 → exit 0
    - failure — 故意不 DELETE → row 仍存在 → outcome 200 → banner 不出现 → RED（验完撤回）
    - Evidence: `.omo/evidence/ulw-rooms-race-qa-ticket/task-5-step5.log` + `task-5-banner.png`
  Commit: Y | `test(qa): rooms-race-qa step 5 — 房间删除后 outcome 404 + banner 端到端`

- [ ] 6. tests/qa/rooms-race-qa.mjs: 实现 step 6（S7 SW non-GET pass-through + 激活竞争，B-1/E1 直系后继） — 监听 `page.on('request')` 收集 POST /api/rooms 的 SW intercept 情况 → 断言 service worker 不拦截 non-GET（方法 = POST）；额外：注册新 SW 后触发 `controllerchange` + 检查 navigator.serviceWorker.controller.scriptURL 的 cache 名匹配 CACHE_NAME = `tic-tac-toe-${APP_VERSION}`（v0.1.1）
  What to do / Must NOT do: 不重写 sw.js；只观测 network panel + service worker registration；禁 assume SW 总是注册（可能首次访问无 SW）
  Parallelization: Wave 3 | Blocked by: T1 | Blocks: F1-F4
  References:
    - public/sw.js:1-30（install/activate/fetch 监听、CACHEABLE_RE、non-GET pass-through）
    - public/sw.js:7-8（CACHE_NAME = `tic-tac-toe-${APP_VERSION}` 当前 v0.1.1）
    - public/sw.js:53-70（fetch handler non-GET pass-through 实现）
    - .omo/research-rooms-race-probe-20260924.md:46 step 6（B-1 SW double-PUT + E1 SW 激活竞争直系后继）
    - tests/qa/pwa-sw-cache-qa.mjs（SW 探针形态参照 — 若存在）
    - tests/qa/sw-console-hygiene.mjs（SW 探针形态参照）
  Acceptance criteria:
    - step 6 PASS 输出 `STEP: step 6 (S7 SW non-GET + 激活竞争) ... PASS`
    - page.on('request') 监听期间 POST /api/rooms 的 request.frame() 不是 SW（method=POST、SOURCE=network）
    - navigator.serviceWorker.controller.scriptURL 含 `sw.js`
    - CACHE_NAME === `tic-tac-toe-v0.1.1`（grep sw.js 当前值）
  QA scenarios:
    - happy — `:3101` hermetic + 探针运行 → exit 0
    - failure — 故意改 sw.js 的 fetch handler 加 POST 拦截（不 commit，仅本机 sandbox） → 探针 RED（验完撤回）
    - Evidence: `.omo/evidence/ulw-rooms-race-qa-ticket/task-6-step6.log`
  Commit: Y | `test(qa): rooms-race-qa step 6 — SW non-GET pass-through + 激活竞争`

- [ ] 7. tests/qa/rooms-race-qa.mjs: 实现 step 7（慢 DB outcomes ordering → ordering 保持 + 终态 DOM===API，D4/旧14 直系后继） — 用 `page.route('**/api/rooms/*/stats/outcomes', route => setTimeout(() => route.continue(), 800))` 给 outcomes 加 800ms 延迟 → 连发 3 次 outcome（X、O、draw）→ 等所有响应 → 服务端 GET stats → 断言 totalGames=3、xWins=1、oWins=1、draws=1、currentStreak=—（最后是 draw 重置 streak）；浏览器侧：在 /result 上等 force-dynamic 重读后断言 DOM===API（每个 stat-value 的 data-value 与 API.stats 对应字段 ===）
  What to do / Must NOT do: 必须用 `page.route` 拦截（不是 page.routeFromHAR 等）；禁依赖 `waitForTimeout` 而非 `waitForResponse` 等待所有响应；禁比对 DOM 文本（数据契约是 data-value 属性）
  Parallelization: Wave 3 | Blocked by: T1 | Blocks: F1-F4
  References:
    - app/api/rooms/[room]/stats/outcomes/route.ts:55-72（POST outcomes）
    - lib/db.ts:384-394（recordOutcomeForRoom 三步）
    - lib/game.ts:recordOutcome（纯函数）
    - .omo/research-rooms-race-probe-20260924.md:46 step 7（D4 慢 DB ordering 直系后继 + 旧 step 14 DOM===API）
    - tests/qa/room-reset-qa.mjs:130-145（waitForFunction + stat-value data-value 读取）
  Acceptance criteria:
    - step 7 PASS 输出 `STEP: step 7 (slow DB outcomes ordering + DOM===API) ... PASS`
    - 服务端 GET stats.totalGames === 3、xWins === 1、oWins === 1、draws === 1
    - DOM 端 4 个 stat-value data-value 分别为 "3", "1", "1", "1"
    - DOM===API 严格相等
  QA scenarios:
    - happy — `:3101` hermetic + 探针运行 → exit 0
    - failure — 故意把拦截 setTimeout 改 50ms（过短）→ 探针仍 PASS 但失去慢 DB 语义；本表只验契约，故 failure 用「故意让 server.ts 返回错 order=乱序」撤调
    - Evidence: `.omo/evidence/ulw-rooms-race-qa-ticket/task-7-step7.log`
  Commit: Y | `test(qa): rooms-race-qa step 7 — 慢 DB outcomes ordering + DOM===API`

- [ ] 8. tests/qa/probe-reconciliation.test.ts: 新建自维护对账 vitest 用例 — 正向：解析 `.github/workflows/ci.yml` 中 `tests/qa/*.mjs` 引用，断言每个引用文件存在（绝对路径 + existsSync）；反向：扫描 `tests/qa/*.mjs`，断言每个文件 a) 被 ci.yml 或 docs/commands.md 显式引用、b) 或头部前 20 行含 `DISABLED` 标记、c) 或在测试内嵌的 KNOWN_ORPHANS 白名单常量（10 条带 TODO 注释）；注入对照：mkdtemp 复制 ci.yml，注入 `tests/qa/ghost-probe.mjs`，断言用例 red — `vi.assert` capture 在 export 路径
  What to do / Must NOT do: 用 fs.readFileSync + 正则解析（不引入 yaml）；KNOWN_ORPHANS 常量每条带 `// TODO: triage in <ticket>` 注释；白名单不是「已知脏」是「已知待 triage」机制，新增 orphan（非白名单）立即 fail
  Parallelization: Wave 4 | Blocked by: T1 | Blocks: T9, F1-F4
  References:
    - .omo/research-rooms-race-probe-20260924.md:105-127（机械对账方法的真源 + 工具生态）
    - docs/anti-patterns.md:209-235（L1-31 真源 — 退役文件时清引用方）
    - .github/workflows/ci.yml:117（visual-qa.mjs 引用参照）
    - docs/commands.md:14,29,42,43（探针引用源）
    - tests/qa/merge-sync-qa.mjs:1-2 + `tests/qa/sync-qa.mjs:1-2`（DISABLED header 判据）
    - tests/qa/commit-audit.test.ts:1-100（vitest 集成测试范式 + mkdtemp/rmSync cleanup）
    - tests/qa/AGENTS.md:14-23（探针地图表 — 探针需登记的位置）
  Acceptance criteria:
    - `pnpm vitest run tests/qa/probe-reconciliation.test.ts` exit 0
    - 正向：当前 ci.yml 唯一探针（visual-qa.mjs）→ 存在断言通过
    - 反向：当前 22 个 .mjs 文件（含本次新增的 rooms-race-qa.mjs）→ 全部 ∈ {cited, DISABLED, KNOWN_ORPHANS}
    - 注入对照：临时注入 ghost 名 → 反向断言 FAIL
    - 撤掉注入 → 恢复 PASS
    - KNOWN_ORPHANS 白名单 10 条（audio-probe/audio-cheer/audio-confetti-qa/hydration-check/sw-console-hygiene/anonymous-first-game-qa/one-screen-qa/offline-result-qa/result-fresh-qa/result-celebration-qa），每条带 TODO 注释指向 plan 文件
  QA scenarios:
    - happy — `pnpm vitest run tests/qa/probe-reconciliation.test.ts` → exit 0
    - failure — 临时往 ci.yml 加 `tests/qa/ghost-probe.mjs` → 测试 RED
    - Evidence: `.omo/evidence/ulw-rooms-race-qa-ticket/task-8-reconciliation.log`
  Commit: Y | `test(qa): probe-reconciliation 用例 — ci.yml ↔ tests/qa/*.mjs 双向对账`

- [ ] 9. .github/workflows/ci.yml: 新增 `rooms-race` job（参照 visual-qa 形态：`needs: [build]`、`:3101` hermetic、`DATABASE_URL=file:/tmp/ulw-rr1-${{ github.run_id }}.db` + `PORT=3101`、`pnpm start &` + 30s ready check、`pnpm exec playwright install --with-deps chromium`、`pnpm exec node tests/qa/rooms-race-qa.mjs`、kill server、upload-artifact rooms-race-qa-evidence）。同时 rm `tests/qa/concurrent-surface-qa.mjs`（L1-31 双保险：删前 rg `concurrent-surface` 全仓已确认仅 historical / plan 归档 + docs/business-rules.md BR-6 dangle 一处 active，BR-6 dangle 报告为已知、不在本票改）
  What to do / Must NOT do: 不动 lint/typecheck/test/build 4 个基础 job；不动 visual-qa job；不调 GitHub ruleset（外发动作，写进 commit body）
  Parallelization: Wave 5 | Blocked by: T8 | Blocks: F1-F4
  References:
    - .github/workflows/ci.yml:78-126（visual-qa job 模板 — Start production server + Run probe + Stop + artifact 范式）
    - docs/commands.md:14,17-19（端口约定 + 探针启动范式）
    - .omo/research-rooms-race-probe-20260924.md:140-148（CI 上线 + main-gate ruleset 同步命令）
    - .omo/plans/ulw-rooms-race-map-20260924.md:49-55（CI job 上线 + ruleset 同步的外发动作约定）
    - docs/anti-patterns.md:209-235（L1-31）
    - docs/business-rules.md:16（BR-6 行 dangle — 报告，不改）
  Acceptance criteria:
    - ci.yml 含新 `rooms-race` job（grep 验证）
    - 不含 `concurrent-surface-qa.mjs` 文件（rg 验证）
    - rg `concurrent-surface` 全仓：仅保留历史归档（.omo/plans/*.md, .omo/research-*.md, tests/db/ta-transaction-feasibility.test.ts:6 历史注释, reports/review/*.md, docs/business-rules.md:16 active dangle）— active 仅 BR-6 一处 dangle，其余皆历史归档
  QA scenarios:
    - happy — `git diff .github/workflows/ci.yml` 显示新增 rooms-race job + `ls tests/qa/concurrent-surface-qa.mjs` 不存在 + `rg -n 'concurrent-surface-qa.mjs' tests docs lib app` 命令不在（待 verify）
    - failure — 故意保留磁盘文件回写 → rg 测试 RED（验完撤回）
    - Evidence: `.omo/evidence/ulw-rooms-race-qa-ticket/task-9-ci-del.log`
  Commit: Y | `ci(qa): rooms-race job + 删僵尸 concurrent-surface-qa（L1-31 双保险）`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit — `git diff main` 仅含 `tests/qa/rooms-race-qa.mjs`、`tests/qa/probe-reconciliation.test.ts`、`tests/qa/AGENTS.md`、`tests/qa/concurrent-surface-qa.mjs`(删)、`.github/workflows/ci.yml`、`.omo/plans/ulw-rooms-race-qa-ticket-20260924.md`、`.omo/evidence/ulw-rooms-race-qa-ticket/{report,orphans-found,probe-summary}.md`。验证 `rg -n 'concurrent-surface-qa\.mjs' .` 仅剩历史归档 + docs/business-rules.md:16 dangle
- [ ] F2. Code quality review — 探针代码 ≥ 200 行（足以覆盖 6 step + 慢 DB 拦截 + SW 监听 + libsql 子进程）；reconciliation test ≥ 100 行（含 10 条白名单 TODO + 正反向 + 注入对照）；代码风格沿用 `tests/qa/room-reset-qa.mjs`（assert.strict + step helper + findings 数组 + writeQaLog + unhandledRejection）；eslint 跳过 tests/qa/**（globalIgnores 已配）；reconciliation test 的 TS 风格沿用 `tests/qa/commit-audit.test.ts`
- [ ] F3. Real manual QA — `:3101` hermetic 生产构建下 `node tests/qa/rooms-race-qa.mjs` 6 step 全绿（exit 0；stdout `6 PASS / 0 FAIL / 6 total`）；`pnpm vitest run` 全绿（含 reconciliation test）；`pnpm typecheck` exit 0；`pnpm lint` exit 0；`pnpm build` exit 0；`node tests/qa/commit-audit.mjs --branch main`（R6 BR-6 dangle 已知 FAIL，其余 PASS）— 6 层验证结果全入 `.omo/evidence/ulw-rooms-race-qa-ticket/probe-summary.md`
- [ ] F4. Scope fidelity — 不实现 step 1（grep `Promise.all.*POST.*outcomes.*POST.*outcomes` 在 rooms-race-qa 同一 step 内仅 step 2、step 3 — step 2 是 merge+outcome 混合、step 3 是 reset+outcome race — 不是同房间并发 outcomes）；不改 `lib/` / `app/` / `components/` / `db/` / `docs/` / `tests/db/`（`git diff --name-only main..HEAD` 不含这些路径）；不 push、不发 gh api、不 `--no-verify`

## Commit strategy
- 原子提交：每个 todo 一 commit，共 9 个 commit（8 实现 + 1 删除）
- commit 顺序：T1 → T2-T7（可串行，因同一文件）→ T8 → T9
- subject 必须 = `<type>(<scope>): <中文描述>`（type ∈ feat/fix/refactor/test/docs/chore/ci/perf，scope 用 qa/ci/rooms-race 等）
- 正文 = WHAT / WHY / HOW 三段（中文，每行 ≤72 字符）
- trailer 至少含 Constraint / Rejected / Confidence / Scope-risk / Directive / Tested（每行 ≤100 字符）
- Plan footer：`Plan: .omo/plans/ulw-rooms-race-qa-ticket-20260924.md`
- 禁 `--no-verify`（commit-msg hook 强制）
- 不 push；本票以分支末端交付

## Success criteria
- AC-1 | `pnpm vitest run` exit 0（含 probe-reconciliation.test.ts） | 证据：`.omo/evidence/ulw-rooms-race-qa-ticket/ac1-vitest.log`
- AC-2 | `pnpm typecheck` exit 0 | 证据：`.omo/evidence/ulw-rooms-race-qa-ticket/ac2-typecheck.log`
- AC-3 | `pnpm lint` exit 0 | 证据：`.omo/evidence/ulw-rooms-race-qa-ticket/ac3-lint.log`
- AC-4 | `pnpm build` exit 0 | 证据：`.omo/evidence/ulw-rooms-race-qa-ticket/ac4-build.log`
- AC-5 | `DATABASE_URL=file:/tmp/ulw-rr1-${{ run_id }}.db PORT=3101 pnpm start` + `BASE_URL=http://localhost:3101 node tests/qa/rooms-race-qa.mjs` exit 0；stdout `6 PASS / 0 FAIL / 6 total`；进程杀干净 | 证据：`.omo/evidence/ulw-rooms-race-qa-ticket/ac5-rooms-race-qa.log`
- AC-6 | `ls tests/qa/concurrent-surface-qa.mjs` 不存在 + `rg -n 'concurrent-surface-qa\.mjs' tests docs lib app components` 仅剩 docs/business-rules.md:16 active dangle | 证据：`.omo/evidence/ulw-rooms-race-qa-ticket/ac6-delete.log`
- AC-7 | reconciliation test 正反两面：临时往 ci.yml 注入 `tests/qa/ghost-probe.mjs` → 用例 red；撤回 → 绿；现有合法引用全过 | 证据：`.omo/evidence/ulw-rooms-race-qa-ticket/ac7-mutation.log`
- AC-8 | `git diff --name-only main..HEAD` 仅含 `tests/qa/rooms-race-qa.mjs`、`tests/qa/probe-reconciliation.test.ts`、`tests/qa/AGENTS.md`、`.github/workflows/ci.yml`、`.omo/plans/ulw-rooms-race-qa-ticket-20260924.md`、`.omo/evidence/ulw-rooms-race-qa-ticket/{report,orphans-found,probe-summary}.md` + 显式删除的 `tests/qa/concurrent-surface-qa.mjs`（diff 中显示为 deleted）| 证据：`.omo/evidence/ulw-rooms-race-qa-ticket/ac8-diff.log`
- AC-9 | 不实现 step 1：`rg -c 'driveContext.*newContext.*newContext.*race.*outcome' tests/qa/rooms-race-qa.mjs` = 0（无同房间并发 outcomes 探针段）| 证据：`.omo/evidence/ulw-rooms-race-qa-ticket/ac9-no-step1.log`
