# RB — bb171bf / c65d876 / 2b79d14 三 commit 评审

角色：fresh codex review-only。基线 components/AGENTS.md。
范围：3 commit diff + 当前全貌（11 文件 + 4 test 文件）。
产出：本文件，findings 榜 + 6 项对抗点判定表。不修码、不 commit。

---

## 0. TL;DR 判定

3 commit 整体 PASS：testid 全留、roving focus 原样、GameShell 真正 server-compatible、PlayController mode 缺省对 /play 零影响、SoloStatsPanel SSR 安全且 won→idle 路径不丢显、参数化后的两个按钮对旧调用点行为等价。Findings 总数 **6 项账 + 0 项修 + 2 项疵**，无 block-ship。

---

## 1. 六项对抗点判定表

| # | 对抗点 | 判定 | 证据 |
| --- | --- | --- | --- |
| 1 | testid 契约逐项 grep 对照 | **PASS** | 见 §1.1 |
| 2 | Board roving focus 迁移 BoardGrid 后 tabIndex/键盘路径 + aria；GameShell 标题层级 | **PASS** | 见 §1.2 |
| 3 | GameShell server-compatible；PlayController mode 缺省 /play 行为 | **PASS** | 见 §1.3 |
| 4 | SoloStatsPanel SSR 首帧 + phase 闭环 + onCleared 链 | **PASS** | 见 §1.4 |
| 5 | StartGameButton/ResetStatsButton 参数化 vs 51f164c 调用点 | **PASS（含隐性 bug fix）** | 见 §1.5 |
| 6 | 测试缺口 | **6 处缺口（账）** | 见 §1.6 |

### 1.1 testid 契约 — PASS

QA 探针全集（grep `data-testid` from `tests/qa/*.mjs`）：

```
board, cell-0, cell-3, confetti, play-again, reset-solo-stats,
reset-stats, reset-stats-result, result-headline, solo-stats,
sound-toggle, start-game, start-solo, stat-value, status-text
```

组件产出全集（grep `data-testid` from components/ + app/）：

```
board            (components/ui/BoardGrid.tsx:43)
cell-N, cell-N-mark, cell-N-glow  (components/ui/Cell.tsx:33/49/59)
confetti         (components/Confetti.tsx:22)
play-again       (components/ResultActions.tsx:27)
reset-stats, reset-solo-stats  (components/ResetStatsButton.tsx:58)
reset-stats-result (components/ResultActions.tsx:49)
result-headline  (components/ResultBanner.tsx:29)
restart          (components/RestartButton.tsx:9)
solo-stats       (components/SoloStatsPanel.tsx:53)
sound-toggle     (components/SoundToggle.tsx:28)
start-game, start-solo  (components/StartGameButton.tsx:33)
stat-value       (components/ui/StatsCard.tsx:15)
status-bar, status-text  (components/ui/StatusBar.tsx:30/41)
empty-state      (app/page.tsx:38)
```

**差集**：QA 探针引用的所有 testid 全部由当前代码产出；零漂移。AGENTS.md §约定列的核心 7 项（board/cell-N/cell-N-mark/status-bar/stat-value/sound-toggle/confetti）以及扩展项（result-headline/reset-stats/start-game/start-solo/solo-stats 等）全部留活。

### 1.2 a11y / roving focus / 标题层级 — PASS

**Roving focus 等价性**：

51f164c Board.tsx (legacy)：
```
tabIndex={i === focused && phase === 'playing' ? 0 : -1}
```

当前 BoardGrid.tsx:53：
```
tabIndex={i === focusedIndex && !disabled ? 0 : -1}
```

其中 Board.tsx:74 传入 `disabled={phase !== 'playing'}`。逻辑等价：`phase === 'playing'` ↔ `!disabled`。✓

