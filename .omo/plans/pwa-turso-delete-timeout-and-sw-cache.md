# pwa-turso-delete-timeout-and-sw-cache - Work Plan

## TL;DR (For humans)

**What you'll get:** 修复两个线上流量分析发现的产品体验问题：重置战绩按钮不再卡 30 秒不响应（带 8 秒超时 + loading 反馈），每次页面跳转不再重复拉 manifest / icon（双层方案：HTTP 缓存头 + Service Worker 缓存命中）。

**Why this approach:**
- **HAR 数据驱动 + 拒绝冲动加新依赖**：线上抓包证据先于方案，所有"加 Serwist / 加 Server Action / 加 unstable_cache"等外部研究候选方案逐一用项目硬约束筛掉，理由写进本 plan 的 Alternative evaluation section，下次遇到类似决策可直接复用。
- **两层组合优于单层**：manifest + icon 当前响应头是 `max-age=0, must-revalidate`（HAR 直读）—— 单纯 SW 缓存也能修，但加上 300s 的 `Cache-Control` 头让浏览器首次重访省掉 304 roundtrip，叠加 SW hit 0ms 才是完整方案。
- **minimum 不留借口**：第一版不加重试（HAR 报告自己推荐 "先做 1"），但 store 返回结构预留 `{ ok, stats, reason }` 让未来加重试是 drop-in。

**What it will NOT do:**
- 不加新 npm 依赖、不引入 Serwist / next-pwa、不引入 'use server' Server Action、不引入 cacheComponents / experimental_ppr。
- 不切 Vercel region（HAR 报告 P1，明确出 scope）。
- 不为 `/api/stats` 或 RSC payload 加任何 SW 缓存（会重新引入 B-3）。

**Effort:** Short（~9 个原子 commit，单文件改动居多）
**Risk:** Medium — store 是 hot path，AbortController helper 与现有 try/catch 兼容是关键；其余 8 个 commit 都是单文件改动。
**Decisions to sanity-check:**
1. 拒绝 Serwist / Server Action / unstable_cache / experimental_ppr（详见 Alternative evaluation）
2. 双层 P3（Cache-Control 头 + SW cache）而非单层 SW cache
3. 8000ms timeout 而非 30s 默认或更激进值
4. 第一版不做网络重试

Your next move: 由独立 worker session 跑 `$start-work` 执行本 plan；ulw-plan 已交付完毕，不在本会话实施。

---

> TL;DR (machine): 9 atomic commits, Short effort, Medium risk, HAR-data-driven two-axis fix (P2 timeout + P3 dual-layer cache), all rejected alternatives captured as compounding knowledge.

## Scope
### Must have
1. **`next.config.ts` 加 `headers()`** 给 `manifest.webmanifest` / `icon.svg` / `apple-icon*` / `favicon*` 设 `Cache-Control: public, max-age=300`（替换现状 `max-age=0, must-revalidate`）
2. **`public/sw.js` GET-only cache-first**：`manifest.webmanifest` / `icon.svg` / `apple-icon*` / `favicon*` / `_next/static/**`；cache name `tic-tac-toe-v1`；非 GET 仍 bypass（保留 B-1 修复）；RSC + `/api/stats` 仍走网络
3. **`lib/store.ts` 加 `withTimeout(fetch, ms)` helper**；`apiPutStats` + `apiDeleteStats` 都包 8000ms `AbortController.timeout()`；返回类型从 `Promise<void>` / `Promise<GameStats>` 升级为带结果标签的结构 `{ ok: true, value } | { ok: false, reason: 'aborted' | 'network-error' }`
4. **`components/ui/Button.tsx` 加 `loading` prop**：inline spinner span（`data-testid` 来自 `rest` 或 fallback `loading`）+ `aria-busy="true"` + 强制 disabled
5. **`components/ResetStatsButton.tsx` 接入 loading 状态**：`useState pending`，在 `await resetAll()` 期间 set true，settle 时 set false
6. **`components/ResultActions.tsx` 同上**：用于 /result 页面上的"重置战绩"按钮
7. **vitest 新增 timeout-abort 用例** 到 `tests/store/store.test.ts`：复用 `mockFetch` 模式，新增 `mockFetchWithAbort` 变体；断言 store 在 abort 时不抛 + UI state 仍正确
8. **新增 `tests/qa/pwa-sw-cache-qa.mjs`**：Playwright 生产构建 + 真实 Chromium；二次 nav 后断言 `manifest.webmanifest` 第二次请求来自 SW cache（用 CDP `Network.responseReceived` 看 source）
9. **AGENTS.md §反模式 新增 2 条 bullet**（fetch timeout + manifest/icon cache header policy）；footer `Plan: .omo/plans/pwa-turso-delete-timeout-and-sw-cache.md`
10. **docs/learnings.md #29 条目**：本 plan 决策依据与拒绝的替代方案，作为未来 agent 的判断素材
11. **plan footer**：`Plan: .omo/plans/pwa-turso-delete-timeout-and-sw-cache.md`

### Must NOT have (guardrails, anti-slop, scope boundaries)
- ❌ 新增任何 npm 依赖（AGENTS.md §反模式）
- ❌ 引入 Serwist / next-pwa / Workbox / `@serwist/next`
- ❌ 引入 `'use server'` directive 或 Server Action
- ❌ 启用 `cacheComponents: true` / `experimental.ppr`
- ❌ 用 `unstable_cache` / React `cache()` 包装 stats 读取
- ❌ 网络 action 重试 / 指数退避（HAR 报告 "medium" 选项，deferred）
- ❌ IndexedDB 离线战绩缓存（HAR 报告 "large" 选项，独立工作流）
- ❌ Vercel region 切换（HAR 报告 P1，明确出 scope）
- ❌ SW 缓存 RSC payload 或 `/api/stats`（会重新引入 B-3 / 写入 staleness）
- ❌ focus / visibility 变化时主动失效缓存（premature）
- ❌ 改 `'use client'` 边界位置、route handlers、`lib/game.ts` 纯规则、`DESIGN.md`
- ❌ `git commit --no-verify` 绕过 hook
- ❌ omnibus commit（AGENTS.md "atomic commits"）
- ❌ 对 `lib/db.ts` 跑 mutation 测试（无改动；Stryker 已有 blocker 暂停）
- ❌ Vercel 部署 inspection / build log 审查（本次 scope 外）

