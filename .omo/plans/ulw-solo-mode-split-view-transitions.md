# ulw · 拆分单机模式 + 复用组件 + View Transitions 技术选型

- **日期**：2026-09-15（同日 R2 修订：主公三谕已决，见 §4）
- **状态**：APPROVED（已批，执行中）
- **触发**：「拆分单机模式，复用组件，演示组件拆分」+「MPA 多页跳转动画 vs antfu 式状态迁移」
- **基线**：main @ 51f164c（worktree 干净）
- **执行体**：fresh codex / pi worker（herdr **tab**，非 split pane），调度者只拆解、派发、独立验收

---

## 1. 目标与验收（机器可判）

| # | 验收项 | 判定命令 / 证据 |
|---|--------|----------------|
| A1 | 单机模式可用：solo 全程**零** `/api/stats` 网络写，战绩**持久化到浏览器 localStorage**（落局→reload→战绩仍在） | 新探针 `node tests/qa/solo-mode-qa.mjs` PASS（断言无 outcome POST + localStorage 持久 + 清空生效） |
| A2 | 组件复用可见：/play 与 /solo 共享 GameShell + Board + ResultBanner | `grep -c "GameShell" app/play/page.tsx app/solo/page.tsx` 均 ≥1；Board.test 迁移后全绿 |
| A3 | 六层门禁全绿 × 每 commit | vitest / typecheck / lint / build / commit-audit 0 violations / 触及浏览器界面的探针 |
| A4 | 触及 `lib/store.ts` → Stryker 必跑 | `pnpm test:mutation` store.ts 得分 ≥ 基线 50.49（2026-09-14 基线，break=null 信息性） |
| A5 | 触及 `lib/**` → coverage 必跑 | `pnpm test:coverage` v8 thresholds（80/80/70/80）PASS |
| A6 | ranked 回归无损 | stats-race-qa.mjs、ux-qa.mjs、hydration-check.mjs 仍 PASS |
| A7 | （可选 C5）View Transitions 落地后 reduced-motion 仍有无动效路径 | visual-qa.mjs + `grep -n "view-transition" app/globals.css` 含 reduce 块 |

---

## 2. 调研结论

### 2.1 现状架构（读码所得）

- 3 页 MPA（App Router **软导航**，文档不卸载）：`/`（RSC force-dynamic + loadStats）、`/play`、`/result`（同 `/`）。
- **耦合点**（拆分对象）：
  - `lib/store.ts` `makeMove` 内嵌 `apiRecordOutcome` —— 战绩持久化焊死在引擎里；
  - `components/PlayController.tsx` 订阅 `lastWriteAt` → `router.replace('/result')` —— 导航焊死在控制器里；
  - `components/Board.tsx` 直连 store（棋盘渲染 + roving focus + store 三合一）。
- **仓内已有拆分范本**：`ui/StatusBar.tsx`（纯展示）+ `StatusBarClient.tsx`（store 适配器）。本计划即把此模式推广到 Board。
- 动效契约（DESIGN.md §5）：页面过渡仅 opacity 150ms ease-out、禁 slide-in、禁动画库、reduced-motion 归零。现行为 `.page-fade-in` 单向进场（无旧页出场快照）。

### 2.2 技术选型答问：MPA 跳转动画 vs antfu 式状态迁移

三种谱系：

| 谱系 | 机制 | 适配本项目？ |
|------|------|-------------|
| ① 真 MPA 跨文档过渡（css-tricks 那篇：`@view-transition { navigation: auto }`） | 浏览器在**整文档卸载→加载**间双快照动画（Chromium 126+） | ❌ Next 软导航不卸载文档，永不触发 |
| ② antfu 式（antfu.me，Vue 侧） | 路由钩子里手调 `document.startViewTransition(updateDOM)`，SPA 状态迁移 + 浏览器双快照 | 可行但命令式、自接路由生命周期，重复造轮子 |
| ③ **React 19 `<ViewTransition>`**（Next 16 原生，`node_modules/next/dist/docs/01-app/02-guides/view-transitions.md`） | React 并发渲染把「路由导航即 transition」：声明式共享元素 morph、`<Link transitionTypes>` 方向语义、Suspense reveal | ✅ 已验证 `next/dist/compiled/react` 内置 `ViewTransition` 导出（react 19.2.8 稳定包无，但 App Router 别名到 canary），**零配置零依赖**，正合「禁动画库」约束 |

