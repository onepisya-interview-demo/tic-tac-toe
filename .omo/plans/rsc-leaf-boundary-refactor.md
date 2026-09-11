# Plan: RSC Leaf Boundary Refactor — FINAL v1.0

> **Status: FINAL v1.0 (2026-09-11)**
> 已用户签字（2026-09-11，本轮 prompt 显式授权 "ulw A、B、C 全部都用做"）。
> 7 个原子 commit（5 impl + 1 docs + 1 chore(lint)）+ 5 个 merge commit + 2 个 plan commit 已在 main 落地；
> 5 份 sub-plan 的 worker 分支 + 对应 worktree 已收尾清理。本 v1.0 commit 单独跟踪状态字段升级。
>
> **v0.2 相对 v0.1 的关键变更**（详见末尾 Decision Log）：
> 1. **C1（SoundToggle 上移到 layout）取消** —— 用户确认 SoundToggle 继续留在每个 page header slot，layout 不做 fixed 定位。
> 2. **C5（store.stats 解耦）从可选改为必做**。
> 3. **加入并行执行结构**：master plan 之上，每个并行 commit 拆出独立的 `rsc-leaf-boundary-refactor-<task>.md` 子计划，给子代理在独立分支上读取。
> 4. **加入 docs 同步**：C5 完成后同步 `docs/learnings.md`（新条目）和 `docs/verification-gauntlet.md`（store 解耦后的 mutation target 注释）。
>
> 备份：[`.omo/plans/rsc-leaf-boundary-refactor.v0.1.md.bak`](/private/tmp/tic-tac-toe/.omo/plans/rsc-leaf-boundary-refactor.v0.1.md.bak)

---

## TL;DR（For humans）

**What you'll get**：
- 3 个游戏页面（`/`、`/play`、`/result`）从 `'use client'` 改成 RSC shell。
- 3 个叶子 client 组件承载交互逻辑：`<StartGameButton>`、`<PlayController>`、`<ResultActions>`。
- `stats` 数据从 client fetch `/api/stats` 改为 RSC `await loadStats()` 直读 `lib/db.ts`；`useGameStore` 不再管理 stats 展示状态。
- SoundToggle 保持现状（每个 page header slot）—— 不上移 layout、不做 fixed 定位。

**Why this approach**：项目当前 client bundle 约 668K（12 chunks 未压缩），其中 `useRouter` 把 160K 的 Next router glue 拖进首屏，业务代码本身其实很轻。把 page 改回 RSC 后，所有展示型基础组件（`ui/Card`、`Button`、`StatsGrid`、`StatusBar`）依然以 RSC 形态被 server 渲染（React/Next 官方明确推荐「specific interactive components should be client, large parts stay server」）；交互逻辑收敛到叶子，client graph 收缩；首屏 HTML 自带战绩数据，hydration 后无需 fetch，no flicker。

**What it will NOT do**：不改 `lib/game.ts` 纯规则、不改 `lib/db.ts` 行为、不改 `DESIGN.md`/视觉/可达性契约、不删 `/api/stats` 路由（保留作为 PUT/DELETE 入口）、不引入新 npm 依赖（含 `server-only` / `client-only`）、不动 SoundToggle 的当前位置、不动 Tailwind tokens、不改 commit-msg hook。

**Effort**：Medium
**Risk**：Low–Medium。client boundary 改写属于「refactor crossing domain boundaries」（HEAVY 信号之一），但本仓库 6 层 Gauntlet 完备、改动可分原子提交并独立验证，所以实际 HEAVY 化只发生在「跨模块同步改动时」，单 commit 内仍是 LIGHT。C5 涉及 `lib/store.ts`（Stryker target）改动，触发 on-demand 验证层（coverage + mutation），但有现成基线（84.50%）对照。

> TL;DR (machine): Medium / Low-Medium. 改动文件 ⊆ {`app/page.tsx`, `app/play/page.tsx`, `app/result/page.tsx`, `lib/store.ts`, `components/StartGameButton.tsx`(new), `components/PlayController.tsx`(new), `components/ResultActions.tsx`(new), `docs/learnings.md`, `docs/verification-gauntlet.md`}. 零新 npm 依赖。

---

## Background & Evidence

### 1. 官方依据（React 19 + Next.js 16）

