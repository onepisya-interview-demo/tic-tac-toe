# pwa-rsc-stats-bug-fix - Work Plan

## TL;DR (For humans)

**What you'll get:** 修复 3 个生产独占 bug（Service Worker 重发 PUT、PlayController setTimeout 竞态、RSC 静态预渲染导致战绩陈旧），让 reviewer 手测 demo 时不翻车；同时新增 1 个 14 步集成探针覆盖客户端导航路径，并把根因沉淀到 AGENTS.md §反模式 + docs/learnings.md #28。

**Why this approach:**
- **数据流 + 资源生命周期双轴视角**（不是单纯修症状）——B-1 是 SW 接管无门控，B-2 是 setTimeout 与 PUT 落库时刻无协调 + 模块级 `internalStats` 长存 + multi-PUT 无序，B-3a 是 build-time 烘焙脏数据。三个 bug 共享同一种"协调原语缺失"模式。
- **demo 优先选简单方案**——`force-dynamic`（一行配置）而非 ISR（需要 `revalidate` + `revalidatePath` + 缓存模型解释）；事件驱动（订阅 lastWriteAt）而非缩短 setTimeout 窗口（仍是时间假设）。
- **后端存在是跨设备 + 面试展示，不是游戏本身需要**——你已明确纠正"不是读多写少"；本项目 2 读 + 1 写 + 偶发 DELETE；保留后端只为 (a) 换手机战绩还在 + (b) 你面试全栈展示 DB 使用能力。

**What it will NOT do:**
- 不改 PUT/DELETE Route Handler 形状；不动 `'use client'` 边界；不引入新依赖；不启用 cacheComponents；不修复 pre-existing 的 Stryker `db.test.ts` `process.chdir()` blocker；不触碰未提交工作区 `AGENTS.md` 顶部一行。
- 不为"高吞吐"服务——本项目数据流规模小（2 读 + 1 写）；不为流量增长做架构优化（YAGNI）。
- 不调 `revalidatePath`（`force-dynamic` 下冗余；commit 3 简化为单文件改动）。

**Effort:** Short（~50 分钟 wall time；8 commit × 5-15 分钟（commit 1 Stryker 修复 ~3 分钟；其余按 v7）/个 + 部署后手动 QA 10 分钟）
**Risk:** Medium——store 是 hot path（commit 3 多个调用方需适配）；其余 6 commit 都是单文件改动，scope-risk Low。
**Decisions to sanity-check:**
1. `force-dynamic` 而非 ISR（v7 §13.6 三条理由）
2. 事件驱动替代 setTimeout（vs 缩短窗口仍是时间假设）
3. 单一新增 `stats-race-qa.mjs` 而非扩 8 个现有脚本（v7 §五 决策）
4. commit 3 暂跳 on-demand mutation testing（pre-existing blocker，不属本 plan）

Your next move: 跑 momus + independent Codex CLI 双高准确度审查 → 展示最终 plan 路径 → 用户批准后由 `$start-work` worker 执行（不在本会话执行）。

---

> TL;DR (machine): 8 atomic commits (1 Stryker prerequisite + 4 bug fixes + 1 test + 2 docs), ~53 min wall time, Medium risk, demo-friendly simplicity over architectural cleverness

## Scope
### Must have

1. **修 SW fetch handler** 方法门控（[public/sw.js:25](public/sw.js) 加 `if (event.request.method !== 'GET') return;`）
2. **修 RSC 静态预渲染**：`app/page.tsx` + `app/result/page.tsx` 各加 `export const dynamic = 'force-dynamic';`
3. **修 store 异步化**：`lib/store.ts` `makeMove`/`resetAll` 改 async 返回 Promise；新增 `lastWriteAt: number | null`；`resetAll` 内部简化
4. **修 PlayController 事件驱动**：`components/PlayController.tsx` 订阅 `lastWriteAt` + phase；去 setTimeout
5. **修重置按钮 await**：`components/ResetStatsButton.tsx` + `components/ResultActions.tsx` 改 await resetAll + refresh
6. **新增 stats-race-qa 集成探针**：`tests/qa/stats-race-qa.mjs` 14 step 消融 + 集成
7. **增强 db 测试接缝**：`lib/db.ts` `__setCreateClientForTests` 支持 `delayMs`
8. **沉淀 AGENTS.md 反模式** 3 条
9. **沉淀 docs/learnings.md #28** 条目
10. **写正式 plan** `.omo/plans/pwa-rsc-stats-bug-fix.md` + commit footer 引用

### Must NOT have (guardrails, anti-slop, scope boundaries)

- ❌ 新增任何 npm 依赖
- ❌ 启用 `cacheComponents: true`（next.config.ts 保持空）
- ❌ 改动 `'use client'` 边界位置
- ❌ 引入 `'use server'` directive
- ❌ 切换 ORM（Drizzle 保持）
- ❌ 删除 `components/StatsHydrator.tsx`
- ❌ 改动 `lib/game.ts` 纯规则
- ❌ 改动 `DESIGN.md` 或视觉契约
- ❌ 改动 commit-msg hook
- ❌ 引入 React Context 携带 stats
- ❌ 改动 `app/api/stats/route.ts` 的 PUT/DELETE 形状
- ❌ 改动现有 8 个 qa 脚本
- ❌ 重命名任何 `data-testid`
- ❌ 把多个修复合并成一个 commit
- ❌ 用 `--no-verify` 绕过 commit-msg hook
- ❌ 触碰未提交工作区 `AGENTS.md` 顶部一行「总是使用中文进行回复。」
- ❌ 修复 Stryker `db.test.ts` `process.chdir()` blocker（pre-existing；不属本计划）
- ❌ 调 `revalidatePath`（force-dynamic 下冗余；v7 §六 commit 3 决策）

## Verification strategy
> Zero human intervention - all verification is agent-executed.