**结论：走 ③。** 它本质即「antfu 那种状态迁移」的 React 声明式版本，且比手调 `startViewTransition` 多三层：与 Suspense/useTransition 生命周期对齐、共享元素 identity（`name`）、不支持的浏览器自动降级为无动画（功能无损）。

### 2.3 关键技术事实（供执行者引用）

- `<ViewTransition>` 须包在 **page.tsx**，不能放 layout（layout 跨导航常驻，enter/exit 永不触发 —— guide 明言）。
- 动画激活条件：Transitions / Suspense / useDeferredValue；Next 路由导航本身即 transition。
- CSS 钩子：`::view-transition-old/new/group(*)`；建议 `::view-transition { pointer-events: none }`；reduced-motion 对伪元素显式归零。
- `default="none"` 防无关 transition 误触发具名元素动画。

---

## 3. 方案设计

### 3.1 模式架构（拆分后的职责分层）

```
纯规则层   lib/game.ts            （不动，已纯）
引擎层     lib/store.ts           mode: 'ranked' | 'solo'
                                  solo: 不发起 apiRecordOutcome（零网络写，internalStats 不入服务端）；
                                        本地累加 internalStats = recordOutcome(internalStats, outcome)（复用纯函数）
                                        + localStorage.setItem('ttt.solo.stats.v1', JSON)（try/catch 降级内存）
                                        + 新 action resetSoloStats（清本地战绩）
适配层     components/Board.tsx   （瘦身为 store 适配器，保 roving focus）
           StatusBarClient.tsx    （既有范本）
展示层     ui/BoardGrid.tsx       （新抽：props = board/winLine/disabled/focusedIndex/onCellClick）
           ui/StatusBar 等        （不动）
编排层     components/GameShell.tsx （新抽：header+SoundToggle+StatusBarClient+Card+children+actions 槽）
           PlayController.tsx     （ranked 才导航 /result；solo 天然无 lastWriteAt，显式防御 mode）
路由层     app/play  (ranked，行为不变)
           app/solo  (新增：GameShell + Board + 落局内联复用 ResultBanner 含 Confetti)
           app/page   StartGameButton 参数化（href/label/mode）→ 双 CTA
```

### 3.2 设计决策与备选

| 决策 | 取 | 舍 | 为什么 |
|------|----|----|--------|
| store 单实例 + `mode` 字段 | ✅ | 多实例 store（context factory） | 最小 diff；Zustand 单例被 10 处消费，factory 牵动全部 selector，收益不配风险。服务端权威累加契约不受损（solo 只是**不发起**写） |
| solo 战绩持久化 = localStorage | ✅ | IndexedDB / sessionStorage | GameStats 单行 JSON 仅 5 数字，localStorage 足够且同步；仓内先例 sound.ts（`ttt.sound.muted`）；IndexedDB 异步复杂度不配收益。SSR 安全：默认 emptyStats 渲染，useEffect 水合（AGENTS 反模式线）；读写 try/catch（隐私模式降级内存）；读取校验 shape 非法即 emptyStats |
| solo 累加复用 `recordOutcome` 纯函数 | ✅ | 另写一套 | 服务端 handler 与客户端 solo 分支共用同一纯规则，双模式规则单源 |
| solo 落局**内联** ResultBanner，不建 /solo/result | ✅ | 第四条路由 | 复用演示更直观（同一组件两种编排）；少一路由少一份 RSC 面；ranked 的 /result 流完全不动 |
| BoardGrid 纯 props 抽取 | ✅ | Board 保持直连 | 仓内 StatusBarClient 先例的推广；QA testid 契约（board / cell-N / cell-N-mark）原样保留在展示层 |
| C5 View Transitions 独立可选 commit | ✅ | 与模式拆分混装 | 原子提交铁律；VT 触碰全局动效契约（DESIGN.md），独立可回滚 |

