# Plan: ulw-reset-store-outcome-error

## 目标

修复测试隔离缺陷：测试套件里三处手抄的 `resetStore` 路径没有清掉
`outcomeError` 字段（该字段在 commit 667b9ea 加入）。不修的话，未来读取
store shape 或渲染 `OutcomeErrorBanner` 的测试会观察到上一个测试遗留的陈
旧状态。

## 背景（已裁决，不再调研）

- `lib/store.ts` GameState（line 83）声明 `outcomeError: { reason: string;
  at: number } | null`。line 148 初值 `outcomeError: null`。生产路径转
  换在 new-game / restart（lines 308、411）清零，通过 `setOutcomeError`
  （line 464）写入。
- Zustand `setState` 是 merge 语义：没列的字段会保留。测试里三处手抄
  `resetStore` 都漏了 `outcomeError`，所以「先 `setOutcomeError(...)` 再
  `resetStore()`」的测试会把值泄给下一个测试。
- 当前泄库是潜在缺陷（还没有测试渲染 `OutcomeErrorBanner` 或在 reset
  后断言 store shape），但下一个这样的测试会神秘挂掉。根因是「三处手抄
  copy」的隐性不变量在加字段时悄悄破坏。

## 范围（in）

1. 在下列三处 `useGameStore.setState({...})` 调用里加 `outcomeError:
   null`：
   - `tests/store/store.test.ts` 的 `function resetStore()`（lines
     46-57）。
   - `components/HomeDialogMount.test.tsx` 的 `beforeEach(...)` 块里
     `useGameStore.setState({...})` 调用（lines 41-49）。其他清理步
     骤顺序保持（localStorage.clear / sessionStorage.clear /
     fetchSpy.mockClear 仍在前面；`__resetInternalForTests` 仍在后
     面）。
   - `components/OnlineGateMount.test.tsx` 的 `function resetStore()`
     （lines 44-54）。顺序保持（setState → `__resetInternalForTests` →
     `routerPush.mockClear()`）。
2. 在 `tests/store/store.test.ts` 加一条回归测试，命名
   `'resetStore clears outcomeError so subsequent tests do not see a
   stale banner'`：
   - 通过 `setOutcomeError({ reason: 'aborted', at: Date.now() })` 写
     入；
   - 测试中段断言 `outcomeError !== null`；
   - 调用 `resetStore()`；
   - 断言 `useGameStore.getState().outcomeError === null`。
3. 一个原子提交。

## 范围外（Must-NOT-Have）

- 不动 `lib/store.ts` 或任何生产代码。
- 不动其他测试文件（`tests/qa/*`、view-transition、Alert 等）。
- 不跑 `pnpm build` 或 `pnpm dev`（vitest 不需要；tier 是 LIGHT）。
- 不重写无关断言或改测试顺序。
- 不改现有 reset 路径的签名（不加参数、不抽 helper 文件）。
- 不在 commit 上加 `--no-verify`。
- 本提交不抽 `tests/helpers/resetStore.ts` 共享 helper。理由见下方决
  策。

## 决策：直接改 vs. 共享 helper

选 **直接改**（三处各加一行 + 1 条回归测试）。理由：

- 修复分支最低表面风险，保留每个测试文件现有 reset 顺序（HomeDialogMount
  的 beforeEach 交错 localStorage / sessionStorage / fetchSpy.mockClear；
  OnlineGateMount 的 resetStore 末尾是 routerPush.mockClear()）。抽
  helper 会强迫重排这些交错——正是引入下一次回归的那种偶然语义改动。
- DRY 收益只有一行/文件；防缺陷收益（强制新字段走单一入口）真实但与
  本任务正交，更适合作为下次字段新增时的独立变更。
- 任务原文允许两种选择：「保守起见也可以只做第 1、2 条」。本提交就是保
  守解读。

helper 抽取不删除——若一个季度内又加 store 字段且同类缺陷复发，那就
是下一次修复分支。

## Tier

