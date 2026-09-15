# RA Review · commit `4f5ec71` (solo mode split)

- **Reviewer**: RA (read-only, fresh codex session)
- **Date**: 2026-09-15
- **Scope**: `git show 4f5ec71` + current `lib/store.ts`, `lib/solo-stats.ts`, `tests/store/store.test.ts`
- **Contracts**: `lib/AGENTS.md` + `.omo/plans/ulw-solo-mode-split-view-transitions.md` §3.2
- **Posture**: read-only, no source edits, no commit
- **Verdict**: **PASS — 7 账 (no 修, no 疵)** — 4f5ec71's ranked contract is byte-equivalent to `51f164c`; solo contract is well-fenced with SSR/exception guards; the open items are 3 contract-document gaps (F-3.1 / F-5.1 / F-CROSS-3), 2 shape-loose edges (F-2.1 / F-2.2, no real pollution), and 2 untested paths (F-CROSS-1 cross-mode, F-CROSS-2 privacy-mode throw).

---

## 0. Teach-back (scope & format)

**Scope**:

1. Full diff of `4f5ec71` (`git show 4f5ec71 -- lib/store.ts lib/solo-stats.ts tests/store/store.test.ts components/StartGameButton.tsx components/ResultActions.tsx`).
2. Current state of `lib/store.ts` (== 4f5ec71; `git log 4f5ec71..main -- lib/store.ts lib/solo-stats.ts` shows no further edits), `lib/solo-stats.ts`, `tests/store/store.test.ts`.
3. `lib/AGENTS.md` contract entries (solo-stats row: "load/persist/clear；window 守卫 + shape 校验（非法即 emptyStats）").
4. `.omo/plans/ulw-solo-mode-split-view-transitions.md` §3.2 decisions (mode field on singleton, localStorage, recordOutcome reuse, inline ResultBanner, BoardGrid extraction, VT independent).

**Out of scope** (downstream, noted for record only): `c65d876` (PlayController mode prop), `2b79d14` (`/solo` route), `0bab68e`+`f45ddbf` (View Transitions), `a8a7063` (stats-race probe fix), `f8fd69e` (agents.md sync).

**Output format**: findings list (grade · file:line · issue · fix suggestion) + 6-point adversarial judgment table + tail count.

---

## 1. 六项对抗点判定表

| # | 对抗点 | 判定 | 一句话证据 |
|---|--------|------|------------|
| 1 | SSR 安全 (window 守卫 + 模块顶层 localStorage) | **PASS** | `lib/solo-stats.ts:32/49/59` 三函数全部 `typeof window === 'undefined'` 守卫；`lib/store.ts:1` `'use client'`；`loadSoloStats()` 仅在 `startGame('solo')` action 体内调用 (line 214)，无模块顶层读 |
| 2 | localStorage 异常面 (privacy mode / 坏 JSON / 错 shape / 原型污染) | **PASS** | `lib/solo-stats.ts:36-43` try/catch + `isGameStats` (line 15-25) 拦截坏 JSON/数组/缺字段/NaN/Infinity；`Number.isFinite` 拒绝非有限数；`__proto__` 经 JSON.parse 仅作数据属性，不触发原型 setter（recordOutcome 输出新对象，下一次写即丢额外字段）；**见 findings F-2.1 / F-2.2 两条 账** |
| 3 | internalStats 串台矩阵 (ranked↔solo) | **PASS w/ 1 账 (F-3.1)** | 6 个写入点全部审计；ranked→solo→ranked 序列下，短暂窗口 (startGame 切换模式到首次网络写) 内 internalStats 持有过期数据；无 UI 组件直读 internalStats（仅 `__getInternalForTests`），不可见影响 |
| 4 | ranked 零变化证明 | **PASS** | `git show 51f164c:lib/store.ts` ↔ `lib/store.ts` 逐 hunk 对照：solo 分支 `return;` 在 ranked 代码前插入，原 ranked 代码 byte-equivalent；`startGame(mode?)` 缺省 `?? 'ranked'` 等价旧行为；2 处 `onClick` 箭头包裹签名增参必要，无行为差 |
| 5 | resetSoloStats 语义 (不 stamp lastWriteAt / mode 不动 / reload 初值) | **PASS w/ 1 账 (F-5.1)** | `lib/store.ts:318-321` 三步：clearSoloStats + emptyStats + 不 stamp；语义与 plan §3.1 "solo 天然无 lastWriteAt" 一致；`restart()` (L307-317) 不动 mode；reload 后 store 初值 mode='ranked'，由 PlayController.autoStart `startGame(mode)` 矫正；唯一缺口：resetSoloStats 不守卫 mode |
| 6 | 并发 (solo 落局 async / 快速 restart / 双击同格) | **PASS** | solo 分支全程同步（L260-263 recordOutcome+persistSoloStats），无 await；zustand `set()` 同步；第二击读到 phase='won'，guard `s.phase !== 'playing'` (lib/store.ts:239) 提前 return；`ResetStatsButton` scope='local' (components/ResetStatsButton.tsx:38) → resetSoloStats + onCleared → SoloStatsPanel.refresh (components/SoloStatsPanel.tsx:29-31) 拉新 |