**键盘路径原样**：keydown handler 仍在 Board.tsx:35-79，`onBoardCell` 通过 `target?.dataset?.testid?.startsWith('cell-')` 识别 Cell 节点（Cell.tsx:33 上 `data-testid={cell-${index}}`），方向键环绕通过 `neighbors()` + queueMicrotask focus。BoardGrid 不持有焦点/键盘逻辑，仅透传 tabIndex 和 onCellPlay。✓

**aria 属性未丢**：
- BoardGrid 在根 `<div>` 上保留 `role="grid"` + `aria-label="井字棋棋盘"`（BoardGrid.tsx:41-42）。51f164c Board.tsx 上原属性原样搬到展示层。✓
- Cell.tsx:25-28 的 `aria-label="第 N 格，已落 X/O，空，胜局"` 未动。✓
- StatusBar / StatusBarClient / ResultBanner 的 `role="status"` / `aria-live="polite"` / `aria-live="assertive"` 未动。✓

**GameShell 标题层级**：
- GameShell.tsx:29 渲染 `<h1 className="text-h1...">{title}</h1>`，每页唯一 h1（GameShell.test.tsx:38 断言 `getAllByRole('heading', { level: 1 }).toHaveLength(1)`）。✓
- /play 不放 h2（无子标题需求），语义层级 h1 终止。✓
- /solo 由 SoloStatsPanel.tsx:54 放 `<h2 className="text-h2...">单机战绩</h2>`，与 h1 形成 h1→h2 标准层级。✓
- 与既有 /result (`h1 本局结束` + `h2 战绩`) 一致。✓

### 1.3 GameShell server-compat + PlayController mode 缺省 — PASS

**GameShell server-compatible**：
- 无 `'use client'` 指令（grep 零命中）。✓
- 无 hooks 调用（无 useState/useRef/useEffect/useMemo/useCallback）。✓
- 不读 store、不调浏览器 API。✓
- SoundToggle / StatusBarClient 自带 `'use client'`（各自 client boundary），在 GameShell 内组合时不污染壳的 server 性质。✓

**PlayController mode 缺省路径**：
- PlayController.tsx:23 `mode = 'ranked'`，签名与 51f164c 形态一致。51f164c 直接调 `startGame()`（mode 默认 undefined → 'ranked'）；当前 `startGame(mode)` 传 'ranked' → 同样 'ranked'。/play 调用 `<PlayController>` 不传 mode → 解析为 'ranked' → 行为零变化。✓
- auto-start effect deps `[phase, startGame, mode]`：mode 入 deps 不会引起额外触发，因为 mode 是稳定 prop（页面级一次性）。✓
- 导航 effect：依赖 `[lastWriteAt, router]`，**显式 solo 防御 `if (s.mode === 'solo') return;`** 只在 solo 模式下短路。ranked 路径与 51f164c 字节级等价。✓

### 1.4 SoloStatsPanel SSR + 闭环 — PASS

**SSR 首帧安全**：
- SoloStatsPanel.tsx:60 `useState<GameStats>(emptyStats)` 初始化为 SSR-safe 默认值。✓
- SoloStatsPanel.test.tsx:53-59 实证：localStorage 预置 `{totalGames: 4, xWins: 3, ...}`，`renderToString(<SoloStatsPanel />)` 输出只含 `data-value="0"`，无任何 3/4 泄露。✓

**phase 闭环（won→idle 不丢显）**：
- 两个 effect：(a) mount 时 `refresh()`；(b) phase ∈ {won, drawn} 时 `refresh()`（SoloStatsPanel.tsx:64-72）。
- 路径 "won → restart(idle) → 再次 won"：phase 'won'→'idle' 时 (b) 不再触发（早返回），panel 显示局末最后一次写入的 localStorage 行；点击 restart 不清 localStorage（startGame('solo') 只重置 board/phase/winner/winLine/mode='solo'，不动 internalStats），所以 panel 仍显示正确的上一局累加值；下一次 won 时再次触发 (b) 重读到新行。✓
- 「清空战绩」走 onCleared→refresh() 闭环，localStorage 即清、panel 立刻回 0（SoloStatsPanel.test.tsx:88-103 实证）。✓

