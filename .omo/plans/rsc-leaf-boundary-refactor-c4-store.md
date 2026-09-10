# Sub-plan: C4 — store.stats 解耦，RSC 拥有 stats 所有权

> Master plan: [`.omo/plans/rsc-leaf-boundary-refactor.md`](/private/tmp/tic-tac-toe/.omo/plans/rsc-leaf-boundary-refactor.md)
> 分支: `refactor/rsc-c4-store`
> 服务于串行子代理 #5（C1–C3 + C5 全部合入后才启动）
> 工作量估算：M–L（store 行为变化 + 跨 4 调用方 + Stryker + coverage on-demand）

## Intent

从 `useGameStore` 删除 `stats` 字段 + `hydrateStats` action。`stats` 数据完全由 RSC 通过 `await loadStats()` 拿，通过 props 传给 `<StatsGrid>`。

## 为什么

- C1–C3 已经把 3 个 page 都改 RSC，每个 page 都用 `await loadStats()` 拿 stats 并通过 props 传给 `<StatsGrid>`。此时 store 的 `stats` 字段已无任何展示方读取。
- 保留 store.stats 的代价：①client 模块加载时 hydrateStats → `/api/stats` GET（多余请求）；②hydration 后 set state 触发一次 render（flicker）；③store 类型里仍含 stats，调用方容易误用。
- 删除后，store 只管 board / phase（client-side 状态），stats 是 RSC-only 数据。架构边界清晰。

## 前置依赖

- C1 / C2 / C3 全部合入 main。
- C5 docs 同步也建议 C4 后做（C5 描述最终架构）。

## File changes

### 1. `lib/store.ts`（关键改动）

**当前**（简版，从现状摘）：
```ts
export interface GameState {
  phase: GamePhase;
  board: Board;
  currentPlayer: Player | null;
  winner: Player | null;
  winLine: readonly [number, number, number] | null;
  stats: GameStats;                        // ← 删除
  lastOutcome: 'X' | 'O' | 'draw' | null;
}

export interface GameActions {
  startGame: () => void;
  makeMove: (index: number) => void;
  restart: () => void;
  resetAll: () => void;
  hydrateStats: () => void;                // ← 删除
}

const initial: GameState = {
  // ...
  stats: emptyStats(),                     // ← 删除
  // ...
};

// hydrateStats 函数体删除

// useGameStore 的 resetAll 不再 set stats 字段（只调用 apiDeleteStats + set({...})）
```

**改后**：
```ts
export interface GameState {
  phase: GamePhase;
  board: Board;
  currentPlayer: Player | null;
  winner: Player | null;
  winLine: readonly [number, number, number] | null;
  lastOutcome: 'X' | 'O' | 'draw' | null;
}

export interface GameActions {
  startGame: () => void;
  makeMove: (index: number) => void;
  restart: () => void;
  resetAll: () => void;
}

const initial: GameState = {
  phase: 'idle',
  board: createEmptyBoard(),
  currentPlayer: null,
  winner: null,
  winLine: null,
  lastOutcome: null,
};

// hydrateStats 整个函数体删除

// resetAll 仍调用 apiDeleteStats() 返回最新 stats，但本地不存 stats 字段
//   如果 resetAll 写回需要 stats，可以 set({lastOutcome: null}) 不动 stats
```

**Store action 细节**：
- `resetAll()`：保持行为（调用 apiDeleteStats → set 状态），但 set 时不写 stats 字段。GET 返回的 stats 被丢弃。
- `recordOutcome` 内逻辑（stats 写回）：如果 store 不持有 stats，则由 page 级 RSC 在 action 完成后用 `router.refresh()` 重新拉一次 stats；或者在 resetAll 完成后用 `window.location.reload()`。
  - 选项 A：`router.refresh()` —— Next App Router 内置，重新执行 RSC tree。✅ 推荐。
  - 选项 B：`window.location.reload()` —— 硬刷新，UX 重。
- `applyMove` 内的 stats 写回：同理，触发 `router.refresh()`。

### 2. 三个 page 文件（需要更新调用模式）

C1–C3 已经让 page 用 `await loadStats()` 拿 stats。本步骤要确保：resetAll / recordOutcome 完成后，RSC tree 重渲染，page 重新 `await loadStats()` 拿到新值。

**具体改法**：
- `<ResetStatsButton>`（C1 新增） / `<ResultActions>`（C3 新增）的 `resetAll` onClick：在 store 的 resetAll 完成后调用 `router.refresh()`。
- `useGameStore` 的 `applyMove` 内部：调用 apiPutStats 完成后也调 `router.refresh()`。

**或者更简洁**：在 `<ResetStatsButton>` / `<ResultActions>` 内 try/catch store action，成功后调 `router.refresh()`。store 不感知 router。

### 3. `components/ResultState.tsx` / `PlayController.tsx`（C2 / C3 新增）

需要 import `useRouter` 来支持 refresh。这是这两组件本来就在 client 端，多 import 一个 hook 无成本。

### 4. 不改动的文件

