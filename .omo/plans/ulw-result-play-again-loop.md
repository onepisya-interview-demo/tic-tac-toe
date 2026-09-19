# ulw · /result「再来一局」死循环修复（F1-F4：挂载终局态重置 + 亲历迁移守卫）

- **日期**：2026-09-19
- **状态**：APPROVED（主公 2026-09-19 御批 F1/F2/F3/F4 四项 +「编写落盘计划、完整 AC、测试用例逻辑闭环遍历所有分支」）
- **触发**：主公现场报告——线上局结束 → /result → 点「再来一局」→ 闪回游戏画面 → 立即弹回 /result，死循环
- **基线**：dev @ 4b71391（主公侧 .gitignore / next-env.d.ts 两处环境性脏文件不卷入任何 commit）
- **执行体**：fresh codex（herdr 3t **tab**），调度者只拆解、派发、轮询、独立验收
- **终验**：独立 fresh-context 对抗席（非调度者自验，产出 reports/review/V8.md）

---

## 0. 根因（调查已闭合，运行时证据在案）

四步链：

1. `/result` 页「再来一局」是纯 `<Link href="/online">`（`app/result/page.tsx:141`），
   点击零 store 动作。文件头注释假称「startGame 会在 /online 挂载时由 PlayController
   触发」——该假设只对 `phase='idle'` / mode 不匹配成立，对终局态（`won`/`drawn`）是错的。
2. Zustand store 是模块级单例，软导航跨路由保留。打完一局后 store 残留
   `{phase:'won', mode:'online', board:残盘}`。
3. `components/PlayController.tsx:37` 自动开局条件 `s.mode !== mode || s.phase === 'idle'`
   对终局残留两个条件皆 false → 不 restart、不 startGame → 残盘渲染。
4. `components/ResultNavigator.tsx` fresh mount 时 `lastPushedPhaseRef=null`，看到
   `phase='won'` 即当作新胜局 → `router.push('/result?name=…')` → 弹回 /result。
   store 仍是终局 → 循环。

运行时证据（CDP connectOverCDP :9222 + 页内 25ms 记录器，2026-09-19）：
点击① → url:/online + 非空残盘闪现 → ~1.0s 后 url:/result；点击② → /online → ~0.3s 后 /result。

**同根因第二陷阱**：/result 按浏览器后退回 /online 同样被 ResultNavigator 立即弹回（后退键坏）。

**QA 盲区**：one-identity-qa step (c) 落 /result 后只断言 SSR + 截图，从不点
`play-again`；探针进场全走 StartGameButton（先 startGame 再 push）或 page.goto
硬导航（store 重置 idle）。「终局态 + 软导航进场」零覆盖。

---

## 1. 修复设计（F1-F4，F1/F2 必须成对）

### F1 · PlayController 挂载时终局态视为 stale

`components/PlayController.tsx`：加 mount ref；effect 首次运行时若
`phase ∈ {'won','drawn'}`（不论 mode 匹配与否）→ `restart() + startGame(mode)`。
非首次运行**保持原语义**（`s.mode !== mode || s.phase === 'idle'` → restart+start），
因为 RestartButton 的 `restart()→idle→effect 重跑→startGame` 链依赖它，不可动。

```tsx
const didMountRef = useRef(false);
useEffect(() => {
  const s = useGameStore.getState();
  const terminal = s.phase === 'won' || s.phase === 'drawn';
  const firstMount = !didMountRef.current;
  didMountRef.current = true;
  if (s.mode !== mode || s.phase === 'idle' || (terminal && firstMount)) {
    if (s.phase !== 'idle') s.restart();
    startGame(mode);
  }
}, [phase, startGame, mode]);
```

### F2 · ResultNavigator 改「亲历迁移」语义（循环杀手）

`components/ResultNavigator.tsx`：`lastPushedPhaseRef` 换成 `prevPhaseRef`。
只有本挂载周期内**亲眼观察到**非终局→终局的迁移才推送；挂载瞬间已是终局态
（`prev === null`，即迁移发生于挂载之前）一律不推。