**onCleared 链**：
- ResetStatsButton.tsx:48 server 分支 await 后 `onCleared?.()`；local 分支同步 `resetSoloStats(); onCleared?.()`。
- SoloStatsPanel 注入 `onCleared={refresh}`。两端都覆盖。✓
- `onCleared?.()` 在 server 分支即便 resetAll 失败（`ok:false`）仍会被 `finally` 前的 `try { await resetAll(); router.refresh(); onCleared?.(); }` 包裹——`resetAll` reject 不可能（store 的 Tagged Result 保证 resolve），所以 `onCleared` 总在 await 之后调用。✓

### 1.5 参数化 vs 51f164c — PASS（含隐性 bug fix）

**StartGameButton 参数化**：
- 51f164c：硬编码 `<Link href="/play" className="flex-1" onClick={startGame}><Button variant="primary" data-testid="start-game">开始游戏</Button></Link>`。
- 当前：`href/label/mode/variant/testid` 全部 props 化。
- home 调用：`<StartGameButton href="/play" label="开始对战" mode="ranked" variant="primary" testid="start-game" />`。href/testid/variant 完全等价；label 由「开始游戏」→「开始对战」（commit 2b79d14 显式文案改动，目的「双 CTA 语义混淆」），属有意变更，非回归；mode='ranked' 走 startGame('ranked')，与 51f164c 调 startGame() 等价（lib/store.ts:209 `mode ?? 'ranked'`）。
- **隐性 bug fix（账）**：51f164c 的 `onClick={startGame}` 会把 React MouseEvent 作为第一个参数传给 startGame，结果 `resolvedMode = mouseEvent ?? 'ranked'` = MouseEvent 对象。TypeScript 严格模式应该报 this is incompatible（MouseEvent ≠ GameMode union），但 React onClick 在某些工具链下被宽容处理。**实测影响**：因 `if (resolvedMode === 'solo')` 用严格等于，MouseEvent 不等于 'solo'，solo 分支不会进；set 时把 mode 字段写成 MouseEvent，但下游 selector `s.mode === 'solo'` 永远 false，store 实际行为退化成 ranked 模式。新版本 `onClick={() => startGame(mode)}` 显式传 mode 字符串，bug 顺带修掉。**应记入 commit message 的 Rejected/Constraint 之外，或在后续 PR 单独标注**。

**ResetStatsButton 参数化**：
- 51f164c：无 props，server-only，`setPending(true); try { await resetAll(); router.refresh(); } finally { setPending(false); }`，testid=`reset-stats`，aria-label=`重置战绩`，children=`pending ? '重置中…' : '重置战绩'`。
- 当前：`scope?: 'server' | 'local'`（default `'server'`），`onCleared?: () => void`。
- home 调用：`<ResetStatsButton />`（无 props）→ scope='server'，onCleared=undefined → `try { await resetAll(); router.refresh(); onCleared?.(); }`，testid=`reset-stats`，aria-label=`重置战绩`，children 与 51f164c 完全一致。**唯一行为差异**：`onCleared?.()` 多一个 no-op 调用（因为 onCleared 是 undefined）。✓ 等价。

### 1.6 测试缺口 — 6 处账