## Verification strategy
> Zero human intervention - all verification is agent-executed.

**Test decision**: tests-after（每个 commit 单独跑 6 层 Gauntlet）+ 新增 1 个 Playwright 探针 `pwa-sw-cache-qa.mjs`；vitest 新增 abort 用例复用现有 `mockFetch` 模式。

**6 层 Gauntlet（每 commit 必跑）**：

| 层 | 工具 | scope | 触发条件 |
| --- | --- | --- | --- |
| Tests | vitest 5 + jsdom 30（当前 88 例 + 新增 abort 用例） | 全 | 每 commit |
| Types | tsc 5 strict | 全 | 每 commit |
| Lint | eslint 9（含 `tests/qa/**` ignore） | 全 | 每 commit |
| Build | next build | 全 | 每 commit |
| Commit-audit | `tests/qa/commit-audit.mjs --branch main` | commit message | 每 commit |
| Browser QA | `tests/qa/*.mjs` 探针 | 触及 UI 时 | commit 1-8 |
| Coverage | vitest --coverage（v8, `lib/**`+`db/**`, thresholds 80/80/70/80） | on-demand | commit 3 改 `lib/store.ts` 时触发 |
| Mutation | Stryker（scope 4 文件） | on-demand | commit 3 改 `lib/store.ts` 时触发；scope 内已含 store |

每 commit 必跑前 6 层；commit 3 额外跑 Coverage + Mutation（store 在 Stryker scope 内）。

**Final verification wave** 在所有 commit 落地后：
- F1 Plan compliance audit：对照 Must have / Must NOT have 逐条核
- F2 Code quality review：单独 agent 审查 diff
- F3 Real manual QA：production build + 真实 Chrome，verify 重置按钮 loading + SW cache hit（DevTools Network 面板看 `manifest.webmanifest` 第二次显示 `(ServiceWorker)`）
- F4 Scope fidelity：grep 检查无新增依赖 / 无 'use server' / 无 cacheComponents

## Execution strategy
### Parallel execution waves
> Wave 划分原则：纯文档 commit 单独走；纯配置 commit 单独走；UI / store / SW 类按文件物理隔离分波。

**Wave 1 — 配置 & 缓存基础设施（可并行）**
- commit 1：next.config.ts Cache-Control headers
- commit 2：public/sw.js cache-first

**Wave 2 — store timeout helper + wrap PUT/DELETE**
- commit 3：lib/store.ts withTimeout + 包两个 fetcher

**Wave 3 — UI loading 状态（可并行）**
- commit 4：components/ui/Button.tsx loading prop
- commit 5：components/ResetStatsButton.tsx 接入
- commit 6：components/ResultActions.tsx 接入

**Wave 4 — 测试**
- commit 7：tests/store/store.test.ts 新增 abort 用例
- commit 8：tests/qa/pwa-sw-cache-qa.mjs 新探针