---

## 2. Findings 榜

| ID | 级别 | 文件:行 | 问题 | 修法建议 |
|----|------|---------|------|----------|
| **F-3.1** | **账** | `lib/store.ts:111` (`let internalStats`) | `internalStats` 同时承担两个语义：ranked 模式下镜像 server 行（setInitialStats L196 + apiRecordOutcome L271/L295），solo 模式下本地累加（L214/L260/L288/L320）。`startGame('ranked')` 不重新水合 internalStats → ranked→solo→ranked 序列下，第二次 `startGame('ranked')` 后到第一次网络写之间，缓存是过期 solo 数据。无 UI 组件直读 internalStats（仅 `__getInternalForTests`），用户不可见；测试 8（"ranked path unchanged"）只在干净状态断言。 | 在 `.omo/plans/` 补一节"internalStats dual-purpose cache"记录：1) 唯一消费者是测试 seam；2) UI 全走 RSC（StatsHydrator）或 localStorage（SoloStatsPanel），不读 internalStats；3) 切换模式触发 `setInitialStats(serverRow)` 重置或新增 `startGame(mode)` 内分支强制 reload。可选加固：`startGame('ranked')` 主动 `internalStats = __getInternalForTests()` 保持现状，但加注释"外部数据源是 server"。 |
| **F-5.1** | **账** | `lib/store.ts:318-321` (`resetSoloStats`) | 函数不守卫当前 mode。若在 ranked 上下文被调用，会用 `emptyStats()` 覆盖原 server 行镜像（StatsHydrator 刚写入的）。当前调用面只有 `ResetStatsButton scope='local'`（components/ResetStatsButton.tsx:38），该组件只被 `SoloStatsPanel` 渲染（components/SoloStatsPanel.tsx:43），所以无现网误用路径；但缺防御性检查。 | 函数首行加 `if (useGameStore.getState().mode !== 'solo') return;` 或文档化为"必须在 solo 模式调用"。`lib/AGENTS.md` 的"持久化触发点保持单源"已是合同一部分，建议在 resetSoloStats 上写明调用前置条件。 |
| **F-2.1** | **账** | `lib/solo-stats.ts:15-25` (`isGameStats`) | 形状校验接受**额外字段**：例如 `JSON.stringify({totalGames:1,...,"extra":"foo"})` 通过校验并被 `internalStats = parsed` 带入。后果：第一次 `recordOutcome` 输出新对象（lib/game.ts:102-118，纯函数 spread），额外字段丢弃 → 持久化路径自愈；运行时无功能影响，仅 contract 松。 | 把 `isGameStats` 改为"严格白名单"：`Object.keys(s).sort().join(',') === 'currentStreak,draws,oWins,totalGames,xWins'` 才接受。同步在 tests/store/store.test.ts 加一条"extra 字段拒绝"的回归断言（增到现有 728-739 的 edge case 块）。 |
| **F-2.2** | **账** | `lib/solo-stats.ts:15-25` (同上) | 原型污染：`JSON.parse('{"__proto__":{...},"totalGames":1,...}')` 因 JSON.parse 不触发 setter，仅产生 `__proto__` 数据属性；`isGameStats` 只读 5 字段故不踩；`internalStats = parsed` 携带该数据属性一次，recordOutcome 输出新对象即丢。**无真实原型链污染**。仅 contract/理论完整性缺口。 | 与 F-2.1 合并修：严格白名单直接拒绝额外键，包括 `__proto__`、`constructor`、`prototype`。 |
| **F-CROSS-1** | **账** | `tests/store/store.test.ts:743-783` (ranked 回归测试) | 测试 8 "ranked path unchanged" 仅验证干净状态（无 solo 数据）下 ranked 路径不动 localStorage；不验证 ranked→solo→ranked 或 solo→ranked→solo 切换序列下双模式仍正确。8 个新增 solo 测试也都在隔离状态。 | 补两条 cross-mode 用例：(a) solo 落局后 `internalStats=loadSoloStats` 仍正确，再 `startGame('ranked')` + makeMove → ranked 分支执行且 localStorage 不变；(b) ranked 落局后 `startGame('solo')` 重载 localStorage 基线而非沿用 server 行。 |
| **F-CROSS-2** | **账** | `tests/store/store.test.ts`（缺） | Privacy mode（`localStorage.setItem` 抛 `QuotaExceededError`/`SecurityError`）未被覆盖。`persistSoloStats` 的 catch (lib/solo-stats.ts:50-53) 静默吞错，测试未验证 in-memory 仍正确累积 + 后续 reload 仍恢复空值。 | 在 tests/store/store.test.ts 新增"privacy mode setItem throws → in-memory persists → reload reads emptyStats"用例：`vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError'); })`，验证 makeMove 不抛且 `__getInternalForTests` 反映已累加值；reload 后 `loadSoloStats()` = emptyStats。 |
| **F-CROSS-3** | **账** | `lib/store.ts:209-216` (`startGame`) + `components/PlayController.tsx:28-30` (后续 commit `c65d876` 引入) | 4f5ec71 在 makeMove 加 `if (s.mode === 'solo') return` 守卫（L259/L286）依赖 `mode` 正确反映当前游戏。PlayController autoStart（`if (phase === 'idle') startGame(mode)`）只在 idle 时启动；用户从 /play 中途软导航到 /solo（phase='playing'），PlayController 不调 startGame，**mode 维持 'ranked'，下一次 makeMove 走 ranked 分支发起网络写**——违反 "solo 全程零网络写"（plan §1.A1）。当前无 /play→/solo 直达 <Link>（app/play/page.tsx actions 槽只有"返回首页"+ RestartButton），所以未触网；但契约脆。 | 在 PlayController autoStart effect 加 `if (phase !== 'idle') restart()` 重置到 idle 后再 startGame(mode)；或在 startGame 内显式 set phase='idle' 再 set phase='playing'；或在 lib/store.ts 增加 `enterMode(mode)` action 显式切换 mode + phase='idle'，由 PlayController mount 调用一次。F8fd69e（agents.md 同步）若再触 solo-stats 路径，可一并修。 |

