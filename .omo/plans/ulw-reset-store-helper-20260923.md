# Plan: ulw-reset-store-helper

## Goal

票② 立票兑现：把 `components/**/*.test.tsx` 里散落的 `useGameStore.setState({...})` 重置块全部收敛到单一 `tests/helpers/reset-store.ts`，从而消除「store 加字段 → 12 处手抄块漏同步」漂移复发机制（含 outcomeError、roomName 的已知案例与 GameShell 的当前漂移）。每个测试文件以 `resetStore()` 单点替代完整重置块，保留各文件原有的 localStorage / sessionStorage / fetchSpy.mockClear / routerPush.mockClear 等额外清理的相对顺序与语义。

## Background（已调查，不再二验）

- `lib/store.ts:83` 的 `GameState` 接口声明 8 字段：`phase`、`mode`、`board`、`currentPlayer`、`winner`、`winLine`、`roomName`、`outcomeError`（W-F 案② c 引入）。
- `lib/store.ts:140-149` 的 `initial` 常量是默认值真源。resetStore 必须把全部 8 字段显式写出 + 调 `__resetInternalForTests()` 清 module-level `internalStats` 缓存——这是唯一覆盖完整状态的契约。
- 票面已点 10 处 reset 块 + 「rg 同构重置块一并迁移」指令；rg 复核结果显示 components 下共 **15 处** reset 块（13 文件），按票面「宁可少动不可错动」逐处核对后全部纳入。
- baseline `c50532a`：`pnpm vitest run` 39 文件 / 494 用例全绿（已运行验证）。

## 决策（已记录，不重开）

1. **helper 文件位置**：`tests/helpers/reset-store.ts`。理由：
   - 票面建议位；
   - `@/*` 路径别名已配 (`tsconfig.json` + `vitest.config.ts`)，`@/tests/helpers/reset-store` 直达；
   - 不动 `tests/store/*`（票面负面清单）；该目录下 `store.test.ts` / `store.mutation.test.ts` 自带的私有 `resetStore()` 保留不迁，原因是票面明确「票面外」+ 它们各自需要 `vi.mock`/`afterEach` 上下文，与组件测试的 reset 用途不同。
2. **helper 形状**：
   ```ts
   export function resetStore(): void {
     useGameStore.setState({
       phase: 'idle',
       mode: 'online',
       board: createEmptyBoard(),
       currentPlayer: null,
       winner: null,
       winLine: null,
       roomName: null,
       outcomeError: null,
     });
     useGameStore.getState().__resetInternalForTests();
   }
   ```
   与 `tests/store/store.test.ts:46-58` 私有 resetStore 同款；额外加 `outcomeError: null`（覆盖 W-F 案② c 的现有值）。`mode: 'online'` 与 initial 一致，迁移 GameShell（当前 `mode` 字段缺失）后自动修。
3. **不抽 `__resetInternalForTests` 之外的清理**：localStorage / sessionStorage / fetchSpy.mockClear / routerPush.mockClear 等保留在调用方 beforeEach/afterEach 里——这些清理与 resetStore 的 store 状态正交，混入会污染边界。

## Scope（in）

### A. 新建 helper
1. `tests/helpers/reset-store.ts` —— 导出 `resetStore()` 函数（具体实现见上）。

### B. 迁移重置块（13 文件 / 15 处 reset 块）

每个迁移点都按「替换 setState 块 + 替换紧随其后的 `__resetInternalForTests()` 单调用 → 调 `resetStore()`」，**其余周边清理代码原样保留，顺序不动**。