**Wave 5 — 文档沉淀**
- commit 9：AGENTS.md §反模式 + docs/learnings.md #29 + plan footer

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 (headers) | — | 2 (SW cache) | 2 |
| 2 (SW cache) | — | 8 (QA probe) | 1 |
| 3 (store timeout) | — | 7 (vitest abort) | 4, 5, 6 |
| 4 (Button loading) | — | 5, 6 | 3 |
| 5 (ResetStatsButton wire-up) | 4 | — | 6, 3 |
| 6 (ResultActions wire-up) | 4 | — | 5, 3 |
| 7 (vitest abort) | 3 | — | 8 |
| 8 (QA probe) | 2 | — | 7 |
| 9 (docs) | 3, 4, 5, 6 | — | 7, 8 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [ ] 1. feat(next-config): Cache-Control headers for manifest, icon, apple-icon, favicon
  What to do / Must NOT do: 在 `next.config.ts` 顶层导出 `headers()` 函数（Next 15+ 写法），为 `manifest.webmanifest` / `icon.svg` / `apple-icon*` / `favicon*` 各加 `Cache-Control: public, max-age=300`；`_next/static/**` 不动（已是 immutable）。不引入新依赖；不改 build 输出；不改 `sw.js` 自身缓存策略。
  Parallelization: Wave 1 | Blocked by: — | Blocks: 2
  References (executor has NO interview context - be exhaustive):
  - `next.config.ts` 当前是空 `NextConfig`，需要替换为带 `headers` 导出
  - HAR 直读：manifest headers = `public, max-age=0, must-revalidate`；icon.svg 同；`_next/static` headers = `public, max-age=31536000, immutable`
  - Next.js 16 docs: `next.config.ts#headers` 接受 `(prev) => [{ source, headers }]` 函数式更新（参考 `node_modules/next/dist/docs/` 在写代码前必读，按 AGENTS.md 项目知识库 §查找入口）
  - `components/ServiceWorkerRegister.tsx:14-22` SW 只在 production 注册，dev 模式下 `Cache-Control` 头不影响 fast refresh
  Acceptance criteria (agent-executable):
  - `pnpm typecheck` 0 error
  - `pnpm lint` 0 error
  - `pnpm build` 0 error 且 build log 显示 manifest + icon 资源大小不变
  - `pnpm vitest run` 88 例全绿
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - happy: `pnpm build && pnpm start &` ; `curl -I http://localhost:3000/manifest.webmanifest` 看 `cache-control: public, max-age=300`
  - 兼容性：同命令看 `/favicon.ico` + `/apple-icon` 也是 `max-age=300`
  - 不回归：`curl -I http://localhost:3000/_next/static/chunks/$(ls .next/static/chunks/*.js | head -1 | xargs basename)` 仍是 `max-age=31536000, immutable`
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/commit-1-headers-curl.txt`
  Commit: Y | feat(next-config): Cache-Control headers for manifest, icon, apple-icon, favicon
  Lore trailer: Constraint 0 new deps / Rejected Serwist, Server Actions, unstable_cache, experimental_ppr, focus/visibility invalidation / Confidence High / Scope-risk Low / Directive SW cache-first 仍要做（300s 头不等于 0ms hit）/ Tested vitest, tsc, eslint, next build, commit-audit, curl prod build / Not-tested 真实 Vercel CDN 部署（本次不部署）

- [ ] 2. feat(sw): cache-first GET handler for static assets
  What to do / Must NOT do: `public/sw.js` fetch handler 在 method-gate（保留 B-1 修复）之后，对 cacheable URL 走 cache-first：从 `caches.open('tic-tac-toe-v1')` 查命中 → 命中即返回；未命中 fetch + 写入 cache 后返回。非 GET（PUT/POST/DELETE）+ 非 cacheable URL（RSC + `/api/stats`）保持当前 network 透传。SW install / activate / lifecycle 注释保持现状。cache name 选 `tic-tac-toe-v1`（项目代号 + v1），未来 bump 通过手动修改 sw.js 内容触发。cacheable URL 正则匹配 HAR §P3 推荐：`/(\/manifest\.webmanifest|\/icon\.svg|\/apple-icon|\/favicon\.ico|_next\/static\/)/`。不缓存 `_next/static` 之外的 RSC；不缓存 `/api/stats` 任何方法；不改 SW install/activate 行为；不引入 Workbox / Serwist。
  Parallelization: Wave 1 | Blocked by: — | Blocks: 8
  References:
  - `public/sw.js:25-28` 当前 method-gate 透传，需在 gate 后加 cacheable 分支
  - HAR §P3 推荐代码 sample（报告 `.omo/evidence/har-analysis/HAR-ANALYSIS-REPORT.md` §P3 修复建议）
  - `components/ServiceWorkerRegister.tsx:14-22` production-only 注册守卫，dev 不注册
  - B-1 修复（commit 971bb41）：方法门控必须保留
  - AGENTS.md §反模式 "Service Worker fetch handler 必须按方法门控" — 必须先 gate 再 cache
  - 测试 helper `tests/qa/lib/browser.mjs` 不依赖 SW 行为，需新建独立 QA 探针
  Acceptance criteria:
  - `pnpm typecheck` 0 error（sw.js 是 vanilla JS，但 commit-audit 仍校验 lore trailer）
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 88 例全绿（store 路径不变）
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - happy：production build + 真实 Chromium 二次 nav，第二次 `manifest.webmanifest` 请求来自 SW cache
  - failure：未注册 SW（DevTools "Bypass for network"）时 fallback 到 network，行为不破
  - 不回归 B-1：每局赢只有 1 个 PUT 200（`tests/qa/stats-race-qa.mjs` 仍绿）
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/commit-2-sw-cache-qa.txt`
  Commit: Y | feat(sw): cache-first GET handler for static assets
  Lore trailer: Constraint 0 new deps / Rejected Serwist, Workbox (overkill for 5 routes), experimental.ppr (cacheComponents forbidden), next.config.ts headers as sole fix (HAR shows 304 roundtrip still ~50-200ms even with max-age) / Confidence High / Scope-risk Low (single file, public/sw.js) / Directive cache name = tic-tac-toe-v1, bump manually on sw.js content change / Tested vitest, tsc, eslint, next build, commit-audit, real Chromium prod build / Not-tested Safari ITP, offline replay (out of scope)