```tsx
const prevPhaseRef = useRef<GamePhase | null>(null);
useEffect(() => {
  const prev = prevPhaseRef.current;
  prevPhaseRef.current = phase;
  if (mode !== 'online') return;
  if (prev === null) return;                       // mount 时即终局 = stale，不推
  const terminal = phase === 'won' || phase === 'drawn';
  if (terminal && prev !== 'won' && prev !== 'drawn') {
    const name = (playerName ?? '').trim();
    if (name !== '') router.push(`/result?name=${encodeURIComponent(name)}`);
  }
}, [mode, phase, playerName, router]);
```

**为什么必须成对**：只修 F1 无效——navigator 的 effect 闭包持有挂载 render 的
`phase='won'`，同一 commit 内 effect 按树序执行（PlayController 先跑、重置 store），
navigator 仍以旧闭包值 push。只修 F2 则循环消失但残盘留在 /online 且不会自动开新局，
UX 仍错。

### F3 · 测试补盲（分支闭环见 §2）

- `components/ResultNavigator.test.tsx`：按 §2.1 分支表补齐用例。
- `components/PlayController.test.tsx`：**新建**（现无此文件），按 §2.2 分支表。
- `tests/qa/one-identity-qa.mjs`：step (c) 之后新增 step (c2)，见 §2.3。

### F4 · 注释修正

- `app/result/page.tsx` 头注释：修正「startGame fires when /play mounts」的错误假设，
  改为描述 F1 契约（挂载终局态 → PlayController 重开新局）。
- `components/ResultNavigator.tsx` docstring：lastPushedPhaseRef 段落改为亲历迁移语义。
- `components/PlayController.tsx` docstring：补挂载终局态重置契约。

---

## 2. 测试用例分支闭环表（逻辑全覆盖）

### 2.1 ResultNavigator（10 分支，vitest + RTL）

| # | 前置 | 动作 | 期望 |
|---|------|------|------|
| N1 | mount 时 phase=idle | 迁移到 won（模拟 makeMove 终局 or setState） | push 恰 1 次，URL 含 ?name= |
| N2 | mount 时 phase=playing | 迁移到 drawn | push 恰 1 次 |
| N3 | **mount 时 phase=won**（本 bug 态） | 无动作 | **不 push** |
| N4 | **mount 时 phase=drawn** | 无动作 | **不 push** |
| N5 | mount 时 phase=won，随后重置为 playing，再迁移到 won | 全序列 | 恰 push 1 次（第二次是亲历迁移） |
| N6 | mode='offline' | 亲历迁移到 won | 永不 push |
| N7 | playerName=null/'' | 亲历迁移到 won | 不 push |
| N8 | StrictMode 双挂载 | 亲历迁移到 won | push 恰 1 次 |
| N9 | 亲历迁移到 won 后 phase 保持 won | 多次 effect 重跑（如 playerName 变化） | 仍只 push 1 次 |
| N10 | 亲历 won → restart(idle) → 再 won | 二连胜序列 | push 恰 2 次 |

### 2.2 PlayController（9 分支，vitest + RTL，新建文件）

| # | mount 时 store 态 | 期望 |
|---|------|------|
| P1 | phase=idle，mode 匹配 | startGame(mode)（既有：硬导航进场） |
| P2 | phase=playing，mode 匹配 | 不动（既有：StartGameButton 已 startGame） |
| P3 | phase=playing，mode 不匹配 | restart + startGame(新 mode)（既有：跨模式软导航） |
| P4 | **phase=won，mode 匹配** | **restart + startGame（F1 新增：本 bug 主路径）** |
| P5 | phase=won，mode 不匹配 | restart + startGame（F1 新增） |
| P6 | phase=drawn | 同 P4/P5 语义 |
| P7 | mount 后（playing）phase 迁移到 won（offline 本局胜） | **不重置**（mount 判定只发生一次；保 offline in-page 结果视图） |
| P8 | mount 后调用 restart()（phase→idle） | effect 重跑 → startGame(mode)（既有 RestartButton 链） |
| P9 | StrictMode 双挂载 + phase=idle | startGame 恰 1 次生效（第二次运行 phase 已 playing → 跳过） |