**LIGHT**。单点 bugfix：pattern 已知（Zustand reset）、无开放设计决策、
blast radius 仅限三个测试文件加一条新测试。证据通道：vitest 输出（无
浏览器表面——纯 store-state 契约）。自检写入 notepad；不跑 reviewer
loop。

## 改动文件（expected `git diff dev..HEAD --name-only`）

- `tests/store/store.test.ts`（改 resetStore + 加 1 条测试）
- `components/HomeDialogMount.test.tsx`（改 beforeEach）
- `components/OnlineGateMount.test.tsx`（改 resetStore）
- `.omo/plans/ulw-reset-store-outcome-error.md`（本 plan）

## 验收标准

| ID | Criterion | Verify by |
| --- | --- | --- |
| AC-1 | `rg -n "outcomeError: null" tests/store/store.test.ts components/HomeDialogMount.test.tsx components/OnlineGateMount.test.tsx` 在三个文件里共返回 ≥3 条命中 | ripgrep exit 0 + 每文件 ≥1 hit |
| AC-2 | `tests/store/store.test.ts` 至少新增一条测试，名字同时含 `outcomeError` 与 reset 语义，断言 `useGameStore.getState().outcomeError === null` 在 `resetStore()` 之后 | vitest 输出新测试 PASS |
| AC-3 | `pnpm vitest run` 全绿（≥479 tests） | exit 0，"Tests" 汇总行完整，无失败 / 本轮新增 skip |
| AC-4 | `git diff dev..HEAD --name-only` 严格等于上面四个文件（无生产码、无其他测试改动） | 命令输出与期望文件列表逐字节一致 |
| AC-5 | `pnpm typecheck` 与 `pnpm lint` 全绿 | 各命令 exit 0 |
| AC-6 | 一个原子提交，subject ≤100 字符、type 前缀、lore trailer、Plan footer；无 `--no-verify` | `git log -1` + `git show HEAD` 含 trailer；`tests/qa/commit-audit.mjs` exit 0 |

## Todos

- [ ] 1. `tests/store/store.test.ts: 在 resetStore() 的 setState 块里加 outcomeError: null` — verify by `rg -n "outcomeError: null" tests/store/store.test.ts` 命中函数体内。
- [ ] 2. `components/HomeDialogMount.test.tsx: 在 beforeEach 的 setState 块加 outcomeError: null（保留 localStorage.clear / sessionStorage.clear / fetchSpy.mockClear 在前；__resetInternalForTests 在后）` — verify by `rg -n "outcomeError: null" components/HomeDialogMount.test.tsx` 命中 beforeEach。
- [ ] 3. `components/OnlineGateMount.test.tsx: 在 resetStore() 的 setState 块加 outcomeError: null（保留 __resetInternalForTests 与 routerPush.mockClear 顺序）` — verify by `rg -n "outcomeError: null" components/OnlineGateMount.test.tsx` 命中函数体。
- [ ] 4. `tests/store/store.test.ts: 加回归测试 'resetStore clears outcomeError so subsequent tests do not see a stale banner'，写入 → 断言非空 → 调 resetStore → 断言空` — verify by vitest 输出新测试 PASS 且 `rg -n "outcomeError" tests/store/store.test.ts` 见新用例。
- [ ] F1. 终验波次：跑 `pnpm vitest run` + `pnpm typecheck` + `pnpm lint` + `git diff dev..HEAD --name-only` + `tests/qa/commit-audit.mjs`，把 AC-1~6 的 PASS/FAIL 入 notepad。

## Commit

- type: `test`
- scope: `store`
- subject: `test(store): resetStore clears outcomeError (leak regression)`
- lore trailer: Constraint / Rejected / Confidence / Scope-risk / Directive / Tested
- footer: `Plan: .omo/plans/ulw-reset-store-outcome-error.md`

## 停止条件

我会立刻停当：AC-1~6 全部 PASS 并把证据入 notepad，原子提交落地，最后
回复带 plan 路径、commit SHA、AC-1~6 一行表，以及直接改决策说明。