- [ ] 3. feat(store): AbortController.timeout wrapper for apiPutStats + apiDeleteStats
  What to do / Must NOT do: `lib/store.ts` 顶部新增 `withTimeout(fetch, ms)` helper：`AbortController` + `setTimeout(() => controller.abort(new DOMException('aborted', 'TimeoutError')), ms)`；返回新 Promise，调用方传入的 init 加上 `signal`。`apiPutStats` 与 `apiDeleteStats` 改为调用 `withTimeout(fetch, 8000)`。返回类型从 `Promise<void>` / `Promise<GameStats>` 改为 `Promise<{ ok: true, value: GameStats } | { ok: false, reason: 'aborted' | 'network-error' }>`。`makeMove` 与 `resetAll` 内的 try/catch 适配新返回：`ok: true` 走原有成功分支，`ok: false` 走原有 catch 分支（UI 状态仍正确，DB 写丢失但本地不变）。不引入 abort 重试；不改 `setInitialStats` 的同步语义；不改 `internalStats` 闭包作用域；不改 store action 签名。
  Parallelization: Wave 2 | Blocked by: — | Blocks: 7
  References:
  - `lib/store.ts:74-78` `apiPutStats` 当前实现
  - `lib/store.ts:86-90` `apiDeleteStats` 当前实现
  - `lib/store.ts:96-170` `makeMove` 内 win/draw 分支的 try/catch（要适配新返回类型）
  - `lib/store.ts:180-195` `resetAll` 内 try/catch（要适配新返回类型）
  - HAR §P2 证据：DELETE 200 time=30733ms（孤立长尾）
  - HAR §P2 推荐 minimum：8s AbortController + UI loading + disabled
  - AGENTS.md §反模式 新增 bullet "网络 write action 必须带 AbortController timeout"
  - Stryker scope 含 `lib/store.ts`（commit 3 触发 mutation testing）
  Acceptance criteria:
  - `pnpm typecheck` 0 error（重点：`{ ok: true, value } | { ok: false, reason }` 类型必须严格）
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 88 例全绿 + commit 7 新增的 abort 用例全绿
  - `pnpm test:coverage -- lib/store.ts` ≥ 80% lines / 80% branches（store 在 coverage scope）
  - `pnpm test:mutation` score ≥ pre-fix baseline（store 在 Stryker scope 内）
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - vitest：mock 永不 resolve 的 fetch + 立即 abort → 断言 store 不抛 + `internalStats` 不变
  - vitest：mock 200ms 延迟的 fetch → 断言正常路径通过
  - vitest：mock 返回 500 → 断言新返回类型 `{ ok: false, reason: 'network-error' }` 走 catch 分支
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/commit-3-vitest-abort.txt`
  Commit: Y | feat(store): AbortController.timeout wrapper for apiPutStats + apiDeleteStats
  Lore trailer: Constraint 0 new deps / Rejected retry/exponential backoff (deferred until Turso jitter frequency proven), Serwist (out of scope), 'use server' directive (AGENTS.md forbidden), unstable_cache (force-dynamic conflict) / Confidence High / Scope-risk Medium (store is hot path; {ok, reason} shape must match all 4 callers in makeMove + resetAll) / Directive timeout = 8000ms; helper exported as withTimeout for test seam / Tested vitest 88 + abort cases, tsc, eslint, next build, commit-audit, coverage on lib/store.ts, mutation on lib/store.ts / Not-tested real Turso 30s hang reproduction in prod (out of scope)

- [ ] 4. feat(ui): loading state on Button primitive
  What to do / Must NOT do: `components/ui/Button.tsx` 加 `loading?: boolean` prop。`loading=true` 时：内部强制 `disabled` + `aria-busy="true"`；在 children 之前或之后渲染 `<span data-testid="${rest['data-testid'] ?? 'button'}-loading" aria-hidden="true">…</span>`（内容是单个 unicode 横线转圈的省略字符或 1px 圆点，避免 emoji）。CSS 沿用 DESIGN.md 令牌，不引入新样式文件；spinner 动画在 `prefers-reduced-motion` 下静止（DESIGN.md §无动效路径）。不改 Button 现有 variant；不改 `...rest` spread 行为；不引入新依赖；不改 `props.disabled` 用户覆写优先级。
  Parallelization: Wave 3 | Blocked by: — | Blocks: 5, 6
  References:
  - `components/ui/Button.tsx:1-21` 当前实现
  - AGENTS.md §反模式 "不要使用 emoji 图标" + "不要引入 UI 库"
  - DESIGN.md §无动效路径 `prefers-reduced-motion`
  - `components/ResetStatsButton.tsx:13-19` 调用模式（需在 store 改动前确定 prop API）
  - `components/ResultActions.tsx:24-32` 调用模式
  Acceptance criteria:
  - `pnpm typecheck` 0 error
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 88 例全绿
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  - 视觉契约：Loading 态 spinner 在 prefers-reduced-motion 下无动画（DESIGN.md §6）
  QA scenarios:
  - vitest snapshot: `<Button loading>...</Button>` 渲染含 `[data-testid="...-loading"]` + `aria-busy="true"` + `disabled` 属性
  - 兼容性：现有 Button 调用方（`PlayController` / `Board` / `SoundToggle` / `ResultBanner`）无回归
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/commit-4-button-loading.txt`
  Commit: Y | feat(ui): loading state on Button primitive
  Lore trailer: Constraint DESIGN.md 令牌；prefers-reduced-motion / Rejected spinner library (new dep), emoji icon (AGENTS.md forbidden), component-level focus ring (AGENTS.md forbidden) / Confidence High / Scope-risk Low (single primitive, isolated) / Directive prop name = loading; testid suffix = -loading / Tested vitest, tsc, eslint, next build, commit-audit / Not-tested 跨浏览器 spinner 视觉对齐（DESIGN.md 不约束）

- [ ] 5. feat(stats-reset): wire loading state in ResetStatsButton
  What to do / Must NOT do: `components/ResetStatsButton.tsx` 加 `useState<boolean>(false)` pending；onClick 内 `setPending(true)` → `await resetAll()` → 无论结果都 `setPending(false)` + `router.refresh()`。Button 加 `loading={pending}`。onClick 函数保持 async，错误路径已由 commit 3 的 `{ ok: false }` 兜底（UI 状态仍正确）。不改 ResetStatsButton 现有 layout / data-testid / aria-label；不改 store action 签名。
  Parallelization: Wave 3 | Blocked by: 4 | Blocks: —
  References:
  - `components/ResetStatsButton.tsx:1-19` 当前实现
  - `lib/store.ts:185-195` `resetAll` 新返回类型
  - commit 4 新增 `loading` prop
  Acceptance criteria:
  - `pnpm typecheck` 0 error
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 88 例全绿
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - vitest: render ResetStatsButton with mocked resetAll that never resolves → assert `disabled` + `aria-busy="true"` 出现
  - vitest: 完成 resetAll → assert pending 恢复 false
  - 不回归：ResetStatsButton 的 `data-testid="reset-stats"` + `aria-label="重置战绩"` 保留
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/commit-5-reset-button-loading.txt`
  Commit: Y | feat(stats-reset): wire loading state in ResetStatsButton
  Lore trailer: Constraint Button loading prop from commit 4 / Rejected debounce/throttle (premature; reset 是用户主动单次操作) / Confidence High / Scope-risk Low (single component) / Directive pending state 永远 settle 即便 resetAll 抛（commit 3 已兜底） / Tested vitest, tsc, eslint, next build, commit-audit / Not-tested 真 Turso 8s+ 超时复现（test mock 即可）

- [ ] 6. feat(stats-reset): wire loading state in ResultActions
  What to do / Must NOT do: `components/ResultActions.tsx` 内嵌的"重置战绩"按钮（line 24-32）：单独 useState 跟踪 pending；onClick 内 `setPending(true)` → `await resetAll()` → `restart()` → `router.refresh()` → `setPending(false)`。Button 加 `loading={pending}`。注意：当前 resetAll 后 restart + router.refresh 的顺序在 abort 路径下仍要保证 UI 一致（restart 重置 board 状态，refresh 重读 RSC）。data-testid `reset-stats-result` 保留。
  Parallelization: Wave 3 | Blocked by: 4 | Blocks: —
  References:
  - `components/ResultActions.tsx:24-32` 当前实现
  - `lib/store.ts:185-195` `resetAll` + `restart` 行为
  - commit 4 Button loading prop
  - commit 3 resetAll 新返回类型
  Acceptance criteria:
  - `pnpm typecheck` 0 error
  - `pnpm lint` 0 error
  - `pnpm build` 0 error
  - `pnpm vitest run` 88 例全绿
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - vitest: 渲染 ResultActions + mock resetAll never resolves → 内嵌 reset 按钮 disabled + busy
  - vitest: 完成 resetAll → pending 恢复，restart() 被调用
  - 不回归：`data-testid="reset-stats-result"` 保留；"再来一局" / "返回首页" 按钮不受影响
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/commit-6-result-actions-loading.txt`
  Commit: Y | feat(stats-reset): wire loading state in ResultActions
  Lore trailer: Constraint 同 commit 5 / Rejected 同 commit 5 / Confidence High / Scope-risk Low (single component) / Directive restart() 必须在 resetAll settle 后调用；UI 一致性优先于网络结果 / Tested vitest, tsc, eslint, next build, commit-audit / Not-tested 同 commit 5