### 2.3 QA 探针（tests/qa/one-identity-qa.mjs 新 step c2）

紧跟 step (c)（页面停在 /result、同一 page 对象 = 软导航前提 = store 残留终局态）：

| # | 断言 |
|---|------|
| Q1 | 点 `[data-testid="play-again"]` → URL 变 /online 且 **1.5s 内不弹回 /result**（轮询 URL） |
| Q2 | /online 棋盘为空：cell-0..cell-8 全部无 `cell-N-mark` |
| Q3 | 首着可落子：点 cell-0 → 出现 mark（证明 phase=playing，残盘态下 makeMove 会早退） |
| Q4 | 浏览器后退路径：打完一局落 /result 后 `page.goBack()` → /online 不弹回、棋盘为空 |
| Q5 | 修复前此 step 必挂（反向对照，PR 描述注明即可，不入断言） |

---

## 3. 验收标准 AC（机器可判）

| # | 验收项 | 判定 |
|---|--------|------|
| A1 | 主 bug 修复：/result → play-again → /online 空盘新局、无回弹 | one-identity-qa step c2 Q1-Q3 PASS |
| A2 | 后退陷阱修复：/result goBack → /online 无回弹 | step c2 Q4 PASS |
| A3 | 真实胜局推送零回归：亲历迁移仍推 /result | one-identity-qa step (c) waitForURL(/result) 仍 PASS |
| A4 | offline 全路径零回归（F1 动的是共用组件） | offline-mode-qa 全绿（in-page 结果视图 / play-again-offline / restart 链） |
| A5 | 分支闭环：§2.1 10 分支 + §2.2 9 分支单测全绿且断言与表一致 | pnpm vitest run 全绿；调度者逐条对表抽查 |
| A6 | 六层门禁 × 每 commit 全绿 | vitest / typecheck / lint / build / commit-audit 0 violations / 相关探针 |
| A7 | on-demand 三层不触发声明 | 未触 lib/game.ts / lib/store.ts / lib/db.ts / db/schema.ts（两组件只是 store 消费方），Stryker/coverage 豁免，理由入 commit Tested trailer |
| A8 | 独立对抗终验 ACCEPT | reports/review/V8.md，独立 fresh-context 席产出（非调度者自验），复现脚本 + 探针双通道 |
| A9 | 页行为变更录制 | QA_VIDEO 录 step c2 全路径，调度者逐帧目验 |

---

## 4. 执行协议

- 分支 **dev**；Conventional Commits + 中文正文（行宽≤100）+ 全套 lore trailer +
  `Plan: .omo/plans/ulw-result-play-again-loop.md` footer；禁 `--no-verify`、禁 `git add -A`。
- fresh codex 席（herdr 3t tab）：先 teach-back 复述任务与验收再动手；codex 编辑一律
  shell（sed / python / heredoc），禁 apply_patch。
- 探针端口 :3101 hermetic，不触主公 :3000 活服；浏览器 QA 用产线构建
  （`pnpm build && pnpm start`），**build 前确认不与主公 dev 服冲突：在独立 git
  worktree 内构建**（沿 ../ttt-wa 模式，构建冻结反模式）。
- 单写者：修复席工作期间，其他席位只读。
- 通道先验：派发后 60s 内确认 codex 真在执行工具（历史席位有 harness 拒调先例）。
- 每子任务新开干净 session；完成后采现 session id 记 `.omo/sessions.local.md`。

## 5. Rejected（本轮不做）

- ❌ /result 加客户端 PlayAgainButton（click 时 startGame+push）：违反 W3「/result
  纯 RSC 零客户端组件」决策，且修不了后退陷阱（后退不经过按钮）。
- ❌ 只修 ResultNavigator：循环消失但残盘留在 /online、不自动开新局，UX 仍错。
- ❌ 只修 PlayController：无效——navigator effect 闭包仍持挂载时 phase='won'，同
  commit 内照 push（§1 成对理由）。
- ❌ store 加 gameId/stale 标志：两处组件语义修复即可，store 面扩散属过度设计。
- ❌ 改 RestartButton / StartGameButton：两者行为正确，不在本波触碰。