| # | 文件 | 行（基线参考） | 周边清理代码（保留不动） |
| - | - | - | - |
| 1 | `components/HomeStatsEntry.test.tsx` | afterEach L18-35 | `cleanup()` + `window.localStorage.clear()` |
| 2 | `components/OfflineStatsPanel.test.tsx` | afterEach L33-44 | `cleanup()` + `localStorage.clear()` + `refreshMock.mockClear()` |
| 3 | `components/ResultCelebration.test.tsx` | beforeEach L36-59 | `window.sessionStorage.clear()` + `cleanup()` + 其他 |
| 4 | `components/OnlineGateMount.test.tsx` | beforeEach L43-61 | `__resetInternalForTests()` 后 `routerPush.mockClear()` |
| 5 | `components/ResultNavigator.test.tsx` | beforeEach L19-34 | `__resetInternalForTests()` 后 `routerPush.mockClear()` |
| 6 | `components/RoomGateMount.test.tsx` | beforeEach L49-67 | `__resetInternalForTests()` + `routerPush.mockClear()` |
| 7 | `components/RoomGateMount.test.tsx` | beforeEach L184-202（嵌套 describe） | `__resetInternalForTests()` + `routerPush.mockClear()` + `render()` |
| 8 | `components/StartGameButton.test.tsx` | beforeEach L50-67 | 无额外清理 |
| 9 | `components/WinConfetti.test.tsx` | beforeEach L18-33 | `__resetInternalForTests()` 后无其他 |
| 10 | `components/GameShell.test.tsx` | afterEach L6-9（**当前最严重漂移**：缺 mode/board/winLine/roomName/outcomeError） | `cleanup()` |
| 11 | `components/Board.test.tsx` | beforeEach L33-43 | `__resetInternalForTests()` 后无其他 |
| 12 | `components/RestartButton.test.tsx` | afterEach L22-36 | `cleanup()` + `__resetInternalForTests()` |
| 13 | `components/HomeDialogMount.test.tsx` | beforeEach L36-56（顶层） | `navState.pathname='/'` + `localStorage.clear()` + `sessionStorage.clear()` + `fetchSpy.mockClear()` + `__resetInternalForTests()` |
| 14 | `components/HomeDialogMount.test.tsx` | beforeEach L249-267（嵌套 describe handleConfirm） | `localStorage.clear()` + `sessionStorage.clear()` + `fetchSpy.mockClear()` + `__resetInternalForTests()` |
| 15 | `components/PlayController.test.tsx` | beforeEach L8-24 | `__resetInternalForTests()` 后无其他 |

> 注：Board.test.tsx / RestartButton.test.tsx 当前用 `createEmptyBoard()` / 字面 9×null 数组，迁移后统一走 `resetStore()` 内的 `createEmptyBoard()`。语义等价。

### C. 不迁移的特定 setter（按「宁可少动不可错动」）

- `HomeStatsEntry.test.tsx:39,54` —— 仅设 `roomName` 单字段
- `ResetStatsButton.test.tsx:44,68` —— 仅设 `mode` 单字段（票面提的「如 ResetStatsButton」是误指，实际该文件无 reset 块）
- `OfflineStatsPanel.test.tsx:48`（loginAs）、`:105`、`:123` —— 单一字段 setter
- `ResultCelebration.test.tsx:22`（setWon helper）—— 设特定 won 状态
- `OnlineGateMount.test.tsx:91` —— 仅设 `roomName`
- `ResultNavigator.test.tsx` 全文件 30+ 处 —— 全部是 test body 内的特定状态 setter
- `RoomGateMount.test.tsx:98`、`StartGameButton.test.tsx:95` —— 仅设 `roomName`
- `WinConfetti.test.tsx:37,44,62,71,76,80,86,89,92,98` —— 全部是 test body 内 phase/board 状态 setter
- `Board.test.tsx:13`（setPlaying helper）、`:214`、`:241` —— 特定 setter
- `RestartButton.test.tsx:9`（beforeEach 设 playing 状态）—— 特定 setter
- `HomeDialogMount.test.tsx` 顶层 setState 调用（除 reset 块外）
- `PlayController.test.tsx:45,54,67,86,107,126,146,152,170,185,194,210` —— 全部特定 setter

## Scope OUT（Must-NOT-Have）