- [ ] 7. test(store): cover AbortController timeout in store.test.ts
  What to do / Must NOT do: `tests/store/store.test.ts` 新增 `mockFetchWithAbort` helper（模式同 `mockFetch` line 17-32，但 fetch 实现抛 `DOMException('aborted', 'TimeoutError')`）。新增 4 个用例：(a) `makeMove` win 分支 PUT 被 abort → 断言 store 不抛 + `internalStats` 通过下一次 put 仍是原值（已被 setInitialStats 验证）；(b) `makeMove` draw 分支 PUT 被 abort → 同上；(c) `resetAll` DELETE 被 abort → 断言走 emptyStats() fallback 分支；(d) 正常路径不 abort 仍 200 → 回归基线。每个用例断言 `calls.length === 1`（PUT/DELETE 仍发出）。不改其他 16 个现有用例。
  Parallelization: Wave 4 | Blocked by: 3 | Blocks: —
  References:
  - `tests/store/store.test.ts:17-32` `mockFetch` 实现参考
  - `tests/store/store.test.ts:165-220` `makeMove` win/draw 用例参考（断言 PUT body 正确）
  - `tests/store/store.test.ts:325-393` `resetAll` 用例参考
  - `lib/store.ts:84-94` commit 3 改动后新 helper + 新返回类型
  Acceptance criteria:
  - `pnpm vitest run` 92 例全绿（88 + 4 新增）
  - `pnpm test:coverage -- lib/store.ts` ≥ pre-fix baseline
  - `pnpm test:mutation` score ≥ pre-fix baseline
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation（commit 7 是 test 类型）
  QA scenarios:
  - vitest 4 个新用例全绿
  - 现有 16 个 store 用例全绿（不回归）
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/commit-7-vitest-abort-cases.txt`
  Commit: Y | test(store): cover AbortController timeout in store.test.ts
  Lore trailer: Constraint vitest pattern in store.test.ts / Rejected playwright for abort (vitest 更快更确定) / Confidence High / Scope-risk Low (test-only) / Directive abort 测试用 DOMException 'TimeoutError'；不引入 fake timers（real timer + manual setTimeout 更接近生产） / Tested vitest 92, coverage, mutation / Not-tested 浏览器内 AbortController 行为（与 Node 一致）

- [ ] 8. test(qa): new pwa-sw-cache-qa.mjs Playwright probe
  What to do / Must NOT do: 新文件 `tests/qa/pwa-sw-cache-qa.mjs`，参照 `tests/qa/stats-race-qa.mjs:1-80` 模板（`launchQA` + `step()` helper）。3 个步骤：(a) production build + 真实 Chromium 打开首页，记录首次 `manifest.webmanifest` 请求 source = `network`；(b) reload 首页，记录第二次 `manifest.webmanifest` 请求 source = `(ServiceWorker)` 或 `service-worker`（CDP `Network.responseReceived` 字段）；(c) 打开 DevTools cache storage 检查 `tic-tac-toe-v1` cache 存在并含 manifest。不模拟 abort timeout（vitest 覆盖）；不测 PUT/DELETE 缓存（B-1 invariant 由 commit 2 的 method-gate 保留）。
  Parallelization: Wave 4 | Blocked by: 2 | Blocks: —
  References:
  - `tests/qa/stats-race-qa.mjs:1-80` 启动模板
  - `tests/qa/lib/browser.mjs:7` `launchQA` helper
  - `public/sw.js` commit 2 改动后行为
  - `components/ServiceWorkerRegister.tsx:14-22` production-only 注册
  - HAR 直读：PWA 56 次 + Website 94 次 manifest 请求基线
  Acceptance criteria:
  - `node tests/qa/pwa-sw-cache-qa.mjs` 全 step PASS
  - `pnpm build && pnpm start &` 必须就绪
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  QA scenarios:
  - step 1：首次 nav 拿到 manifest 200，source = network
  - step 2：reload 后第二次 nav 拿 manifest，source = (ServiceWorker) service-worker
  - step 3：CDP `CacheStorage` API 列出 `tic-tac-toe-v1` cache + manifest entry
  - failure path：DevTools "Bypass for network" 启用时回退 network（不破）
  - 不回归：B-1 invariant（PUTs 1:1 with wins）由 stats-race-qa 仍覆盖
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/commit-8-pwa-sw-cache-qa.txt`
  Commit: Y | test(qa): new pwa-sw-cache-qa.mjs Playwright probe
  Lore trailer: Constraint production build + real Chromium per AGENTS.md / Rejected jsdom SW mock (生产行为不一致) / Confidence Medium (CDP source 字段在不同 Chrome 版本有差异，需实测) / Scope-risk Low (test-only) / Directive 失败时打印完整 network log + cache contents 便于定位 / Tested prod build + real Chromium / Not-tested Safari ITP, Firefox SW 行为差异