---

## 3. 上下文旁注（不计入 findings，仅记录）

- **commit `4f5ec71` 范围内 ranked 行为 byte-equivalent to `51f164c`**：通过 `git show 51f164c:lib/store.ts` ↔ `lib/store.ts` 逐行比对确认。solo 分支仅在 ranked 代码前 `return;`，ranked 代码块完全不动。
- **`recordOutcome` 是纯函数**：`lib/game.ts:102-118` 返回新对象，无 mutate 风险；solo 累加与 ranked server 端共享同一规则，符合 plan §3.2 "双模式规则单源"。
- **SSR 第一帧安全**：`lib/store.ts:1` 的 `'use client'` 让 `loadSoloStats()` 仅在客户端执行；`SoloStatsPanel`（components/SoloStatsPanel.tsx:29）SSR 时渲染 `emptyStats()`，mount 后 `useEffect` 才调 `loadSoloStats()`——与 sound.ts 先例一致。
- **`'use client'` 在 lib/store.ts** 是 Next.js 16 + React 19 模式下 store 引擎的正确边界；`'use client'` 文件可被 RSC 通过 client component 间接消费，但其模块本身不在 server bundle，模块顶层不执行（plan §3.2 "store 单实例"决策）。
- **`ResetStatsButton` scope='local' 的 onCleared 回调契约**（components/ResetStatsButton.tsx:21-25）：sync 路径无需 loading state，`onCleared` 立即触发；SoloStatsPanel 监听 → `refresh()` → `setStats(loadSoloStats())`（components/SoloStatsPanel.tsx:30-31）→ 立即清空显示。无 race。
- **mode 字段在 reload 后为 'ranked'**：用户首次到 /solo 时 store.mode='ranked'，但 PlayController mount 后 `startGame('solo')` 立即矫正。期间无 makeMove 调用（phase='idle' 守卫），无副作用。

---

## 4. 修法优先级建议

| 优先级 | 项 | 理由 |
|--------|----|----|
| P0 | F-CROSS-3 | 一旦未来加 /play→/solo 直达 Link 即破 "solo 零网络写" 合同（A1）；plan §1 验收项的核心 |
| P1 | F-2.1 + F-2.2 合并修 | 一次性把 isGameStats 改严格白名单 + 加测试；Stryker 主靶之一（lib/store.ts），收紧 shape 缩变异面积，与 commit message "Rejected: 容错函数内联 store.ts（Stryker 主靶... 缩变异面积）" 思路一致 |
| P2 | F-CROSS-1, F-CROSS-2 | 测试覆盖缺口，不阻塞合并；mutation 跑分时增加更稳的 regression 锚 |
| P3 | F-3.1, F-5.1 | 文档/contract 入档；在 .omo/plans/ulw-solo-mode-split-view-transitions.md §3.2 增补 "internalStats dual-purpose" 与 "resetSoloStats 调用前置" 两段 |

---

## 5. 计数

- **总 findings 数**：7（全部 账，无 修/疵）
- **修（blocking fix）**：0
- **账（design record / contract gap）**：7
  - F-2.1 shape 校验松（isGameStats 接受额外字段）
  - F-2.2 原型污染理论缺口（实际无害；JSON.parse 的 `__proto__` 仅数据属性，recordOutcome 输出新对象即丢）
  - F-3.1 internalStats dual-purpose cache 合同未入档
  - F-5.1 resetSoloStats 缺 mode 守卫（无现网误用，但无防御）
  - F-CROSS-1 跨模式序列未测试（ranked→solo→ranked 等）
  - F-CROSS-2 privacy mode setItem throws 未测试
  - F-CROSS-3 PlayController autoStart 不刷 mode（downstream hardening，4f5ec71 自身不触网，但未来加 /play→/solo 直达 Link 即破 A1 合同）
- **疵（defect）**：0
- **六项对抗点判定**：6/6 PASS（其中 3 项各带 1 条 账 跟进项：点 2 → F-2.1/F-2.2；点 3 → F-3.1；点 5 → F-5.1）
- **ranked 路径回归**：byte-equivalent to `51f164c`（逐 hunk 对照确认）