- 不改 `lib/store.ts`。
- 不改 `tests/store/store.test.ts` / `tests/store/store.mutation.test.ts`（票面负面清单）。
- 不改 `tests/qa/*`、`lib/view-transition.test.ts`、`components/ui/Alert.test.tsx`（票面负面清单）。
- 不重构测试断言、不动 vitest 配置、不动 ESLint 配置。
- 不引新依赖、不改 package.json。
- 不跑 `pnpm next build` / `pnpm next start` / 浏览器探针（票面明示「本波无产品码变更」）。
- 不 `--no-verify` 绕过 commit-msg hook。
- 不 push、不合并不动主检出 `/Users/onepisya/.hermes/skills/job-hunter/portfolio/tic-tac-toe`。

## Tier

**LIGHT**。理由：
- 单点 helper 抽取 + 已知模式复制（手抄块 → helper 调），无开放设计决策。
- 失败重置在所有 13 个文件里等价，blast radius 受限。
- 不涉及 security / auth / 并发 / DB schema。
- evidence 通道：vitest（纯组件测试）+ ripgrep（reset 块收敛）+ typecheck + lint。
- 无 reviewer loop（票面交付到分支即止，主控统一合并与交叉审）。

## Files Touched（预期 `git diff main..HEAD --name-only`）

- `tests/helpers/reset-store.ts`（**新增**）
- `components/HomeStatsEntry.test.tsx`
- `components/OfflineStatsPanel.test.tsx`
- `components/ResultCelebration.test.tsx`
- `components/OnlineGateMount.test.tsx`
- `components/ResultNavigator.test.tsx`
- `components/RoomGateMount.test.tsx`
- `components/StartGameButton.test.tsx`
- `components/WinConfetti.test.tsx`
- `components/GameShell.test.tsx`
- `components/Board.test.tsx`
- `components/RestartButton.test.tsx`
- `components/HomeDialogMount.test.tsx`
- `components/PlayController.test.tsx`
- `.omo/plans/ulw-reset-store-helper-20260923.md`（本 plan）

**合计 14 文件 + 1 plan = 15 文件**。零产品码改动。

## Acceptance Criteria