- [ ] 9. docs(agents-md): anti-pattern bullets for fetch timeout + cache headers + write outcome shape
  What to do / Must NOT do: AGENTS.md §反模式 新增 2 条粗体 hard bullet：(a)「**网络 write action 必须带 AbortController timeout** —— Turso HTTP 在 iad1 偶发 30s 默认 fetch 超时；client 必须主动 8s abort + UI loading state + disabled。HAR §P2 实证。」；(b)「**静态资源缓存必须双层** —— `_next/static/**` 已被 Vercel 边缘 immutable 缓存；但 `manifest.webmanifest` / `icon.svg` / `apple-icon*` / `favicon*` 默认 `max-age=0, must-revalidate` 会导致每 nav 304 roundtrip；必须 `next.config.ts headers()` + SW cache-first 双层。HAR 直读实证：56-94 次 manifest 请求 + manifest 头 = max-age=0」。footer 加 `Plan: .omo/plans/pwa-turso-delete-timeout-and-sw-cache.md`。同时 `docs/learnings.md` 新增 #29 条目：「**29. HAR 数据 + 反模式吸收**（pwa-turso-delete-timeout-and-sw-cache plan）」详细记录本 plan 的决策与拒绝的替代方案。
  Parallelization: Wave 5 | Blocked by: 3, 4, 5, 6 | Blocks: —
  References:
  - AGENTS.md §本项目反模式 当前 3 条粗体 hard bullet 格式参考
  - docs/learnings.md 当前 #28 条目格式
  - HAR 报告 `.omo/evidence/har-analysis/HAR-ANALYSIS-REPORT.md`
  - 本 plan 的 Alternative evaluation section 作为 learnings #29 的素材
  Acceptance criteria:
  - `pnpm typecheck` 0 error
  - `pnpm lint` 0 error
  - `pnpm build` 0 error（docs 不改 route 数量）
  - `pnpm vitest run` 88 例全绿
  - `node tests/qa/commit-audit.mjs --branch main` 0 violation
  - 引用 footer `Plan: .omo/plans/pwa-turso-delete-timeout-and-sw-cache.md`
  QA scenarios:
  - 手动：grep AGENTS.md §反模式 含 "AbortController" + "Cache-Control" 两关键词
  - 手动：grep docs/learnings.md 含 "29." 条目编号
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/commit-9-docs-grep.txt`
  Commit: Y | docs(agents-md): anti-pattern bullets for fetch timeout + cache headers
  Lore trailer: Constraint AGENTS.md §反模式 格式 / Rejected 改 DESIGN.md (非视觉契约变更) / Confidence High / Scope-risk Low (docs only) / Directive bullet 格式严格匹配现有 3 条；footer 引用本 plan / Tested tsc, eslint, next build (route count unchanged), commit-audit / Not-tested 真实 lint 全规则（lint 已通过）

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
  - 对照 Must have 9 条 + Must NOT have 14 条逐条核；commit log 9 条全部存在
  - 各 commit footer 含 `Plan: .omo/plans/pwa-turso-delete-timeout-and-sw-cache.md`
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/f1-plan-compliance.txt`
- [ ] F2. Code quality review
  - 独立 reviewer agent 审查 diff：store timeout helper 类型正确、Button loading prop API 一致、SW cache 正则无 ReDoS、QA 探针无 flaky 风险
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/f2-code-review.md`
- [ ] F3. Real manual QA
  - production build + 真实 Chrome
  - 验证 (a) 主页 reload 后 DevTools Network 面板 `manifest.webmanifest` 第二次显示 `(ServiceWorker)`
  - 验证 (b) 重置战绩按钮 click 后立即出现 loading spinner + disabled
  - 验证 (c) `curl -I` 看 manifest/icon headers 是 `max-age=300`
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/f3-manual-qa.txt` + screenshots
- [ ] F4. Scope fidelity
  - `pnpm ls --depth=0` 对比 plan 前/后，0 new deps
  - `rg "'use server'" lib components app` 0 matches
  - `rg "unstable_cache|cacheComponents|experimental.ppr" lib components app next.config.ts` 0 matches
  - `rg "setInterval.*fetch|setTimeout.*fetch" lib components` 0 matches（无轮询）
  - Evidence `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/f4-scope-grep.txt`

## Commit strategy

**9 atomic commits**, each independently green and individually runnable through the 6-layer gauntlet:

| # | commit subject | file(s) | risk |
| --- | --- | --- | --- |
| 1 | `feat(next-config): Cache-Control headers for manifest, icon, apple-icon, favicon` | `next.config.ts` | Low |
| 2 | `feat(sw): cache-first GET handler for static assets` | `public/sw.js` | Low |
| 3 | `feat(store): AbortController.timeout wrapper for apiPutStats + apiDeleteStats` | `lib/store.ts` | Medium |
| 4 | `feat(ui): loading state on Button primitive` | `components/ui/Button.tsx` | Low |
| 5 | `feat(stats-reset): wire loading state in ResetStatsButton` | `components/ResetStatsButton.tsx` | Low |
| 6 | `feat(stats-reset): wire loading state in ResultActions` | `components/ResultActions.tsx` | Low |
| 7 | `test(store): cover AbortController timeout in store.test.ts` | `tests/store/store.test.ts` | Low |
| 8 | `test(qa): new pwa-sw-cache-qa.mjs Playwright probe` | `tests/qa/pwa-sw-cache-qa.mjs` | Low |
| 9 | `docs(agents-md): anti-pattern bullets for fetch timeout + cache headers` | `AGENTS.md` + `docs/learnings.md` | Low |

每 commit 必须带 lore trailer（Constraint: / Rejected: / Confidence: / Scope-risk: / Directive: / Tested: / Not-tested:）；commit 9 footer 含 `Plan: .omo/plans/pwa-turso-delete-timeout-and-sw-cache.md`。

每 commit 后由执行 worker 收集证据到 `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/commit-<N>-<slug>.txt`。

## Success criteria