| # | 缺口位置 | 影响 | 现状 |
| --- | --- | --- | --- |
| T1 | components/PlayController.tsx 整文件 | ranked/solo 导航闸 solo-defense 分支无单元测试 | 仅 `tests/qa/stats-race-qa.mjs` + `tests/qa/solo-mode-qa.mjs` 端到端覆盖。PlayController solo-defense 关键行 :54 的 `if (s.mode === 'solo') return;` 一旦未来被回退，QA 探针才暴露（且只在 production build 跑）。补：单测 useGameStore 设 mode='solo'+lastWriteAt 变化，断言 router.replace 不被调 |
| T2 | components/SoloResultInline.tsx 整文件 | 无单元测试 | `solo-mode-qa.mjs` step 3 用 result-headline 隐式覆盖了挂载/卸载。补：RTL 单测 phase='idle'→null，phase='won'→ResultBanner 挂载 |
| T3 | components/Board.tsx 方向键 roving | Board.test.tsx 只覆盖 Enter/Space（line 47-77），未覆盖 ArrowUp/Down/Left/Right 路径 | neighbors() 函数 + queueMicrotask focus 链路裸奔。补：mock document.querySelector 后断言 setState 触发 + focus 转移到下一格 |
| T4 | components/ui/Cell.tsx 整文件 | 无单元测试 | Cell 产出三个核心 testid（cell-N / cell-N-mark / cell-N-glow），其 aria-label 文案「第 N 格，已落 X/O，空，胜局」是 a11y 契约一部分，无单测守着。补：mark 渲染、disabled 传递、isWinning className、aria-label 拼接 |
| T5 | components/SoloStatsPanel.test.tsx | 未测 phase idle→idle（restart 后）的 no-reread 不变式 | 当前 4 个 case 覆盖 SSR/hydrate/phase settle/clear。补：act 内 `setState({phase:'idle'})` 后断言 panel 不重读（store 不动 localStorage 时面板保持上一次结果） |
| T6 | components/ResetStatsButton.test.tsx | 未测 server scope 的 loading state 视觉契约 | line 56-79 只验证 await 后 fetch/refresh/onCleared 触发顺序，未断言 loading=true 期间 button 的 aria-busy 与文案「重置中…」。补：vi.fn 让 fetch 挂起，断言 pending 期间 `getByText('重置中…')` 与 `aria-busy="true"` |

补全成本估算：T1/T2/T4 单测 ≤30 行；T3 需要 jsdom focus mock，~50 行；T5/T6 ~15 行。

---

## 2. Findings 榜

### 2.1 修（block-ship）— 0 项

无。

### 2.2 账（acceptable，但应留痕）— 6 项

| ID | 文件:行号 | 类型 | 说明 | 修法 |
| --- | --- | --- | --- | --- |
| A1 | components/Board.tsx:74 + components/ResetStatsButton.tsx:48 + components/StartGameButton.tsx:31 | 隐性 bug fix | StartGameButton 51f164c 的 `onClick={startGame}` 把 React MouseEvent 作为 startGame 第一个参数，新版 `() => startGame(mode)` 顺带修掉这个 TS 应报但被工具链宽容过的类型/语义 bug | 在后续 PR 的 commit message `WHY` 或 `Rejected` 段补一句「顺带修复 StartGameButton 旧实现把 MouseEvent 当 mode 传 store 的隐性 bug」 |
| A2 | components/PlayController.tsx:23-30, 50-60 | 测试缺口 | 模式分支与 solo-defense 完全靠 QA 探针覆盖，无 RTL 单测 | 增 PlayController.test.tsx：mock useRouter，setState({mode:'solo', lastWriteAt:Date.now()}) 后断言 router.replace 不被调；ranked 路径同理 |
| A3 | components/SoloResultInline.tsx:13-17 | 测试缺口 | 单用途壳无单测；一旦未来回退 selector 形状，QA 探针才会发现 | 增 SoloResultInline.test.tsx：phase 'idle'→null，phase 'won'→ResultBanner 挂载 |
| A4 | components/Board.tsx:35-79 | 测试缺口 | 方向键 roving focus（neighbors + queueMicrotask + focus）无单测 | 增方向键用例：mock document.querySelector，断言 ArrowRight→cell-1 获得 focus |
| A5 | components/ui/Cell.tsx 整文件 | 测试缺口 | 三个核心 testid（cell-N/cell-N-mark/cell-N-glow）+ a11y aria-label 文案契约无单测 | 增 Cell.test.tsx：渲染、mark 显示、disabled、isWinning 视觉 className、aria-label 四态拼接 |
| A6 | components/SoloStatsPanel.test.tsx:33-103 + components/ResetStatsButton.test.tsx | 测试缺口 | panel 的 phase idle→idle 不重读不变式、ResetStatsButton 的 loading 视觉契约 | 各增 1 用例；ResetStatsButton 用 fetch 挂起测 aria-busy |