### 3.3 Commit 拆分（串行，单写者）

| C | 主题 | 改动面 | 门禁增项 |
|---|------|--------|----------|
| C1 | `refactor(components): 抽取 ui/BoardGrid 纯展示层，Board 瘦身为适配器` | components/Board.tsx、components/ui/BoardGrid.tsx（新）、Board.test.tsx | 六层；浏览器界面 → visual-qa |
| C2 | `feat(store): 引入 ranked/solo 模式，solo 本地累加 + localStorage 持久化` | lib/store.ts（mode 字段 + solo 分支 + resetSoloStats + SOLO_STATS_KEY）、tests/store/store.test.ts（solo：零网络写/localStorage 累加/读取容错/清空） | 六层 + **Stryker** + **coverage** |
| C3 | `refactor(components): 抽取 GameShell，PlayController 模式感知` | components/GameShell.tsx（新）、PlayController.tsx、app/play/page.tsx | 六层；ux-qa、stats-race-qa 回归 |
| C4 | `feat(app): 新增 /solo 单机模式路由 + 首页双 CTA` | app/solo/page.tsx（新：GameShell + Board + 落局内联 ResultBanner + SoloStatsPanel 订阅重读 localStorage 供数 StatsGrid + ResetStatsButton 参数化清本地）、app/page.tsx、StartGameButton.tsx（参数化 href/label/mode）、tests/qa/solo-mode-qa.mjs（新）、DESIGN.md | 六层；solo 探针 + ranked 三探针 |
| C5 | `feat(app): React 19 <ViewTransition> 双向 crossfade（主公已批，用 Next 16 内置 React canary 导出）` | app/{page,play,result,solo}/page.tsx 包 ViewTransition（**page 层不放 layout**）、globals.css、DESIGN.md §5 | 六层；hydration-check + visual-qa |
| C6 | `docs(assets): UI 变更后全量重制截图 + README 双语同步` | docs/screenshots/{home,board,result,solo}.png 重制（production build + visual-qa 探针产图）、README.md/README.en.md 截图表 + 功能段、docs/social-card-*.png 若引用本站 UI 一并重制 | commit-audit + 人工目验 |

- 每 commit：Conventional + WHAT/WHY/HOW 正文 + 全套 lore trailer + `Plan: .omo/plans/ulw-solo-mode-split-view-transitions.md` 页脚。
- C5 的 CSS 骨架（对齐 DESIGN.md §5，仅 opacity 双向 150ms，无位移）：
  ```css
  @supports (view-transition-name: root) {
    .page-fade-in { animation: none; }  /* VT 生效则旧单向 fade 退役，旧浏览器回退保留 */
    ::view-transition-old(.page), ::view-transition-new(.page) {
      animation: 150ms ease-out both page-fade-in;
    }
    ::view-transition { pointer-events: none; }
  }
  @media (prefers-reduced-motion: reduce) {
    ::view-transition-old(*), ::view-transition-new(*), ::view-transition-group(*) {
      animation-duration: 0s !important; animation-delay: 0s !important;
    }
  }
  ```

### 3.4 执行编排（herdr + fresh session · R2 按上下文正交性重划）

调度者 = 本 session：只拆解、派发、轮询、独立验收，不亲写主线代码。