| ID | Criterion | Verify by |
| - | - | - |
| AC-1 | `pnpm vitest run` 全绿，用例总数 = **494**（与基线 c50532a 相等，不减少） | exit 0 + 「Tests 494 passed」 |
| AC-2 | `rg -n 'useGameStore\.setState\(\{' components` 在迁移后**只命中特定 setter**（非 reset 块）+ 票面列举的 15 个迁移位点 0 处 reset 块残留 | ripgrep 输出对比 |
| AC-3 | `git diff main..HEAD --name-only` 仅含上述 13 个 components/*.test.tsx + 1 个 helper 文件 + 1 个 plan = 15 文件（无 `lib/`、`app/`、`db/`、其他 `tests/` 文件） | command 输出逐行核对 |
| AC-4 | `pnpm typecheck` exit 0 | command exit 0 |
| AC-5 | `pnpm lint` exit 0 | command exit 0 |
| AC-6 | `git log -1` 显示单 commit：subject `refactor(tests): resetStore 统一 helper（迁移 15 处重置块）`、body 三段（WHAT/WHY/HOW）、trailer 含 Constraint/Rejected/Confidence/Scope-risk/Directive/Tested、footer `Plan: .omo/plans/ulw-reset-store-helper-20260923.md`；commit-msg hook 通过 | `git show HEAD` 完整可见 |
| AC-7 | `tests/helpers/reset-store.ts` 单文件存在，导出 `resetStore` 函数，且 setState 块包含全部 8 字段 + `__resetInternalForTests()` 调用 | `cat tests/helpers/reset-store.ts` + `rg -n "outcomeError: null" tests/helpers/reset-store.ts` |

## Todos

- [ ] 1. `tests/helpers/reset-store.ts: 新建导出 resetStore() 函数（8 字段 + __resetInternalForTests）` — verify by `cat tests/helpers/reset-store.ts` 显示完整函数体 + `rg -n "outcomeError: null" tests/helpers/reset-store.ts` 命中
- [ ] 2. `components/HomeStatsEntry.test.tsx: 替换 afterEach 内的 setState 重置块 + __resetInternalForTests 调用 → resetStore()` — verify by `rg -n "useGameStore\.setState\(\{" components/HomeStatsEntry.test.tsx` 0 命中 + vitest PASS
- [ ] 3. `components/OfflineStatsPanel.test.tsx: 替换 afterEach reset 块 → resetStore()` — verify by 同上 + 保留 `cleanup()/localStorage.clear()/refreshMock.mockClear()`
- [ ] 4. `components/ResultCelebration.test.tsx: 替换 beforeEach reset 块 → resetStore()` — verify by 同上
- [ ] 5. `components/OnlineGateMount.test.tsx: 替换 beforeEach reset 块 → resetStore()` — verify by 同上 + 保留 `routerPush.mockClear()`
- [ ] 6. `components/ResultNavigator.test.tsx: 替换 beforeEach reset 块 → resetStore()` — verify by 同上
- [ ] 7. `components/RoomGateMount.test.tsx: 替换两处 beforeEach reset 块 → resetStore()` — verify by `rg -n "useGameStore\.setState\(\{" components/RoomGateMount.test.tsx` 仅留 helper 之外的特定 setter（`:98`）
- [ ] 8. `components/StartGameButton.test.tsx: 替换 beforeEach reset 块 → resetStore()` — verify by 同上
- [ ] 9. `components/WinConfetti.test.tsx: 替换 beforeEach reset 块 → resetStore()` — verify by 同上
- [ ] 10. `components/GameShell.test.tsx: 替换 afterEach 三字段残缺 reset → resetStore()`（修复最严重漂移） — verify by 同上
- [ ] 11. `components/Board.test.tsx: 替换 beforeEach reset 块 → resetStore()` — verify by 同上
- [ ] 12. `components/RestartButton.test.tsx: 替换 afterEach reset 块 → resetStore()` — verify by 同上
- [ ] 13. `components/HomeDialogMount.test.tsx: 替换两处 beforeEach reset 块 → resetStore()` — verify by 同上 + 保留 navState/localStorage/sessionStorage/fetchSpy.mockClear 顺序
- [ ] 14. `components/PlayController.test.tsx: 替换 beforeEach reset 块 → resetStore()` — verify by 同上
- [ ] F1. 最终验证波：跑 `pnpm vitest run` + `pnpm typecheck` + `pnpm lint` + `git diff main..HEAD --name-only` + `tests/qa/commit-audit.mjs` 并把 AC-1~7 PASS/FAIL 记到 notepad。
- [ ] F2. 落 commit：`refactor(tests): resetStore 统一 helper（迁移 15 处重置块）` + 三段 body + 6 项 trailer + `Plan: .omo/plans/ulw-reset-store-helper-20260923.md` footer；commit-msg hook 通过；无 `--no-verify`。

## Commit

- type: `refactor`
- scope: `tests`
- subject: `refactor(tests): resetStore 统一 helper（迁移 15 处重置块）`
- WHAT body: 逐文件列改动 + 新 helper 文件
- WHY body: 复发机制 + outcomeError / roomName / GameShell 漂移案例
- HOW body: helper 形状 + 「不抽 __resetInternalForTests 之外清理」的边界
- lore trailer: Constraint / Rejected / Confidence / Scope-risk / Directive / Tested
- footer: `Plan: .omo/plans/ulw-reset-store-helper-20260923.md`

## Stop condition

I'll stop right away when AC-1 through AC-7 all PASS with captured evidence in the notepad, the single commit lands with the trailer intact, and the final reply carries the plan path, commit SHA, AC-1~7 one-line table, and the helper file path. 不 push、不 merge、不碰主检出。