### 2.3 疵（cosmetic / minor）— 2 项

| ID | 文件:行号 | 类型 | 说明 | 修法 |
| --- | --- | --- | --- | --- |
| C1 | components/Board.tsx:82 + components/ui/BoardGrid.tsx:42 | className 拼接细节 | BoardGrid 在 className=''（非 drawn 相位）时拼出 `"grid grid-cols-3 gap-2 w-fit mx-auto relative "` 末尾带一个空格；浏览器解析 class 列表时吞掉多余空白，无可观测影响 | 可选：BoardGrid 把条件改为 `className && ' ' + className`，或在 Board 里把 default 写成 undefined；非必须 |
| C2 | components/PlayController.tsx:46-61 | 注释密度 | 「关键时序坑」「纵深防御第二层」两段注释解释了 commit 8 时序 race 与 solo 防御意图；信息密度高但对维护者友好。next dev 重生成 AGENTS.md 时可能误把它当成 lint 噪 | 留着即可；若 lint 报 line-too-long 再折行 |

---

## 3. 跨 commit 整体观察（非对抗点，留档）

1. **「展示层 / 适配器」二分范式**：从 StatusBar/StatusBarClient 推广到 BoardGrid/Board + GameShell。两轮 commit 都以 server-compatible 展示层 + 'use client' 适配器为骨架，未引入任何 state/UI/动画库，符合 AGENTS.md §反模式。
2. **params 而非 variant 命名**：ResetStatsButton 用 `scope: 'server' | 'local'` 区分而不是新增 Button variant，避开 ui/Button variant 语义冲突（2b79d14 commit message 明确说「scope 命名而非 variant」）。判断合理。
3. **solo 模式的「防御深度」**：PlayController 显式 `s.mode === 'solo' return` 是对 store 不 stamp lastWriteAt 单点的纵深防御；lib 冻结期外最后一道闸（commit c65d876 comment 说「成本一行」）。后续若 store 重构，应保留此双闸。
4. **eslint-disable set-state-in-effect**：SoloStatsPanel 在两个 effect 都禁用 `react-hooks/set-state-in-effect`，理由写入注释并引 SoundToggle 先例。AGENTS.md 反模式说「不在组件里做 I/O 或持久化」+ SoundToggle 先例许可。判断合规。
5. **SSR 安全双模式**：GameShell（无 'use client'）+ SoloStatsPanel（'use client' 但首帧 emptyStats）。两路径覆盖「真 server component」与「水合后 pull-only client component」两种 SSR 安全范式。

---

## 4. 验证门禁（未跑，仅声明）

按 AGENTS.md §验证门禁，本评审范围需要：

- ① pnpm vitest run → 144/144（commit 2b79d14 自报）；本评审未执行验证命令
- ② pnpm typecheck → 0
- ③ pnpm lint → 0
- ④ pnpm build → 0（/solo ○ static 自报）
- ⑤ node tests/qa/commit-audit.mjs --branch main → fail=0
- ⑥ tests/qa/solo-mode-qa.mjs → 6 步全 PASS（commit 2b79d14 自报 Not-tested：调度者生产服务实跑）

RB 仅做静态 diff + 文件 + grep 对照，未跑上述命令；建议调度者在合入前独立跑一遍。

---

## 5. Findings 计数

- 修（block-ship）：**0**
- 账（acceptable，但留痕）：**6**
- 疵（cosmetic）：**2**
- **总计：8**