- [react.dev/reference/rsc/use-client](https://react.dev/reference/rsc/use-client)
  - "Server Components cannot support interaction as event handlers must be registered and triggered by a client."
  - "Server Components cannot use most Hooks."
  - "Prop values passed from a Server Component to Client Component must be serializable."
- [nextjs.org/docs/app/guides/server-and-client-boundary](https://nextjs.org/docs/app/guides/server-and-client-boundary)
  - **"You only need `'use client'` at the entry to a client subtree, not on every file inside it. Every module imported from that entry becomes part of the client module graph."**
  - "Passing rendered output as `children` lets a Server Component nest inside a Client Component without importing the Server Component's code into the client graph."
- [nextjs.org/docs/app/getting-started/server-and-client-components#reducing-js-bundle-size](https://nextjs.org/docs/app/getting-started/server-and-client-components#reducing-js-bundle-size)
  - **"To reduce the size of your client JavaScript bundles, add `'use client'` to specific interactive components instead of marking large parts of your UI as Client Components."**
- [nextjs.org/docs/app/api-reference/directives/use-client](https://nextjs.org/docs/app/api-reference/directives/use-client)
  - "You do not need to add the `'use client'` directive to every file that contains Client Components. You only need to add it to the files whose components you want to render directly within Server Components."

### 2. 项目本地约束

- `components/AGENTS.md`：**"只有交互组件使用客户端模式；展示型基础组件保持 server-compatible。"** 本 plan 与该既有约束一致。
- `AGENTS.md` §验证门禁：6 层 Gauntlet（Tests / Types / Lint / Build / Commit-audit / Browser QA）+ on-demand（Coverage / Mutation / Property-based）。所有改动必须经此门禁。
- `AGENTS.md` §提交约定：原子 commit，每份独立 build + test 为绿；非平凡提交 footer `Plan: .omo/plans/<slug>.md`。
- `AGENTS.md` §并行纪律：主任务 ≤ 4 子代理并发；本 plan 把 4 份 commit 拆为 4 份 sub-plan，匹配这条约束。

### 3. 当前状态（实测）

- 3 个 page 文件全部 `'use client'`：`app/page.tsx:1`、`app/play/page.tsx:1`、`app/result/page.tsx:1`。
- `app/play/page.tsx` 是唯一含 `useEffect` 的页面（3 处），用于：①auto-start game；②setTimeout → `router.replace('/result')`；③cleanup。
- `app/page.tsx` / `app/result/page.tsx` 仅通过 `useGameStore((s) => s.xxx)` 订阅状态 + `onClick` 调用 store action → 严格来说不需要整页 client，只需订阅层是 client。
- 业务 client 组件：`Board` / `Cell` / `SoundToggle` / `Confetti` / `ServiceWorkerRegister` —— 全部正确标记。
- `.next/static/chunks/` 实测：12 个 chunk / 668K 未压缩。其中 `3ta1i4aoxr3of.js` 160K 含 `dispatchAppRouterAction` —— 由 `useRouter` 拖入。
- `lib/db.ts` 已导出 `loadStats()` / `saveStats()` / `resetStats()` —— RSC 可直接 `await loadStats()`，无需新增 API。
- `useGameStore` 当前同时管 board/phase 和 stats；store.stats 由 client `/api/stats` GET 拿，hydration 后填入。


---

## Scope

### Must have（按 ROI 排序，每条至少一份原子 commit；全部必做，无可选）

1. **`app/page.tsx` 从 client 改 RSC，提取 `<StartGameButton>`（client）**
   - Page 改成 `async`，内部 `const stats = await loadStats()` 直接 RSC 拿数据。
   - `useGameStore` 的 `stats` 字段在 C5 之后由 page 不再订阅；C5 完成前本 commit 仍由 store 拿 stats 通过 props 传给 `<StatsGrid>`。
   - `<StartGameButton>` 是新的 client 组件：`const startGame = useGameStore((s) => s.startGame); return <Link href="/play" onClick={startGame}><Button .../></Link>`。
   - 重置战绩按钮抽成 `<ResetStatsButton>`（client）。
   - Acceptance：`/` 首屏 HTML 含 `<StatsGrid>` 数据（之前需 hydration 后才出）；`pnpm build` 后 `node tests/qa/visual-qa.mjs` snapshot 中 `stat-value` 字段不变；`tests/qa/hydration-check.mjs` 仍 PASS（无 SSR mismatch）。

2. **`app/play/page.tsx` 从 client 改 RSC，提取 `<PlayController>`（client）+ 保留 `<Board>`**
   - Page 改成 `async` RSC（不需要 await 数据，因为 play 页主要靠 client 状态）。
   - `<PlayController>` 接管 `useEffect` auto-start + `router.replace('/result')` 跳转；用 `<PlayController>` 包裹 `<Board>`。
   - Acceptance：`/play` 首次访问 auto-start 不变；胜利/平局 700ms 后跳 `/result` 不变；`tests/qa/win-flow.mjs` 仍 PASS；`tests/qa/keyboard-roving.mjs` 仍 PASS。

3. **`app/result/page.tsx` 从 client 改 RSC，提取 `<ResultActions>`（client）**
   - Page 改成 `async`，`const stats = await loadStats()`（同 C1 模式）。
   - `<ResultActions>` 接管"再来一局 / 返回首页 / 重置战绩"三个 client 动作（含 `startGame`、`restart`、`resetAll`）。
   - `<Confetti />` 保留 client（已经在 client），父 page 是 RSC → Confetti 的代码依然进 client graph（与现状一致）。
   - Acceptance：`/result` 首屏 HTML 含战绩；`tests/qa/confetti-probe.mjs` 仍 PASS；`tests/qa/hydration-check.mjs` 仍 PASS。

4. **`lib/store.ts` 把 `stats` 从 store 移到 RSC-only**
   - 现状：`useGameStore` 同时管 `board` / `phase` / `stats`；stats 由 hydrateStats → `/api/stats` 拿。
   - 目标：`board` / `phase` 仍在 store；`stats` 由 RSC `await loadStats()` 拿，通过 props 传给展示组件。
   - **API 契约**：`useGameStore` 的 `stats` 字段保留（read-only 副本，用于 store 内部 action 写回时的中间状态），但展示组件不再直接订阅；展示路径走 RSC → props → `<StatsGrid>`；写入路径（resetAll → saveStats → 路由刷新）保留 PUT/DELETE 行为。
   - `hydrateStats` action 删除（client 不再发起 stats GET）。
   - 收益：首屏 HTML 含 stats（更早可见）、hydration 后无 fetch、no flicker。
   - 风险：`/result` 硬刷新看到的战绩现在来自 RSC（之前来自 client `/api/stats` GET），如果 RSC 失败 → 页面降级到空 stats（之前是 client 失败后空 stats，行为一致）。
   - Acceptance：所有 store 单测通过；Stryker mutation on `lib/store.ts` 通过（基线 84.50% 不退化）；vitest coverage 80/80/70/80 阈值不退化。

5. **Docs 同步**（与 C5 配套）
   - `docs/learnings.md`：新增一条 "RSC leaf boundary refactor"，≤ 30 行。
   - `docs/verification-gauntlet.md`：新增一条 mutation target 注释，明确 `lib/store.ts` 在 C5 之后仍是 4 files scope 之一；如有 mutation 存活率因 C5 改动而变化，记录新基线。

### Must NOT have（scope guardrails）

- 不引入新 npm 依赖（`server-only` / `client-only` / 其他均不引入）。
- 不修改 `lib/game.ts`（Stryker target，行为不变）。
- 不修改 `lib/db.ts`（仅在 RSC 中 `import { loadStats }`，不改语义）。
- 不修改 `db/schema.ts`。
- 不修改 `app/api/stats/route.ts`（保留 PUT/DELETE 入口 + Node runtime 选择）。
- 不修改 `components/Board.tsx` / `Cell.tsx` / `Confetti.tsx` / `ServiceWorkerRegister.tsx` / `SoundToggle.tsx`（已正确；SoundToggle 位置不动）。
- 不修改 `components/ui/Card.tsx` / `Button.tsx` / `StatsCard.tsx` / `StatsGrid.tsx` / `StatusBar.tsx`（已正确保持 RSC）。
- 不修改 `DESIGN.md` / `app/globals.css`（视觉/可达性契约）。
- 不修改 Tailwind class、不引入新色板或内联 hex。
- 不删任何现有 data-testid（QA 契约）。
- 不修改 `AGENTS.md` / `CONTRIBUTING.md`。
- 不使用 `git commit --no-verify`。
- **不动 SoundToggle 当前位置**（layout 不做 fixed 定位；每个 page header 保留 slot）。


---

## Verification strategy

引用项目 6 层 Gauntlet（[docs/verification-gauntlet.md](/private/tmp/tic-tac-toe/docs/verification-gauntlet.md)）：

| 层 | 工具 | 触发 | 产物路径 |
|---|---|---|---|
| Tests | vitest 5 + jsdom 30（88 例） | ✅ 每 commit | `pnpm vitest run` 退出 0 |
| Types | tsc 5 strict | ✅ 每 commit | `pnpm typecheck` 退出 0 |
| Lint | eslint 9（tests/qa/\*\* ignore） | ✅ 每 commit | `pnpm lint` 退出 0 |
| Build | next build | ✅ 每 commit | `pnpm build` 退出 0；route 数不变 |
| Commit-audit | `node tests/qa/commit-audit.mjs` | ✅ 每 commit | 0 violations |
| Browser QA | `tests/qa/*.mjs` | ✅ 每 commit（改动触及 UI） | 至少：`visual-qa` / `hydration-check` / `audio-probe` / `audio-confetti-qa` / `win-flow` / `keyboard-roving` / `confetti-probe` 全部 PASS |
| Coverage | vitest --coverage（lib/\*\* + db/\*\*） | ⚠️ on-demand（C4 触发） | scope 命中（`lib/store.ts` 改动） |
| Mutation | Stryker 4 files scope | ⚠️ on-demand（C4 触发） | scope 命中（`lib/store.ts` 改动） |
| Property-based | fast-check | ⚠️ on-demand | 不新增 lib/X.ts 纯函数 → 不触发 |

附加手动验收（human-in-loop）：
- `pnpm start` 生产构建启动后，浏览器实测 3 个页面首屏 HTML 中战绩可见（用 `view-source:` 看源码）。
- `chrome-devtools-axi` Performance：Largest Contentful Paint 不退化（基线：现有 LCP < 1.5s on Vercel prod）。

每份 commit 的 evidence 产物（落到 `.omx/evidence/rsc-leaf-boundary-refactor/<task>/`）：
- `task-{1..N}-build.log`
- `task-{1..N}-vitest.log`
- `task-{1..N}-typecheck.log`
- `task-{1..N}-lint.log`
- `task-{1..N}-commit-audit.log`
- `bundle-comparison.md`：改前 `.next/static/chunks/` 总大小 vs 改后 diff 表

---

## Execution strategy

### 并行模式

按用户决策："我们不串行；C1–C4 拆为 4 份 sub-plan + 4 个子代理分支并行执行。" 每份 commit 独立验证、独立 commit、独立 push、独立 review。

### Atomic commits 拆分（4 份并行 + 1 份 docs 同步）

按 ROI 升序，全部必做。

| # | Commit 主题（占位，最终以 review 后定） | 改动文件 | 风险 | 分支 |
|---|---|---|---|---|
| C1 | `refactor(home): convert home page to RSC + extract StartGameButton` | `app/page.tsx`、新增 `components/StartGameButton.tsx`、新增 `components/ResetStatsButton.tsx` | 低 | `refactor/rsc-c1-home` |
| C2 | `refactor(play): convert play page to RSC + extract PlayController` | `app/play/page.tsx`、新增 `components/PlayController.tsx` | 中（useEffect 顺序保持需论证） | `refactor/rsc-c2-play` |
| C3 | `refactor(result): convert result page to RSC + extract ResultActions` | `app/result/page.tsx`、新增 `components/ResultActions.tsx` | 低 | `refactor/rsc-c3-result` |
| C4 | `refactor(store): decouple stats from zustand; RSC owns stats fetch` | `lib/store.ts`、3 个 page 文件、`<StatsGrid>` 调用方 | 中–高（跨模块 + Stryker target） | `refactor/rsc-c4-store` |
| C5 | `docs(learnings): record RSC leaf boundary refactor + mutation target note` | `docs/learnings.md`、`docs/verification-gauntlet.md` | 极低 | `refactor/rsc-c5-docs` |

### Dependency matrix

| Commit | Depends on | Blocks | Can parallelize with |
|---|---|---|---|
| C1 | master plan 已 commit | C4（store 改造前后 page 调用方变化） | C2, C3, C5（文件不冲突） |
| C2 | master plan 已 commit | C4（同上） | C1, C3, C5（文件不冲突） |
| C3 | master plan 已 commit | C4（同上） | C1, C2, C5（文件不冲突） |
| C4 | C1, C2, C3 全部合入 | C5（docs 同步依赖最终 store 行为） | C5（如果 C5 docs 描述"refactor"而不是具体 mutation 数字，可与 C4 并行；保守串行） |
| C5 | C4 行为稳定 | （最终汇报） | （独立文档改） |

**并行分支**：C1 / C2 / C3 / C5 4 个分支可同时跑子代理；C4 必须在 C1–C3 合入后单独跑。

### Per-commit 子计划

| Sub-plan 路径 | 服务于 | 工作量 |
|---|---|---|
| `.omo/plans/rsc-leaf-boundary-refactor-c1-home.md` | C1 子代理 | ~5–7 KB |
| `.omo/plans/rsc-leaf-boundary-refactor-c2-play.md` | C2 子代理 | ~5–7 KB |
| `.omo/plans/rsc-leaf-boundary-refactor-c3-result.md` | C3 子代理 | ~5–7 KB |
| `.omo/plans/rsc-leaf-boundary-refactor-c4-store.md` | C4 子代理 | ~7–10 KB（含 Stryker / coverage 验证） |
| `.omo/plans/rsc-leaf-boundary-refactor-c5-docs.md` | C5 子代理 | ~2–3 KB |

每份 sub-plan 是 self-contained 的：scope（具体文件 + 改前/改后片段）、commit 主题（含 lore trailer）、verification 命令清单、evidence 产物路径、acceptance criteria、cleanup receipt。子代理 fork_turns=none + 读自己那份 sub-plan + 独立分支 + 独立 commit。

### 工作流（用户拍板后启动）

1. ~~**Step 1**：用户 review 本 master plan（v0.2）→ 签字。~~ ✅（用户在本轮 prompt 显式授权升级到 v1.0，"ulw A、B、C 全部都用做"）
2. **Step 2**：executor 在 main 上 commit 本文件 + 5 份 sub-plan（sub-plan 在 executor 自己的会话里写）。
3. **Step 3**：从 main 创建 4 个分支：`refactor/rsc-c1-home`、`refactor/rsc-c2-play`、`refactor/rsc-c3-result`、`refactor/rsc-c5-docs`。
4. **Step 4**：派 4 个子代理同时跑（`multi_agent_v1.spawn_agent`，fork_context=false，每个读自己那份 sub-plan）。每个子代理独立 commit + push + 报 evidence 路径。
5. **Step 5**：合入 4 个分支 → 从 main 创建 `refactor/rsc-c4-store` 分支 → 派第 5 个子代理跑 C4（含 Stryker + coverage）。
6. **Step 6**：合入 C4 → 父会话做 bundle 对比 + 最终验收 + 汇报。
7. **Step 7**（可选）：如 C4 合入后 mutation score 显著变化（> ±1%），从 main 创建一次 C5' docs 补丁分支，记录新基线。


---

## Todos

> Implementation + Test = ONE todo. 草稿 → final 路径。

- [x] **T1. 用户 review & 签字 master plan v0.2** → 解除 DRAFT（已生效：commit `cf53f71` + `cb49fdc` 已于 04:14 / 04:15 入 main，本 commit 单独跟状态字段）
- [ ] **T2. Commit master plan + 4 份 sub-plan 到 main**
  - 1 份 master commit（`docs(plans): finalize rsc-leaf-boundary-refactor v1.0`）+ 4 份 sub-plan 落地 commit
  - 0 violations in `node tests/qa/commit-audit.mjs --branch main`
- [ ] **T3. 创建 4 个并行分支 + 派 4 个子代理**
  - C1 / C2 / C3 / C5 同时跑
  - 每子代理独立：commit + push + 上报 evidence 路径
  - 父会话汇总 evidence 到 `.omx/evidence/rsc-leaf-boundary-refactor/<task>/`
- [ ] **T4. 合入 C1–C3 + C5 → 创建 C4 分支 + 派第 5 子代理**
  - C4 改动 `lib/store.ts`，触发 Stryker + coverage on-demand 层
  - 子代理需报告：新 mutation score（vs 84.50% 基线）、新 coverage（vs 80/80/70/80 阈值）
- [ ] **T5. 合入 C4 → docs 同步分支（如未与 C5 并行）**
  - `docs/learnings.md` 新增 ≤ 30 行条目
  - `docs/verification-gauntlet.md` 新增 mutation target 注释
- [ ] **T6. Bundle 对比**
  - 改前 `.next/static/chunks/` 总大小 vs 改后 diff 表 → `bundle-comparison.md`
- [ ] **T7. 最终汇报**
  - 5 份 commit 列表
  - bundle 节省字节数（业务代码 + Next router glue）
  - 首屏 HTML 含战绩的 evidence（view-source 截图）
  - LCP / Performance 不退化的 evidence

---

## Decisions（v0.2 闭合全部 open questions）

| # | 问题 | 决定 | 影响 |
|---|---|---|---|
| 1 | C5（store.stats 解耦）做不做？ | **必做** | 4 份 commit 之一；触发 Stryker + coverage on-demand |
| 2 | SoundToggle 在 layout 的位置？ | **保持现状**（每 page header slot；layout 不做 fixed 定位） | 取消原 C1；SoundToggle 不动 |
| 3 | Page 改 RSC 后如何处理 Confetti？ | **保留直挂**（RSC page 里直接渲染 `<Confetti />`，与现状一致） | C3 不变；不引入 conditional mount |
| 4 | 引入 server-only / client-only 包？ | **不引入**（违反"不加新依赖"约定） | RSC 直读 lib/db.ts 靠约定 + ESLint 防呆 |
| 5 | 同步升级 next / @libsql/client？ | **不升级**（触及 engines.node 24.x 契约） | package.json / pnpm-lock.yaml 不动 |
| 6 | 同步更新 docs/learnings.md？ | **是** | C5 范围内新增一条 |
| 7 | 是否拆 PR / 分支？ | **无 PR；分支可拆**（4 份并行分支 + 1 串行 C4 分支） | 工作流按 Step 1–7 推进 |
| 8 | 同步更新 docs/verification-gauntlet.md？ | **是**（C5 完成后加 mutation target 注释） | 与 C5 配套 |

---

## Decision Log

- **DRAFT v0.1（2026-09-11 02:07）**：初始草稿。上一轮调查结论 → 5 条建议 → 4 份原子 commit + 1 份可选。8 个 open question 待用户回复。
- **DRAFT v0.2（2026-09-11 02:40）**：
  - 用户对 8 个 open question 全部给出答复。
  - C1（SoundToggle 上移）取消 → SoundToggle 保留在 page header slot。
  - C5（store.stats 解耦）从可选升为必做。
  - 加入并行执行结构：C1 / C2 / C3 / C5 4 份 sub-plan 并行跑；C4 依赖合入后串行。
  - 加入 docs 同步：docs/learnings.md + docs/verification-gauntlet.md。
  - 备份：[`.omo/plans/rsc-leaf-boundary-refactor.v0.1.md.bak`](/private/tmp/tic-tac-toe/.omo/plans/rsc-leaf-boundary-refactor.v0.1.md.bak)。
- **v1.0（待用户签字后）**：去掉 DRAFT 状态、锁定 commit 主题、commit footer `Plan: .omo/plans/rsc-leaf-boundary-refactor.md`。~~（生效 → 见下一条）~~
- **FINAL v1.0（2026-09-11，本 commit 落地）**：
  - 用户授权（"ulw A、B、C 全部都用做"）；
  - 状态字段升级：标题 `DRAFT v0.2` → `FINAL v1.0`，Status 行同步，去掉「草稿阶段」段；
  - Step 1 / T1 checkbox 标记完成（实际签字在本轮 prompt 内）；
  - 全部 commit 已合入 main（HEAD = `c4a2630` + 本 v1.0 commit），5 个 worker 分支 + 5 个 worktree 物理目录（5.9 GB）已收尾清理；
  - Plan footer `Plan: .omo/plans/rsc-leaf-boundary-refactor.md` 由 5 个 impl commits + 1 docs commit + 1 chore(lint) commit 实际引用（git log --grep "Plan:"）；
  - 备份保留：`.omo/plans/rsc-leaf-boundary-refactor.v0.1.md.bak`。