**实际进度（R3 实录）**：
- W1（C1+C2）✓ bb171bf + 4f5ec71；分支事件（02:55 外部进程擅切 dev）已 ff 收敛回 main。
- P1 并行三 lane ✓：W2（C3 c65d876 + C4 2b79d14）、W3（C5a 542042a→cherry-pick 0bab68e 入 main，枝已删）、调度者（coverage PASS 98.36/94.23/87.35/95.25；Stryker store.ts 57.94 ≥ 基线 50.49，总分 70.09 ≥ 68.55）。
- W4（C5b）✓ f45ddbf：四页 `<ViewTransition enter="page" exit="page" default="none">`，guide 原句为据，globals.css 零改。
- 调度者探针验收 ✓/修复：solo-mode-qa 6/6 PASS（A1 达成）；stats-race-qa 发现两处探针度量失真（STEP 10 竞态读被 VT 页界平移余量翻红；STEP 12 桥接计数漏 POST 半，历史遗漏）→ 双基线定责（51f164c / 2b79d14 复跑）→ 探针修复 a8a7063 → main 全量 14/14 PASS。六门全绿。
- W5（C6）✓ 02c654d：四图重制（含 solo.png 新增，visual-qa 增第 7 阶）+ 双语 README；social cards 系手工合成无再生脚本，列主公待办。
- 调度者 ✓ d8329a4：herdr 卫生规 v2.1（除五分片候 done）入档。
- V（对抗验收）✓：核心全立（A1/A2/A4/A5/A7 PASS），缺陷 1（hydration-check 同步断言被 VT effects 延迟平移，f45ddbf 起红，双基线定位）+ 缺陷 2（契约文档缺 solo-stats 同步）→ 遣 W6 修；缺陷 3（双 launchQA 旧疵）不碍判定，存档。
- W6（缺陷修复）进行中：hydration-check 轮询化 + 契约文档同步，两 commit。
- 待决：push 待主公令（main 领先 origin 若干 commit）；social-card-{home,play,result}.png 四变体须有美术上下文之 lane 重绘（brandmark 不涉 UI 可缓）。

**正交波次（同 worktree 单写者；lane 间文件面互斥）**：

| 波 | lane | 范围（文件面） | 依赖 |
|---|------|--------------|------|
| P1（并行×3） | W2 = C3+C4 | app/{play,solo,page}.tsx、components/{GameShell,PlayController,SoloStatsPanel,ResetStatsButton,StartGameButton}、tests/qa/solo-mode-qa.mjs、DESIGN.md | C1/C2 ✓ |
| P1 | W3 = C5a | app/globals.css（仅此一文件，第二 worktree `../tic-tac-toe-vt` 枝 chore/vt-css-prep） | C1/C2 ✓ |
| P1 | 调度者 = C2 独立验证 | coverage ✓ + Stryker（lib scope，与 W2 文件面互斥可并行） | C2 ✓ |
| P2 | W3' = merge C5a + C5b 接线 | app/*.tsx 包 ViewTransition + DESIGN.md §5 | W2 + W3 皆竣 |
| P3 | W4 = C6 | 截图重制 + README 双语 | 全 UI 竣 |
| P4 | V = fresh-context 对抗验收 | 独立 reviewer，审全 diff + 抽查门禁 | 全竣 |
| P5 | 调度者 = 分支收敛 | 本地 main 已含全部；push 待主公令 | V 过 |

session 卫生：capture（`herdr agent list` → `.omo/sessions.local.md`）→ 退出 → pane close；会话落盘 `~/.pi/agent/sessions/`，pane 非会话。午夜窗口（00:00±15min）禁批量文件操作。

### 3.5 风险与回滚

| 风险 | 缓解 |
|------|------|
| solo 误写服务端战绩 | A1 探针网络断言 + store.test 断言 internalStats 不变 |
| Board 拆分破 QA testid 契约 | testid 留在 BoardGrid；Board.test 全量迁移；visual-qa 回归 |
| VT 在 Safari 行为差异 | guide 已声明降级安全（无动画≠无功能）；`@supports` 门控，旧引擎走 page-fade-in |
| C5 动效越 DESIGN.md 契约（slide-in 禁令） | C5 仅双向 crossfade，无位移；DESIGN.md 同 commit 增补条目 |
| store.ts 变更引 mutation 退化 | C2 单独成 commit，基线对照 2026-09-14（50.49），显著退化即人工判定 |

---

## 4. 主公三谕（2026-09-15 已决）

1. solo 战绩**不可弃**：以浏览器持久化承载（定为 localStorage，理由见 §3.2），零服务端写。
2. C5 **做**，技术定案 React 19 `<ViewTransition>`（Next 16 内置 canary 导出，零依赖）。
3. 双 CTA 文案可改；**UI 改动后所有截图重制**（→ C6 专项收尾）。