本 plan 在以下条件全部成立时算交付：

1. **All 9 commits landed**，commit log 顺序与 commit strategy 表一致；每个 commit footer 含 Plan 引用
2. **6 层 Gauntlet per commit 全绿**：vitest 92 例（含 commit 7 新增 4 个 abort 用例）、tsc strict、eslint、next build、commit-audit 0 violation
3. **On-demand coverage + mutation 全绿**（commit 3 触发）：store coverage ≥ pre-fix baseline；store mutation score ≥ pre-fix baseline
4. **Final verification wave F1-F4 全 APPROVE**
5. **Real manual QA**：production build + Chrome 中，reload 后 manifest 第二次 source = `(ServiceWorker)`；重置按钮 loading + disabled 可见
6. **AGENTS.md §反模式 +2 bullet，footer 引用本 plan**
7. **docs/learnings.md #29 条目已落**

证据收集到 `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/`：

```
.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/
├── commit-1-headers-curl.txt
├── commit-2-sw-cache-qa.txt
├── commit-3-vitest-abort.txt
├── commit-4-button-loading.txt
├── commit-5-reset-button-loading.txt
├── commit-6-result-actions-loading.txt
├── commit-7-vitest-abort-cases.txt
├── commit-8-pwa-sw-cache-qa.txt
├── commit-9-docs-grep.txt
├── f1-plan-compliance.txt
├── f2-code-review.md
├── f3-manual-qa.txt
└── f4-scope-grep.txt
```

---

## Alternative evaluation (rejection log — read this before proposing similar changes)

> 本节是 ulw-plan 阶段用户提供的外部研究 + 我方代码层核查 + AGENTS.md 硬约束综合得出的判断日志。**目的不是给本 plan 找退路，而是把"为什么这些方案被拒绝"的判断依据沉淀下来，下次遇到类似决策可直接复用。**

### A. Serwist / next-pwa — **REJECTED**

**它能解决什么**：成熟的 Workbox 衍生 PWA 库。提供自动 precache manifest、`StaleWhileRevalidate` / `NetworkFirst` / `CacheFirst` 等内置策略、`navigationPreload: true`、`?workbox` 调试通道、自动 SW 生成 + build 插件集成。

**Pros**：
- 配置 ~8-10 行替代 vanilla SW ~15-50 行
- 工业级（百万级 production SW 实例）
- TypeScript-first
- 自动维护 `_next/static/**` precache 列表（不用手写正则）
- `navigationPreload` 改善感知性能

**Cons**：
- 2 个新 npm 依赖（`@serwist/next`, `serwist`）—— 直接违反 AGENTS.md 「❌ 新增任何 npm 依赖」
- 额外 worker bundle ~60-150KB
- 行为被封装，bug 排查需读 Workbox 源码
- 我们的 SW 目标是缓存 **5 类静态资源**（manifest + icon + apple-icon + favicon + `_next/static/**`），Serwist 优势（复杂路由 pattern、离线页面、precache 全 build 输出）在本规模下用不上

**拒绝理由**：项目硬约束（无新依赖）+ 当前规模（5 个 cacheable 路径）让 Serwist 处于 overkill 区。**未来触发条件**（revisit）：如果加入 IndexedDB 离线战绩缓存（HAR 报告 "large" 选项）、offline replay、复杂路由策略，那时 Serwist 的 ROI 才显出来。

---

### B. `'use server'` + `revalidateTag` — **REJECTED**

**它能解决什么**：把 PUT/DELETE 改成 React Server Action，action 内调用 DB 后 `revalidateTag('stats')` 让 RSC 失效 + 立即 re-render。客户端不再手动 fetch `/api/stats`。

**Pros**：
- 类型安全 RPC，告别手写 fetch + JSON.parse + 类型断言
- Action 返回值直接给组件用，无需 follow-up GET
- 服务端校验 + 自动类型生成
- React 19 + Next.js 15+ 官方推荐写法

**Cons**：
- 违反 AGENTS.md 「❌ 引入 'use server' directive」
- 本项目 `force-dynamic`，`revalidateTag` 是 ISR 语义，**force-dynamic 下页面本来就每次 re-render，revalidateTag 是冗余**（上一轮 plan `.omo/plans/pwa-rsc-stats-bug-fix.md` §六 commit 3 决策就是基于这点拒绝 `revalidatePath`）
- **它在解决一个误诊的问题**：外部研究提出"`/stats` 被前端轮询"。实测：HAR PWA 12 GET / 8 cycles = 1.5/cycle = (1) 初始 RSC load + (2) PUT 后 `router.refresh()`。两次都是 server-side 读最新数据，不是 client 轮询。代码层 `setInitialStats` 只在 mount 时跑一次（`StatsHydrator.tsx:15`），全仓 `setInterval` / `setTimeout(fetch)` 搜索为空
- 风险：会**重新引入 B-3**（RSC 陈旧数据）—— Server Action + cache revalidation 正是 B-3 容易回归的接触面

**拒绝理由**：违反硬约束 + 解决误诊问题 + 重新引入已修 bug。

---

### C. `unstable_cache` / React `cache()` / `experimental.ppr` — **REJECTED**

**`cache()` (React 内置)**：
- 它能解决什么：单次 render pass 内同请求去重
- Pros：零依赖
- Cons：**只对同一 render 内有效**，跨 request 不缓存；stats 每次 nav 是独立 request，`cache()` 用不上
- 拒绝理由：scope 不匹配

**`unstable_cache`**：
- 它能解决什么：跨 request 缓存 + tag 失效
- Pros：tag-based invalidation 比手动 cache 优雅
- Cons：`unstable_` 前缀 = API 可能变；和 force-dynamic 模式直接冲突（force-dynamic 下本来就每次 fetch）
- 拒绝理由：违反 `force-dynamic` 决策