**Test decision**: tests-after（每个 commit 单独跑 6 层 Gauntlet）+ 新增 1 个集成探针 `stats-race-qa.mjs`；**test framework**: vitest 5 + jsdom 30（88 例）+ Playwright（production build + real Chromium）。

**6 层 Gauntlet（每 commit 必跑）**：

| 层 | 工具 | scope | 触发条件 |
|---|---|---|---|
| Tests | vitest | 88 例（commit 改 `lib/store.ts` 触发 on-demand） | 每 commit |
| Types | tsc 5 strict | 全部 | 每 commit |
| Lint | eslint 9 | 全部（tests/qa/** ignore） | 每 commit |
| Build | next build | 全部 | 每 commit |
| Commit-audit | tests/qa/commit-audit.mjs --branch main | commit message | 每 commit |
| Browser QA | tests/qa/*.mjs 探针 | 触及 UI 时 | 触发 commit 1-5 |

**On-demand 触发**：

| 层 | scope | 触发 commit | 本 plan 状态 |
|---|---|---|---|
| Coverage | vitest --coverage v8（`lib/**`+`db/**`，thresholds 80/80/70/80） | commit 3 改 `lib/store.ts` | ✅ 必跑 |
| Mutation | Stryker（scope 4 个文件） | commit 3 改 `lib/store.ts` | ⚠️ 跳过（pre-existing `db.test.ts` blocker） |
| Property-based | fast-check | 新增 `lib/X.ts` 纯函数 | n/a（本 plan 无新增） |

**QA 探针覆盖矩阵**（每 commit 必须回归清单）：

| 探针 | commit 1 | commit 2 | commit 3 | commit 4 | commit 5 | commit 6/7 |
|---|---|---|---|---|---|---|
| hydration-check | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| ux-qa (9 场景) | — | ✓ | ✓ | ✓ | — | — |
| visual-qa | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| commit-audit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| audio-cheer | — | — | — | ✓ | ✓ | — |
| audio-confetti-qa | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| audio-probe | — | — | — | — | ✓ | — |
| confetti-origin-qa | — | — | — | ✓ | ✓ | — |
| **stats-race-qa（新）** | — | — | — | — | ✓ + 必跑 | — |

**Evidence 路径**：`<attemptDir>/task-<N>-pwa-rsc-stats-bug-fix.<ext>` = `.omo/evidence/pwa-rsc-stats-bug-fix/task-{N}.{log,png,html,txt}`（每 commit 单独留证据）。

**手动 QA gate（部署后必跑，5 步 3 分钟）**：v7 §8.1（5 步）+ §8.2 回归（5 步）+ §8.3 跨会话（2 步）。所有失败信号速查见 §8.4。

## Execution strategy

### Parallel execution waves

**Wave 1（3 个 commit，可并行）**：
- todo 1：chore(stryker) — 修 db.test.ts chdir blocker（独立）
- todo 2：fix(sw) — SW 方法门控
- todo 3：fix(rsc-dynamic-flag) — RSC 加 force-dynamic

**Wave 2（3 个 commit，串行）**：
- todo 4：fix(async-store) — store 改 async（必须等 todo 1 + todo 3 完成）
- todo 5：fix(play-controller) — PlayController 改事件驱动（必须等 todo 4 完成）
- todo 6：test(stats-race-qa) — 新探针（必须等 todo 2-5 全部完成）

**Wave 3（2 个 docs commit，可并行）**：
- todo 7：docs(agents-md) — AGENTS.md 反模式 3 条
- todo 8：docs(learnings) — learnings.md #28

### Dependency matrix

| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 chore(stryker) | — | 4 | 2, 3 |
| 2 fix(sw) | — | 6 | 1, 3 |
| 3 fix(rsc-dynamic-flag) | — | 4 | 1, 2 |
| 4 fix(async-store) | 1, 3 | 5 | — |
| 5 fix(play-controller) | 4 | 6 | — |
| 6 test(stats-race-qa) | 2, 3, 4, 5 | — | — |
| 7 docs(agents-md) | — | — | 8 |
| 8 docs(learnings) | — | — | 7 |

**Wave 总时长估算**（串行；每 commit ~5-15 分钟）：
- Wave 1: 10 分钟（2 commit 并行）
- Wave 2: 35 分钟（3 commit 串行；含 commit 4 触发 on-demand coverage）
- Wave 3: 5 分钟（2 commit 并行）
- 总计 ~50 分钟（不含部署后手动 QA gate 的 10 分钟）

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [ ] 1. 修 Stryker mutation 阻断器（修 [tests/db/db.test.ts:226](tests/db/db.test.ts) `process.chdir` 在 Vitest worker 不支持）
  What to do / Must NOT do:
    - 改 [tests/db/db.test.ts:226](tests/db/db.test.ts) 的 `process.chdir(freshDir)` 为 `vi.spyOn(process, 'cwd').mockReturnValue(freshDir)`。
    - 改 [tests/db/db.test.ts:243](tests/db/db.test.ts) 的 `process.chdir(prevCwd)` 为 `vi.mocked(process.cwd).mockRestore()`。
    - 不要改 `lib/db.ts:14` 的 `const DEFAULT_DB_PATH = path.join(process.cwd(), 'data', 'tic-tac-toe.db')`——保留单点真相，测试只需 mock `process.cwd()` 返回值。
    - 不要新增 npm 依赖（`vi.spyOn` 是 vitest 内置）。
    - 不要碰 [stryker.config.mjs](stryker.config.mjs) 的 mutate scope 或 coverageAnalysis 配置。
  Parallelization: Wave 1（独立，可与 todo 2 / todo 3 并行） | Blocked by: — | Blocks: 4（commit 4 触发 on-demand mutation，依赖此 blocker 修好）
  References (executor has NO interview context - be exhaustive):
    - [tests/db/db.test.ts:226](tests/db/db.test.ts)（`process.chdir(freshDir)` 位置）
    - [tests/db/db.test.ts:243](tests/db/db.test.ts)（`process.chdir(prevCwd)` 位置）
    - [lib/db.ts:14](lib/db.ts)（`DEFAULT_DB_PATH = path.join(process.cwd(), ...)`）
    - [lib/db.ts:64,79](lib/db.ts)（`fs.mkdirSync(dir, { recursive: true })` 自动创建 data/ 子目录）
    - [.omo/evidence/rsc-leaf-boundary-refactor-manualqa/mutation-current-head.log](.omo/evidence/rsc-leaf-boundary-refactor-manualqa/mutation-current-head.log)（原 blocker 实证：`process.chdir() is not supported in workers`）
    - [vitest.config.ts](vitest.config.ts)（默认 pool 配置）
    - [stryker.config.mjs](stryker.config.mjs)（mutate scope: `lib/game.ts lib/db.ts lib/store.ts db/schema.ts`）
  Acceptance criteria (agent-executable):
    - `node tests/qa/commit-audit.mjs --message-file <msg>` 通过
    - `pnpm vitest run tests/db/db.test.ts` 100% 通过（含改后 `default branch creates the missing data/ dir under CWD` 用例）
    - `pnpm typecheck` exit 0
    - `pnpm lint` exit 0
    - `pnpm build` exit 0
    - `pnpm test:mutation` 不再以 `process.chdir() is not supported in workers` 失败（dry-run 通过；mutation score 报告正常生成）
  QA scenarios:
    - happy: `pnpm test:mutation` dry-run 通过；Stryker 跑 4 个 mutate 文件的全部 mutants，score 报告生成到 `reports/mutation/html/index.html`
    - failure: 修复前 `pnpm test:mutation` 第 1 步 dry-run 立即 throw `ConfigError: There were failed tests in the initial test run`
    - Evidence: `.omo/evidence/pwa-rsc-stats-bug-fix/task-1-stryker-mutation.log` + `.omo/evidence/pwa-rsc-stats-bug-fix/task-1-mutation-score.txt`
  Commit: Y | `chore(stryker): mock process.cwd() in db.test for worker pool`
    - WHY: prior C4 RSC refactor 留下的测试基础设施债——Stryker 用 Vitest runner 跑 dry-run，`tests/db/db.test.ts` 的 `process.chdir()` 在 worker thread 里抛错阻断整个 mutation testing。commit 4 改 `lib/store.ts` 触发 on-demand mutation，没有这个 fix 就跑不了——等于本 plan 在 commit 4 失去 mutation-level 信心。
    - HOW: 把 `process.chdir(freshDir)` / `process.chdir(prevCwd)` 替换为 `vi.spyOn(process, 'cwd').mockReturnValue(freshDir)` / `vi.mocked(process.cwd).mockRestore()`。不切实际 cwd，mock 返回值；`lib/db.ts` 读取 `process.cwd()` 仍拿到 freshDir；`fs.mkdirSync` 仍能在 freshDir 创建 `data/` 子目录。
    - lore trailers: Constraint: 不改 `lib/db.ts` 单点真相; Rejected: 改 vitest pool 为 `forks`（其他测试可能更慢）; Rejected: 改 `DEFAULT_DB_PATH` 接受参数（churn > value）; Confidence: High; Scope-risk: Low（单文件 ~3 行替换）; Directive: 不动 stryker.config.mjs mutate scope; Tested: vitest tests/db + typecheck + lint + build + test:mutation dry-run 5 项全绿; Not-tested: Vercel 生产（无关）
    - Plan: .omo/plans/pwa-rsc-stats-bug-fix.md

- [ ] 2. 修 SW fetch handler（修 B-1：PUT/DELETE 被发两次）
  What to do / Must NOT do:
    - 在 [public/sw.js:25](public/sw.js) 的 `self.addEventListener('fetch', (event) => { ... })` 顶部加 1 行守卫：`if (event.request.method !== 'GET') return;` 在 `event.respondWith(...)` 之前。
    - 不要改 SW 安装/激活逻辑（`skipWaiting + clients.claim` 保持）。
    - 不要引入 Workbox 或第三方 SW 库（AGENTS.md "Never introduce a new npm dependency"）。
  Parallelization: Wave 1 | Blocked by: — | Blocks: 5（stats-race-qa 探针依赖 SW 修后行为）
  References (executor has NO interview context - be exhaustive):
    - [public/sw.js](public/sw.js)（完整文件，单 fetch listener）
    - 用户先前 web 研究：[MDN ServiceWorkerGlobalScope.fetch_event](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/fetch_event)、[web.dev/learn/pwa/serving](https://web.dev/learn/pwa/serving)、[Stack Overflow "Requests through service-worker are done twice"](https://stackoverflow.com/questions/50129311/requests-through-service-worker-are-done-twice)
    - v7 §六 commit 1 范式代码
    - [tests/qa/audio-confetti-qa.mjs](tests/qa/audio-confetti-qa.mjs) step `stats persist`（核心回归断言）
    - [tests/qa/visual-qa.mjs](tests/qa/visual-qa.mjs) step 5 `apiResp` 断言（断言 `totalGames=1`）
    - [components/ServiceWorkerRegister.tsx:25-27](components/ServiceWorkerRegister.tsx)（prod guard `if (process.env.NODE_ENV !== "production") return;`）
  Acceptance criteria (agent-executable):
    - `node tests/qa/commit-audit.mjs --message-file <msg>` 通过
    - `pnpm vitest run` 100% 通过
    - `pnpm typecheck` exit 0
    - `pnpm lint` exit 0
    - `pnpm build` exit 0
    - `node tests/qa/audio-confetti-qa.mjs` PASS（`totalGames === 1` 断言保持绿）
    - `node tests/qa/visual-qa.mjs` PASS（step 5 `apiResp` 断言绿）
    - `node tests/qa/hydration-check.mjs` PASS（防 hydration 回归）
  QA scenarios (name the exact tool + invocation):
    - happy: `node tests/qa/audio-confetti-qa.mjs` 跑完后检查 `totalGames === 1`
    - failure: SW 未修前 `node tests/qa/audio-confetti-qa.mjs` 在 SW 注册成功场景下 `totalGames === 2`（作为对照基线）
    - Evidence: `.omo/evidence/pwa-rsc-stats-bug-fix/task-1.mp4` 或 `.omo/evidence/pwa-rsc-stats-bug-fix/task-1.log`
  Commit: Y | `fix(sw): non-GET requests bypass service worker`
    - WHY: SW fetch handler 无方法门控导致 PUT/DELETE 被发两次（DB 计数翻倍）；用户在生产 DevTools Network 面板观察到 2 行 PUT。
    - HOW: 在 `event.respondWith` 之前 `if (event.request.method !== 'GET') return;`。非 GET 请求走浏览器默认路径（无 SW 接管）。
    - lore trailers: Constraint: AGENTS.md "Never introduce a new npm dependency"; Rejected: Workbox / 其他 SW 框架; Confidence: High（用户 web 研究 + MDN 官方文档双重证实）; Scope-risk: Low（单文件 1 行修改）; Directive: 不动 SW install/activate 生命周期; Tested: vitest + typecheck + lint + build + audio-confetti-qa + visual-qa + hydration-check 7 项全绿; Not-tested: Vercel 生产 PUT 真实计数（需部署后人工验证；covered by stats-race-qa step 2/10/12）
    - Plan: .omo/plans/pwa-rsc-stats-bug-fix.md

- [ ] 3. RSC 页面加 `export const dynamic = 'force-dynamic'`（修 B-3a：DB 变了但页面永远是同一份 stats）
  What to do / Must NOT do:
    - 在 [app/page.tsx](app/page.tsx) 第 9 行（function 声明**之前**的文件顶部）加一行：`export const dynamic = 'force-dynamic';`
    - 在 [app/result/page.tsx](app/result/page.tsx) 第 9 行（function 声明**之前**的文件顶部）加同样一行。
    - 不要加 `export const revalidate = 60;`（v7 §13.6 三条理由：demo 优先选简单 + ISR 解释成本 + YAGNI）。
    - 不要碰 [next.config.ts](next.config.ts)（保持空，不启用 cacheComponents）。
    - 不要碰这两个 page 的函数体（保持 await `loadStats()` 不变）。
  Parallelization: Wave 1（可与 todo 1 并行） | Blocked by: — | Blocks: 3（store async 改 Promise 返回依赖 force-dynamic）
  References (executor has NO interview context - be exhaustive):
    - [app/page.tsx:9](app/page.tsx)（目标文件 + 行号）
    - [app/result/page.tsx:9](app/result/page.tsx)（目标文件 + 行号）
    - 官方文档（项目 v16.3.4 内置）：[node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md](node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md)
    - 硬证据：[.omo/evidence/rsc-leaf-boundary-refactor-manualqa/firstpaint-extraction.txt](.omo/evidence/rsc-leaf-boundary-refactor-manualqa/firstpaint-extraction.txt)（`x-nextjs-cache: HIT` + `x-nextjs-prerender: 1`）
    - v7 §六 commit 2 范式代码 + §13.6 force-dynamic vs ISR 决策
  Acceptance criteria (agent-executable):
    - `node tests/qa/commit-audit.mjs --message-file <msg>` 通过
    - `pnpm vitest run` 100% 通过
    - `pnpm typecheck` exit 0
    - `pnpm lint` exit 0
    - `pnpm build` exit 0（确保 build 不报 `dynamic` 配置错误）
    - `pnpm start` 后 `curl -I http://localhost:3000/` 响应头 **不再**含 `x-nextjs-cache: HIT` 或 `x-nextjs-prerender: 1`（vs 修复前都有）
    - `node tests/qa/visual-qa.mjs` PASS（step 4 重载 `/` 必须显示新战绩）
    - `node tests/qa/ux-qa.mjs` PASS（`home-empty` + `result-after-win` 两个依赖动态的场景保持绿）
  QA scenarios:
    - happy: `pnpm start` 后 `curl -sI http://localhost:3000/` | grep -E "x-nextjs-(cache|prerender)" 应为空
    - failure: 修复前 `curl -sI http://localhost:3000/` | grep "x-nextjs-cache" 输出 HIT
    - Evidence: `.omo/evidence/pwa-rsc-stats-bug-fix/task-2-curl-headers.txt`
  Commit: Y | `fix(rsc-dynamic-flag): disable static prerender for stats pages`
    - WHY: B-3a 实证——生产首屏 HTML 显示 `23,9,9,5,—` 而 DB 已 `totalGames:7`；build-time 烘焙脏数据。
    - HOW: `app/page.tsx` + `app/result/page.tsx` 各加 `export const dynamic = 'force-dynamic';` 一行；不动 page 函数体；不动 next.config.ts。
    - lore trailers: Constraint: AGENTS.md "改路由前读 node_modules/next/dist/docs/"; Rejected: ISR (`revalidate = 60`) 因 demo 优先选简单 + 演示场景差异远低于 1M 额度 + YAGNI; Confidence: High（官方文档 + 实证证据）; Scope-risk: Low（每文件 1 行）; Directive: 不动 next.config.ts / page 函数体 / 其他 RSC 路由; Tested: vitest + typecheck + lint + build + curl 响应头断言 + visual-qa + ux-qa 7 项全绿; Not-tested: Turso HTTP 真实延迟下的首屏时序（需部署后人工验证；covered by stats-race-qa step 4）
    - Plan: .omo/plans/pwa-rsc-stats-bug-fix.md

- [ ] 4. store 改 async 返回 Promise + `resetAll` 内部简化（修 B-2 部分 + B-3b）
  What to do / Must MUST NOT do:
    - 在 [lib/store.ts](lib/store.ts)：
      1. `makeMove` 改 `async`，返回 `Promise<void>`；移除 `void apiPutStats(newStats).catch(() => {})` 模式；改为 `await apiPutStats(newStats)`；末尾 `set({ lastWriteAt: Date.now() })`
      2. `resetAll` 改 `async`，返回 `Promise<void>`；内部简化为 `await apiDeleteStats(); internalStats = zeroStats(); set({ lastWriteAt: Date.now() })`
      3. 新增 state 字段：`lastWriteAt: number | null`（init: null）
      4. `setInitialStats` 末尾 `set({ lastWriteAt: Date.now() })`（stats 水合也算 write 事件）
    - 在 [components/PlayController.tsx](components/PlayController.tsx)：保留 `makeMove` 调用为 `useGameStore.getState().makeMove(idx)` 同步形式（不需要 await；订阅 lastWriteAt 感知完成）。
    - 在 [components/ResetStatsButton.tsx](components/ResetStatsButton.tsx) + [components/ResultActions.tsx](components/ResultActions.tsx)：调用 `resetAll()` 后 await + `router.refresh()`（串行）。
    - 不要在 Route Handler（[app/api/stats/route.ts](app/api/stats/route.ts)）调 `revalidatePath`（v7 §六 commit 3 决策 + §十 Open assumptions）。
    - 不要改 `internalStats` 模块级作用域（v7 §十 Open assumptions；保持模块级单例 + `__resetInternalForTests` 测试接缝）。
    - 不要改 PUT/DELETE 形状（AGENTS.md Scope OUT）。
  Parallelization: Wave 2 | Blocked by: 2（force-dynamic 必须先就位，因为删 revalidatePath 后 store 不再依赖 ISR 失效） | Blocks: 4（PlayController 改事件驱动需要 lastWriteAt 字段先存在）
  References (executor has NO interview context - be exhaustive):
    - [lib/store.ts:54](lib/store.ts)（`internalStats` 模块级位置）
    - [lib/store.ts:122,139,164-169](lib/store.ts)（PUT/DELETE 调用点）
    - [lib/store.ts:104](lib/store.ts)（`recordOutcome(internalStats,...)` 调用）
    - [components/ResetStatsButton.tsx:13-18](components/ResetStatsButton.tsx)
    - [components/ResultActions.tsx:29-37](components/ResultActions.tsx)
    - v7 §六 commit 3 范式代码
  Acceptance criteria (agent-executable):
    - `node tests/qa/commit-audit.mjs --message-file <msg>` 通过
    - `pnpm vitest run` 100% 通过（含 store 现有 8 例）
    - `pnpm typecheck` exit 0（async 函数返回 Promise<void> 类型对齐）
    - `pnpm lint` exit 0
    - `pnpm build` exit 0
    - `node tests/qa/visual-qa.mjs` PASS（step 3 win→/result 必须走通）
    - `node tests/qa/ux-qa.mjs` PASS（`play-win` + `result-after-win` 依赖 async store）
    - **on-demand coverage**（commit 改 `lib/store.ts` 触发）：`pnpm test:coverage` ≥ 80/80/70/80（v8 scope `lib/**`+`db/**`）
    - **on-demand mutation**：跳过（本 commit 不阻塞；Stryker `db.test.ts` `process.chdir()` 是 pre-existing blocker，AGENTS.md "Bug fix != surrounding cleanup"）
  QA scenarios:
    - happy: `pnpm vitest run tests/store.test.ts` 100% 通过
    - failure: `pnpm vitest run` 任意 store 测试 fail（store async 改错）
    - Evidence: `.omo/evidence/pwa-rsc-stats-bug-fix/task-3-coverage.html` + `.omo/evidence/pwa-rsc-stats-bug-fix/task-3-vitest.log`
  Commit: Y | `fix(async-store): makeMove and resetAll return awaited Promise`
    - WHY: B-2（PUT fire-and-forget 无顺序保证）+ B-3b（resetAll + refresh 同帧竞态）。
    - HOW: store `makeMove`/`resetAll` 改 async + `lastWriteAt` 字段；调用方 await 后再 refresh；删 `void ...catch` 模式；不调 `revalidatePath`（force-dynamic 下冗余）。
    - lore trailers: Constraint: 已有 `__resetInternalForTests` 测试接缝保持; Rejected: `revalidatePath` 协调（force-dynamic 下冗余）; Confidence: High; Scope-risk: Medium（store 是 hot path，多个调用方）; Directive: 不动 PUT/DELETE Route Handler 形状; Tested: vitest + typecheck + lint + build + visual-qa + ux-qa + coverage（on-demand）7 项全绿; Not-tested: Vercel 生产 Turso HTTP 真实乱序（covered by stats-race-qa step 6）
    - Plan: .omo/plans/pwa-rsc-stats-bug-fix.md

- [ ] 5. PlayController 改事件驱动，去 setTimeout（修 B-2 完整：700ms 竞态 + 资源释放）
  What to do / Must NOT do:
    - 在 [components/PlayController.tsx](components/PlayController.tsx)：
      1. 移除 `setTimeout(router.replace('/result'), 700)`（[PlayController.tsx:18-23](components/PlayController.tsx)）
      2. 改 useEffect 订阅 `useGameStore((s) => s.lastWriteAt)`：当 `lastWriteAt !== null` 且 `phase === 'won' || phase === 'drawn'` 时，`router.replace('/result')`
      3. effect 依赖数组改为 `[phase, lastWriteAt]`
      4. cleanup 移除（不再有 setTimeout 需清理）
    - 不要改 audio cheer `setTimeout(360ms)`（在 `makeMove` 内部，不在 PlayController；v7 §五 盲区分析）。
    - 不要改 confetti / StatusBar / RestartButton 等其他组件。
  Parallelization: Wave 2 | Blocked by: 3（lastWriteAt 字段必须先存在） | Blocks: 5（stats-race-qa 探针 step 3/4/6/9 验证事件驱动行为）
  References (executor has NO interview context - be exhaustive):
    - [components/PlayController.tsx:18-23](components/PlayController.tsx)（setTimeout 位置）
    - [lib/store.ts](lib/store.ts) `lastWriteAt` 字段（commit 3 加）
    - v7 §六 commit 4 范式代码 + §1.2 资源生命周期表
    - v7 §四 D1-D6 消融矩阵（PlayController setTimeout 计数、跨 mount 无累积、手动导航竞争、multi-PUT ordering）
  Acceptance criteria (agent-executable):
    - `node tests/qa/commit-audit.mjs --message-file <msg>` 通过
    - `pnpm vitest run` 100% 通过
    - `pnpm typecheck` exit 0
    - `pnpm lint` exit 0
    - `pnpm build` exit 0
    - `node tests/qa/audio-cheer.mjs` PASS（cheer 时序不变；commit 4 不影响 makeMove 内部 360ms cheer）
    - `node tests/qa/audio-confetti-qa.mjs` PASS（`headline shows winning player` 步骤保持绿）
    - `node tests/qa/confetti-origin-qa.mjs` PASS（UI 可点保持）
    - `node tests/qa/hydration-check.mjs` PASS（防 hydration 回归）
  QA scenarios:
    - happy: `node tests/qa/audio-cheer.mjs` win→cheer 时序 360ms 不变
    - failure: `node tests/qa/audio-confetti-qa.mjs` 任意步骤 fail（事件驱动订阅漏触发）
    - Evidence: `.omo/evidence/pwa-rsc-stats-bug-fix/task-4-audio-cheer.log` + `.omo/evidence/pwa-rsc-stats-bug-fix/task-4-confetti-qa.log`
  Commit: Y | `fix(play-controller): event-driven navigation on write completion`
    - WHY: B-2 完整——setTimeout 700ms 与 PUT 落库时刻不固定（race），且 cleanup 语义薄弱；事件驱动是 canonical 替代。
    - HOW: PlayController useEffect 订阅 `useGameStore(s => s.lastWriteAt)` + phase；phase==='won'/'drawn' && lastWriteAt !== null → `router.replace('/result')`；移除 setTimeout 与 cleanup。
    - lore trailers: Constraint: cheer `setTimeout(360ms)` 在 makeMove 内部不在本 scope; Rejected: 缩短 setTimeout 窗口（仍是时间假设）; Confidence: High; Scope-risk: Low（单文件）; Directive: 不动 audio / confetti / 其他组件; Tested: vitest + typecheck + lint + build + audio-cheer + audio-confetti-qa + confetti-origin-qa + hydration-check 8 项全绿; Not-tested: Vercel 生产 Turso HTTP 真实 PUT 时序（covered by stats-race-qa step 4/6/9）
    - Plan: .omo/plans/pwa-rsc-stats-bug-fix.md

- [ ] 6. 新增 `tests/qa/stats-race-qa.mjs`（消融 + 集成探针：14 step 全覆盖 3 bug + 资源生命周期）
  What to do / Must NOT do:
    - 新建 [tests/qa/stats-race-qa.mjs](tests/qa/stats-race-qa.mjs)，按 v7 §5.4 14 个 step 实现：
      1. reset via DELETE（pre-setup）
      2. A1 SW-off：注册前 unregister → PUT 计数 = 1
      3. D1+D2 setTimeout 计数 + 跨 mount 无累积
      4. B1+B2+B3 联合：客户端导航后 DOM 数字 === API 数字
      5. B4 revalidatePath（production 等价验证）
      6. D4 multi-PUT ordering：reset → win 终态 = before + 1
      7. D5 internalStats 跨 mount 一致性
      8. D6 StatsGrid 不订阅 store
      9. D3 手动导航竞争：win 后 200ms 点"返回首页"
      10. E1 SW 激活竞争：unregister→register 瞬间 PUT
      11. E2 revalidatePath 时机：admin 路由 revalidate 后 navigate
      12. A3 SW skip-api 等价验证：PUT 计数 = 1
      13. 跨会话持久化：关闭 tab→重开
      14. 隐私窗口独立：incognito 独立战绩
    - 在 [lib/db.ts](lib/db.ts) `__setCreateClientForTests`（已有测试接缝）增强：支持 `delayMs` 参数；step 3/4/6 设 `process.env.DATABASE_URL_SLOW_DELAY_MS=1500` 让 RSC 跳转竞态本地可重现。
    - 不要改现有 8 个 qa 脚本（AGENTS.md Scope OUT）。
    - 不要把 stats-race-qa 拆成 14 个文件（v7 §五 决策：单一文件 + 14 step 匹配现有风格）。
  Parallelization: Wave 2 | Blocked by: 2, 3, 4, 5 全部（探针验证所有 fix 后的行为） | Blocks: —
  References (executor has NO interview context - be exhaustive):
    - v7 §四消融矩阵 + §5.4 step 列表 + §5.5 慢 PUT 模拟
    - [tests/qa/lib/browser.mjs](tests/qa/lib/browser.mjs)（统一浏览器、context、page 设置）
    - [tests/qa/launchQA](tests/qa/launchQA)（Playwright 启动器）
    - [tests/qa/audio-confetti-qa.mjs](tests/qa/audio-confetti-qa.mjs)（断言 `totalGames === 1` 模式参考）
    - [lib/db.ts:41](lib/db.ts)（`__setCreateClientForTests` 测试接缝）+ [lib/db.ts:46](lib/db.ts)（`cachedClient` 模块级单例）
  Acceptance criteria (agent-executable):
    - `node tests/qa/commit-audit.mjs --message-file <msg>` 通过（无新探针的 commit-audit 检查）
    - `node tests/qa/stats-race-qa.mjs` exit 0（脚本自身通过；14 step 全绿）
    - `pnpm vitest run` 100% 通过（防新探针修改共享 lib）
    - `pnpm typecheck` exit 0
    - `pnpm lint` exit 0
    - `pnpm build` exit 0
    - `node tests/qa/audio-confetti-qa.mjs` PASS（防新探针修改共享 lib）
    - `node tests/qa/visual-qa.mjs` PASS
    - `node tests/qa/ux-qa.mjs` PASS
    - `node tests/qa/hydration-check.mjs` PASS
  QA scenarios:
    - happy: `DATABASE_URL_SLOW_DELAY_MS=1500 node tests/qa/stats-race-qa.mjs` 14 step 全绿；本地可重现 B-2 700ms 竞态
    - failure: 任意 step fail（断言 DOM 数字 !== API 数字，或 SW PUT 计数 !== 1）
    - Evidence: `.omo/evidence/pwa-rsc-stats-bug-fix/task-5-stats-race-qa.log` + `.omo/evidence/pwa-rsc-stats-bug-fix/task-5-step-N.png`（每个 step 截图）
  Commit: Y | `test(stats-race-qa): add 14-step ablation + integration probe`
    - WHY: 现有 8 个 QA 脚本系统性用 `page.goto` 绕过客户端导航路径；6 层 Gauntlet 全绿但 3 个生产独占 bug 仍出现（B-3a 实证）。
    - HOW: 单一文件 `tests/qa/stats-race-qa.mjs` + 14 step；用真实 production build + real Chromium + 客户端导航 + DOM 断言；增强 `__setCreateClientForTests` 支持慢 PUT 模拟。
    - lore trailers: Constraint: AGENTS.md "Never introduce a new npm dependency"（用现有 Playwright）; Rejected: 拆 14 个文件（越界）; Rejected: 改 8 个现有脚本（Scope OUT）; Confidence: High; Scope-risk: Low（新增文件，不改现有）; Directive: 不改现有 qa 脚本; Tested: stats-race-qa 自测 + vitest + typecheck + lint + build + 4 个其他 qa 探针 10 项全绿; Not-tested: 真实 Vercel 生产环境（仍需人工验证；manual QA gate §8.1）
    - Plan: .omo/plans/pwa-rsc-stats-bug-fix.md

- [ ] 7. AGENTS.md §本项目反模式 追加 3 条（沉淀团队经验）
  What to do / Must NOT do:
    - 在 [AGENTS.md](AGENTS.md) §本项目反模式 末尾追加 3 条（中文表述与现有条目一致）：
      1. **RSC 页面读取可变数据必须声明 `dynamic = 'force-dynamic'`** —— Next.js 16 默认静态优化可能烘焙 build-time 异步数据（如 Drizzle DB 调用）的结果到 HTML，runtime 返回脏数据直到下次 build。
      2. **Service Worker fetch handler 必须按方法门控** —— `event.respondWith(fetch(event.request))` 无门控会让 PUT/POST/DELETE 被发两次。可安装但不缓存的 SW 范式：`if (event.request.method !== 'GET') return;` 后再 respondWith。
      3. **store 的网络写 action 必须返回 Promise** —— 让调用方可以 await 后再调 `router.refresh()`。在 `force-dynamic` 下无需 `revalidatePath`（冗余）；在 ISR 下 Route Handler 必须调 `revalidatePath('/')` + `revalidatePath('/result')`。
    - 不要触碰 AGENTS.md 顶部一行「总是使用中文进行回复。」（未提交工作区文件，本 plan scope OUT）。
    - 不要改 §本项目反模式 之外的章节。
    - 不要改 §贡献指南 的提交约定或 lore trailer 键名。
  Parallelization: Wave 3（与 todo 7 并行） | Blocked by: — | Blocks: —
  References (executor has NO interview context - be exhaustive):
    - [AGENTS.md](AGENTS.md) §本项目反模式 位置（找该 section 末尾追加）
    - v7 §六 commit 6 范式代码
    - v7 §三组件清单 C-DOCS-AGENTS
  Acceptance criteria (agent-executable):
    - `node tests/qa/commit-audit.mjs --message-file <msg>` 通过
    - `rg -n "dynamic = 'force-dynamic'" AGENTS.md` 输出新条目
    - `rg -n "method !== 'GET'" AGENTS.md` 输出新条目
    - `rg -n "必须返回 Promise" AGENTS.md` 输出新条目
    - `pnpm typecheck` exit 0（docs commit 不要求 build / vitest / 其他 qa）
  QA scenarios:
    - happy: `rg -n "B-1\|B-2\|B-3" AGENTS.md` 找到新条目的引用
    - failure: 任何一条新条目没出现在 §本项目反模式（漏写）
    - Evidence: `.omo/evidence/pwa-rsc-stats-bug-fix/task-6-agents-md-rg.log`
  Commit: Y | `docs(agents-md): add 3 anti-patterns from stats race investigation`
    - WHY: 沉淀 3 个 bug 的根因到团队文档；demo 展示把经验沉淀为组织记忆。
    - HOW: §本项目反模式 追加 3 条；不触碰其他章节。
    - lore trailers: Constraint: 现有条目格式（中文 + 详细说明 + Bug 引用）; Rejected: 单独开 §新章节（破坏文档结构）; Confidence: High; Scope-risk: Low（仅追加）; Directive: 不触碰未提交工作区顶部一行; Tested: rg 命中 3 条 + typecheck 2 项绿; Not-tested: docs commit 不要求 build / vitest / qa（AGENTS.md 纯文档提交约定）
    - Plan: .omo/plans/pwa-rsc-stats-bug-fix.md

- [ ] 8. docs/learnings.md 追加 #28 条目（反思 + 学习）
  What to do / Must NOT do:
    - 在 [docs/learnings.md](docs/learnings.md) 末尾追加条目 #28：
      - 标题：数据流 + 资源生命周期双轴视角
      - 内容：3 个生产独占 bug 的根因 + 教训（数据流单点真相缺失 + 7 个资源的生命周期协调）+ 修复策略 + 验证策略（消融 + 集成测试）
      - 引用 v7 草稿 + 实证证据路径
    - 不要改 #1-#27 已有条目。
    - 不要改 docs/learnings.md 的其他章节。
  Parallelization: Wave 3（与 todo 6 并行） | Blocked by: — | Blocks: —
  References (executor has NO interview context - be exhaustive):
    - [docs/learnings.md](docs/learnings.md) 末尾位置（找 #27 末尾追加）
    - v7 §六 commit 7 范式代码
    - v7 §三组件清单 C-DOCS-LEARN
  Acceptance criteria (agent-executable):
    - `node tests/qa/commit-audit.mjs --message-file <msg>` 通过
    - `rg -n "^## 28\." docs/learnings.md` 找到新条目
    - `pnpm typecheck` exit 0
  QA scenarios:
    - happy: `wc -l docs/learnings.md` 行数 +30 行以上（#28 至少 30 行）
    - failure: #28 缺失或内容 < 10 行（敷衍）
    - Evidence: `.omo/evidence/pwa-rsc-stats-bug-fix/task-7-learnings-rg.log`
  Commit: Y | `docs(learnings): entry 28 on data flow and resource lifecycle`
    - WHY: 沉淀 3 个 bug 的反思 + 学习；demo 展示反思能力。
    - HOW: docs/learnings.md 末尾追加 #28（数据流 + 资源生命周期双轴视角）；不改动其他条目。
    - lore trailers: Constraint: 现有条目格式（中文 + 详细说明 + 引用）; Rejected: 单独开文档（破坏结构）; Confidence: High; Scope-risk: Low（仅追加）; Directive: 不改 #1-#27; Tested: rg 命中 + typecheck 2 项绿; Not-tested: docs commit 不要求 build / vitest / qa
    - Plan: .omo/plans/pwa-rsc-stats-bug-fix.md

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy

**8 个原子 commit（1 个 Stryker 阻塞器修复 + 4 个 bug 修复 + 1 个测试 + 2 个文档）**（每个独立 build/test 绿）：

| # | type | scope | 主题（中文） |
|---|---|---|---|
| 1 | chore | stryker | mock process.cwd() in db.test for worker pool |
| 2 | fix | sw | non-GET requests bypass service worker |
| 3 | fix | rsc-dynamic-flag | disable static prerender for stats pages |
| 4 | fix | async-store | makeMove and resetAll return awaited Promise |
| 5 | fix | play-controller | event-driven navigation on write completion |
| 6 | test | stats-race-qa | add 14-step ablation + integration probe |
| 7 | docs | agents-md | add 3 anti-patterns from stats race investigation |
| 8 | docs | learnings | entry 28 on data flow and resource lifecycle |

**提交约定**（AGENTS.md §提交约定）：
- Conventional Commits（type/scope 英文 token；描述中文；正文 WHAT/WHY/HOW）
- 每个 commit 带 lore trailer（Constraint / Rejected / Confidence / Scope-risk / Directive / Tested / Not-tested）
- 每个 commit footer 带 `Plan: .omo/plans/pwa-rsc-stats-bug-fix.md`
- commit-msg hook 强制；禁止 `--no-verify`

**Commit 顺序**：严格按 todo 编号（Wave 1 → Wave 2 → Wave 3）；不得 reorder。

**Branch 策略**：直接 commit 到 main（AGENTS.md §贡献指南 接受）；不需要 feature branch / PR（本项目无 GitHub 远端）。

## Success criteria

**部署成功标准**（demo reviewer 手测后）：

1. **B-1 验证**：玩一局胜利，DevTools Network 面板 PUT 计数 = **1**（修复前是 2）
2. **B-2 验证**：同上胜利后跳 `/result`，`<StatsCard>` 总场次数字 = 刚才那一局 + 1（不是旧的）
3. **B-3a 验证**：重置战绩 → 玩一局胜利 → 跳 `/result`，总场次 = 1（不是 build-time 烘焙的 0）
4. **B-3b 验证**：重置按钮按完 → 等 2 秒 → StatsGrid 全 0（不是旧值）
5. **跨设备验证**（demo 必跑）：隐私窗口 vs 正常窗口战绩独立；关闭 tab→重开战绩保留

**6 层 Gauntlet 全绿**：
- ✅ vitest 88/88（commit 4 触发 on-demand coverage ≥ 80/80/70/80）
- ✅ tsc strict 0 错误
- ✅ eslint 0 警告
- ✅ next build 0 错误
- ✅ commit-audit 0 violations
- ✅ browser QA（hydration-check + ux-qa + visual-qa + audio-cheer + audio-confetti-qa + confetti-origin-qa + stats-race-qa）全 PASS
- ✅ mutation（commit 1 修 Stryker blocker → commit 4 触发 on-demand mutation）mutated score ≥ 84.5% 或提升

**演示可读性**：
- ✅ git log 显示 8 个原子 commit（1 个 Stryker 阻塞器修复 + 4 个 bug 修复 + 1 个测试 + 2 个文档），每 commit 一行摘要 + lore trailer
- ✅ AGENTS.md §反模式 3 条新条目（中文 + Bug 引用）
- ✅ docs/learnings.md #28 完整条目（≥ 30 行）
- ✅ `.omo/plans/pwa-rsc-stats-bug-fix.md` footer `Plan:` 引用正确
- ✅ 部署到 Vercel 后 build log 同时 0 条 `Detected engines` 警告 + 0 条 `Skipping build cache` 信息行