- `lib/game.ts`（纯规则）
- `lib/db.ts`（loadStats 签名不变）
- `db/schema.ts`
- `components/Board.tsx` / `Cell.tsx` / `Confetti.tsx` / `SoundToggle.tsx` / `ServiceWorkerRegister.tsx`
- `components/ui/*.tsx`
- `app/api/stats/route.ts`（保留）

## Acceptance criteria

- `useGameStore` 类型上不再有 `stats` 字段 / `hydrateStats` action。
- `lib/store.ts` 内不再 import `apiGetStats`（GET 路径移除；PUT/DELETE 保留）。
- `pnpm vitest run` 中所有 store 单测通过；如有旧测试断言 `stats` 字段，改为断言"调用了 PUT/DELETE"。
- Stryker mutation 在 `lib/store.ts` 上得分 ≥ 84.50% 基线。
- vitest coverage 在 `lib/store.ts` 上 ≥ 80% lines / 80% branches。
- 三个 page 都能在 resetAll / 完整对局后看到战绩更新（通过 router.refresh）。

## Verification（6 层 Gauntlet + on-demand 子集）

```bash
pnpm typecheck
pnpm lint
pnpm vitest run
pnpm build
node tests/qa/commit-audit.mjs --branch main
pnpm vitest run --coverage    # on-demand: scope 命中 lib/**
pnpm test:mutation            # on-demand: scope 命中 lib/store.ts

pnpm start &
SERVER_PID=$!
sleep 5
node tests/qa/visual-qa.mjs
node tests/qa/hydration-check.mjs
node tests/qa/win-flow.mjs
node tests/qa/keyboard-roving.mjs
node tests/qa/audio-probe.mjs
node tests/qa/confetti-probe.mjs
node tests/qa/audio-confetti-qa.mjs
kill $SERVER_PID
```

**手动 smoke**：
- 完整对局一次（赢 → /result → 看战绩是否更新）
- resetAll 一次（home 或 result 页面 → 看战绩是否归零）

## Evidence 产物

落到 `.omx/evidence/rsc-leaf-boundary-refactor/c4/`：
- `build.log` / `vitest.log` / `typecheck.log` / `lint.log` / `commit-audit.log`
- `coverage/`（v8 html + json）
- `mutation/`（Stryker html report + mutants.json）
- `visual-qa/qa-log.json` + `visual-qa/*.png`
- `hydration-check.log` / `win-flow.log` / `keyboard-roving.log` / `audio-probe.log` / `confetti-probe.log` / `audio-confetti-qa.log`
- `manual-reset-flow.txt`（手动 resetAll 后战绩归零的截图记录）

## Commit 模板

```
refactor(store): decouple stats from zustand; RSC owns stats fetch

WHAT: useGameStore 删除 stats 字段 + hydrateStats action；resetAll / recordOutcome 完成后由 router.refresh() 触发 RSC 重新拉 stats。

WHY: C1–C3 已经让 3 个 page 用 await loadStats() 拿 stats 并通过 props 传给 StatsGrid；store.stats 字段已无展示方读取。删除后 store 只管 board/phase（client state），stats 是 RSC-only，架构边界清晰。

HOW: useGameStore 类型删除 stats + hydrateStats；resetAll / applyMove 内调用 apiPutStats / apiDeleteStats 成功后由 caller 触发 router.refresh()。resetAll 在 ResetStatsButton / ResultActions 内触发；applyMove 后续可在 Board 内或 store 内触发（待代码 review 决定）。

Constraint: 不动 lib/game.ts；不动 lib/db.ts；不动 db/schema.ts；不动 api/stats 路由；不引入新依赖
Rejected: (1) 在 store 内感知 useRouter — store 应保持 framework-agnostic；(2) window.location.reload() — UX 重且不必要
Confidence: 中（Stryker mutation 需要对比 baseline；router.refresh 时序需要手动验证）
Scope-risk: 中-高（跨 4 调用方 + Stryker target + coverage on-demand）
Directive: 6 层 Gauntlet + coverage + Stryker + 全 6 个 browser QA 探针
Tested: typecheck/lint/vitest/build/commit-audit/coverage(≥80%)/mutation(≥84.50%)/visual-qa/hydration-check/win-flow/keyboard-roving/audio-probe/confetti-probe/audio-confetti-qa
Not-tested: Vercel prod 真实 LCP — 本地 pnpm start 不等于 prod 网络

Plan: .omo/plans/rsc-leaf-boundary-refactor.md
Sub-plan: .omo/plans/rsc-leaf-boundary-refactor-c4-store.md
```

## 必须 Not have

- 不引入新 npm 依赖。
- 不修改 `lib/game.ts` / `lib/db.ts` / `db/schema.ts` / `app/api/stats/route.ts`。
- 不修改 `<Board>` / `<Cell>` / `<Confetti>` / `<SoundToggle>` 内部实现（签名允许扩展但不改语义）。
- 不使用 `git commit --no-verify`。

## 上线检查清单（C5 docs 同步时引用）

- [ ] 6 层 Gauntlet 全 PASS
- [ ] Coverage ≥ 80/80/70/80（lib/store.ts scope）
- [ ] Mutation ≥ 84.50%（lib/store.ts scope）
- [ ] 所有 browser QA 探针 PASS
- [ ] 手动 resetAll 流程验证