**`experimental.ppr` (Partial Prerendering)**：
- 它能解决什么：static shell + dynamic islands，LCP 改善
- Pros：理论改善 LCP
- Cons：experimental flag；需要 `cacheComponents: true`（AGENTS.md 禁止）；本项目 3 个页面都是 server-rendered 整页，没有 "shell 静态 + 一小块动态" 的场景
- 拒绝理由：overkill + 违反硬约束

---

### D. `next.config.ts` Cache-Control headers — **PARTIALLY ADOPTED as P3 layer-1**

**它能解决什么**：给 `manifest.webmanifest` / `icon.svg` / `apple-icon*` / `favicon*` 加 `Cache-Control: public, max-age=300`（替代现状 `max-age=0, must-revalidate`），让浏览器 5 分钟内不重新校验，省掉 304 roundtrip。

**Pros**：
- HAR 直读显示现状 `manifest` + `icon.svg` 是 `max-age=0, must-revalidate`，**这是 fetch 反复发生的原因之一**（之前我误判为"已 CDN 缓存无需 header"——实测只有 `_next/static/**` 有 immutable header，manifest/icon 没有）
- 零运行时成本，1 处 config 改动
- 零新依赖
- 兼顾 Vercel CDN 边缘 + 浏览器两层

**Cons**：
- 不能消除 cold load
- 不能离线
- stale window（manifest 内容变了浏览器看不到；缓解：SW cache versioning 或 hash-suffix URL）
- 不减少请求次数，只减响应时间
- 量级：header hit = 50-200ms 304 roundtrip；SW hit = 0ms。SW 严格优于 header

**采用决定**：**作为 P3 双层的 layer-1**，与 SW cache-first（layer-2）共存。理由：
- header 是更便宜的修复（不动 SW 逻辑）
- SW 是更彻底的修复（0ms vs 200ms）
- 两者**互补不替代**：header 让首次重访省 304 roundtrip，SW 让所有重访 0ms
- 单独只做 header 不做 SW 也能缓解 P3 的 56-94 次重复 fetch
- 单独只做 SW 不做 header 也能修复但损失了 Vercel CDN 边缘命中

**结论**：拒绝"用 header 替代 SW"或"用 SW 替代 header"的二元选择；采纳双层组合。

---

### E. 关于 "Client 端轮询 `/api/stats`" 的诊断 — **CORRECTED**

外部研究提出 "`/stats` 是高频写接口被当成 GET 轮询"。**这是一个错误诊断**，原因：

1. 全仓 `rg "setInterval.*fetch|setTimeout.*fetch"` 搜索结果 = 0
2. `StatsHydrator.tsx:15` `useEffect(() => setInitialStats(stats), [stats])` 仅在 mount 时跑一次
3. HAR 数据：PWA 12 GET / 8 cycles = 1.5/cycle，与"初始 RSC load + PUT 后 router.refresh() 触发 RSC 重新读"完全吻合
4. 上次 commit `d25758a` 显式去掉了 setTimeout 700ms 等待，改为 lastWriteAt 事件订阅 —— 客户端没有任何主动 GET 触发点

误诊根因：截图工具的引用（如 "store.ts:79"）可能来自老代码版本，或把 RSC navigation 触发的 server-side GET 当成了 client-side 主动 fetch。**教训**：下次看到"前端轮询"类诊断，先用 `rg` + `setInterval`/`setTimeout`/useEffect 触发点核对，不要凭直觉接受。

---

### F. 关于 "Service Worker 没注册成功" 的诊断 — **CORRECTED**

外部研究提出 "没看到任何 `sw.js` / 注册请求，意味着 Service Worker 没注册成功"。**这也是错误诊断**，原因：

1. HAR 不显示 `sw.js` 直接请求 = **SW 已经在抓包之前就注册完成**（SW 注册是低频事件，只发生一次）
2. HAR `0 sw.js` + PUTs 1:1 with wins 是**正向证据**：B-1 修复（commit 971bb41）的方法门控只在 SW fetch handler 介入后才生效；如果 SW 没注册，PUT 会双发（被浏览器自身和 SW respondWith 各发一次），HAR 就会出现 16 PUT 而非 8 PUT
3. 当前 `components/ServiceWorkerRegister.tsx:14-22` 在 production build 下 `navigator.serviceWorker.register('/sw.js')` 是显式调用

误诊根因：HAR 不记录 SW 内部事件。**教训**：SW 是否激活要看间接证据（B-1 invariant 是否保持），不是直接看 sw.js 请求数。

---

### G. HAR 直读发现的"我之前没看清的事实" — **已纳入 P3 双层方案**

| 资源 | 现状 Cache-Control | 来源 |
| --- | --- | --- |
| `_next/static/*` | `public, max-age=31536000, immutable` | HAR 直读 |
| `manifest.webmanifest` | `public, max-age=0, must-revalidate` | HAR 直读（之前误判"已 CDN 缓存"） |
| `icon.svg` | `public, max-age=0, must-revalidate` | HAR 直读（同上） |
| `apple-icon*` / `favicon*` | `max-age=0, must-revalidate` | HAR 直读（同上） |

**教训**：对外部研究或自己之前的判断，**直接读原始 HAR 数据**比凭印象 / 凭 chat 工具诊断可靠。这次"manifest 已 immutable"是误判；直读 HAR 后修正为 P3 双层。

---

## 相关文档与上游引用

- **本 plan 起源**：HAR 报告 `.omo/evidence/har-analysis/HAR-ANALYSIS-REPORT.md`
- **上一份同类 plan**：`.omo/plans/pwa-rsc-stats-bug-fix.md`（B-1/B-2/B-3 修复 + 6 层 gauntlet + commit 拆分惯例参考）
- **AGENTS.md**：本 plan 的所有硬约束来源（"❌ 新增任何 npm 依赖" / "❌ 引入 'use server'" / `force-dynamic` / §验证门禁 6 层）
- **Stryker scope 文件**：`lib/game.ts` / `lib/db.ts` / `lib/store.ts` / `db/schema.ts`（commit 3 触发）
- **现有 QA 探针模板**：`tests/qa/stats-race-qa.mjs:1-80`
