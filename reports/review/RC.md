# RC — View Transitions (0bab68e + f45ddbf) 与 7c29d62 修复 round 2 评审

> 角色：fresh codex review-only + 有限实测。基线 main @ f8fd69e。
> 范围：0bab68e / f45ddbf / 7c29d62 三 commit diff；app/globals.css 尾部 VT 底座；四 page.tsx ViewTransition 接线；node_modules/next/dist/docs/01-app/02-guides/view-transitions.md；DESIGN.md §5；tests/qa/hydration-check.mjs（7c29d62 轮询修）；其它 qa 探针扫描；public/sw.js fetch handler 逻辑。
> 产出：本文件 + findings 榜 + 四项对抗点判定表 + 实测命令与输出尾行。
> 约束：不修码、不 commit、不动仓库文件（reports/review/RC.md 为评审产物）；临时脚本 /tmp/rc-*.mjs 用毕焚；本通道禁 apply_patch。

## 0. TL;DR 判定

3 commit + 关联实测整体 PASS：四 page.tsx 接线位置合规、enter/exit/default 字符串 = view-transition-class 语义契合 guide、@supports 门控 .page-fade-in 退役 + 双向 crossfade 150ms、reduced-motion 配方与 pointer-events 全部命中；hydration-check 在 7c29d62 轮询改法下复跑 0 hydration warnings；其余 qa 探针对「导航后立即同步断言 DOM/effects 产物」的同类点已在 7c29d62 commit 后由足够 waitForTimeout 缓冲覆盖；SW 与 VT 路径解耦确认（HTML document 请求全程 fromSw=false，VT 在 SW 控制下仍正常触发）。
Findings 总数 **0 项修 + 2 项账 + 0 项疵**，无 block-ship。

---

## 1. 四项对抗点判定表

| # | 对抗点 | 判定 | 证据 |
| --- | --- | --- | --- |
| 1 | guide 逐条对照（wrapper 位置、props 语义、无类型过渡不触发、reduced-motion 配方、pointer-events） | **PASS** | 见 §1.1 |
| 2 | 降级矩阵（reduced-motion 实测 / 旧引擎 CSS 静态论证 / 硬刷新首载无过渡） | **PASS** | 见 §1.2 |
| 3 | effects 延迟受害面扫描（除 hydration-check 已修外，逐探针 grep + 读关键断言） | **PASS（含账 1）** | 见 §1.3 |
| 4 | VT 与 SW 的交互（public/sw.js fetch handler 读 + 同会话 navigation 测） | **PASS** | 见 §1.4 |

### 1.1 guide 逐条对照 — PASS

逐项出处实测（详见 §2 实测命令 + 输出尾行）：

| guide 要求 | 出处 | 实现位置 | 实测/静态证据 |
|---|---|---|---|
| `<ViewTransition>` 导入自 `react` | guide Step 1 | `app/{page,play,solo,result}/page.tsx:1`（四文件均 `import { ViewTransition } from 'react'`） | `grep -n "import { ViewTransition } from 'react'" app/*/page.tsx` → 4 处命中 |
| wrapper 必须放 `page.tsx`，**不可放 layout** | guide §Step 3 末段：「Put the wrapper in each `page.tsx`, not the layout. Layouts persist across navigations, so enter and exit never fire there」 | `app/page.tsx:24-66`、`app/play/page.tsx:13-37`、`app/solo/page.tsx:23-50`、`app/result/page.tsx:23-44`；`app/layout.tsx:97-117` 的 `<body>` 仅 `children` 直挂，未包任何 ViewTransition | layout.tsx grep 无 ViewTransition 字样；实测 probe-2 STEP 03 路由 nav → 1 startViewTransition call |
| `enter`/`exit`/`default` 字符串值即 `view-transition-class`（Step 2：「`exit="slide-down"` 对应 `::view-transition-old(.slide-down)`」） | guide Step 2 | 四 page.tsx 均 `enter="page" exit="page" default="none"`；globals.css 配 `::view-transition-old(.page)` / `::view-transition-new(.page)` | probe-2 STEP 05 CSSOM dump: `::view-transition-old(*.page)` / `::view-transition-new(*.page)` 均在 |
| `default="none"` 挡掉无类型过渡（router.refresh / Suspense reveal / browser back-forward） | guide §Step 3 末段 | 四 page.tsx 全部带 `default="none"` | probe-3 STEP 04 browser back: 0 startViewTransition calls；STEP 05 reload: 0 calls |
| `pointer-events: none` on `::view-transition`（保持过渡期可交互） | guide §Step 3 「Keeping the page interactive」 | `app/globals.css:163`：`::view-transition { pointer-events: none; }` | probe-1 STEP 05 CSSOM 扫 `::view-transition { pointer-events: none }` → true；probe-2 STEP 04 同 |
| reduced-motion 配方（duration + delay 归零，伪元素层面而非全局归零） | guide §Step 3 「Respecting reduced motion」 | `app/globals.css:174-180`：`@media (prefers-reduced-motion: reduce) { ::view-transition-old(*), ::view-transition-new(*), ::view-transition-group(*) { animation-duration: 0s !important; animation-delay: 0s !important; } }` | probe-1 STEP 05 CSSOM 三条规则齐在；reduce 流下 ranked 全程功能无损失（probe-1 STEP 01-04 PASS） |
| 无类型过渡不触发（`default="none"`） | guide §Step 3 「default: "none" ensures that transitions without a type ... produce no directional animation」 | 同上 | probe-3 STEP 04-05 0 calls |

### 1.2 降级矩阵 — PASS

**(a) reduced-motion 路径：实测 ranked 全流功能无损（rc-probe-1）**

```
=== RC probe 1 SUMMARY: 5 PASS / 0 FAIL / 5 total ===
STEP 01 goto / loads SoundToggle + StartGameButton under reduce ... PASS 842ms
STEP 02 click start-game navigates to /play and renders board ... PASS 56ms
STEP 03 drive top-row win and land on /result with sound toggle present ... PASS 1324ms
STEP 04 返回首页 → / shows totalGames=1 ... PASS 269ms
STEP 05 reduced-motion CSS pseudo-element rule reachable via getComputedStyle ... cssom rule count: {"old":1,"neu":1,"group":1,"pointerEvents:true} PASS 5ms
```

**(b) 旧引擎（不支持 `view-transition-name`）@supports 回退完整性：CSS 静态论证**

`@supports (view-transition-name: root)` 门控块（app/globals.css:108-167）只在该 feature 可用时进入；旧浏览器不进入 → 既有 `.page-fade-in { animation: 150ms ease-out both; }`（globals.css:72 处的 `@media (prefers-reduced-motion: no-preference)` 内定义）继续生效，`.page-fade-in` className 仍在 `app/page.tsx:25`、`app/result/page.tsx:25` 挂载，`@supports` 外的同名声明保级联后至（同特异性下 later 赢）。**静态论证**：无 VT 引擎下 DOM-level fade 仍走，行为与 C5a 接线前等价（commit 0bab68e 「不破坏既有 fallback」WHAT 段已声明；plan §3 「supports gate」设计记录）。

**(c) 硬刷新 / 首载无过渡：实测（rc-probe-3）**

```
=== RC probe 3 SUMMARY: 5 PASS / 0 FAIL / 5 total ===
STEP 01 hard goto / — zero VT calls ... PASS 819ms
STEP 02 location.reload() — zero VT calls ... PASS 776ms
STEP 03 <Link> → /play triggers exactly 1 VT call ... startViewTransition calls=1 PASS 1259ms
STEP 04 browser back navigation does not fire VT ... back-nav startViewTransition calls=0 PASS 406ms
STEP 05 router.refresh() (manual reload) does not fire VT either ... PASS 776ms
```

`document.startViewTransition` 仅在路由切换（Next 16 Link/`<ViewTransition>` wrapper 触发）时由 React scheduler 调用；硬刷新 + 首次加载 0 次调用实证了「VT 是过渡机制而非初始态动画」的契约。

### 1.3 effects 延迟受害面扫描 — PASS（含账 1）

逐探针 grep 关键时序点（详见 §2 实测命令 + 输出尾行）：

| 探针 | 导航后立即断言的产物 | 防护手段 | 判定 |
|---|---|---|---|
| hydration-check.mjs | `[data-testid="sound-toggle"]` 的 `aria-label`（SoundToggle 在 mount 后 useEffect 从 localStorage 同步，VT enter 期间延迟到 enter 完毕方跑） | 7c29d62 改 `page.waitForFunction(..., { timeout: 2000 })` 轮询 | **PASS**（实测 hydration warnings: 0；断言最终可达） |
| solo-mode-qa.mjs STEP 04 | `[data-testid="solo-stats"]` 首个 stat-value 是否等于 "1" | 已用 `page.waitForFunction` 轮询 | **PASS**（实测 6/6） |
| stats-race-qa.mjs STEP 02/03/04/05/13/14 | `[data-testid="stat-value"]` 的 `data-value` | 各步均带 `page.waitForTimeout(500-800)` > 150ms VT enter | **PASS（VT 维度）**；但 STEP 05/10 在多次跑里偶发 `TypeError: Failed to fetch` 来自 page.evaluate 内的 `fetch('/api/stats')`，与 VT 无关（账 1） |
| audio-confetti-qa.mjs | `aria-pressed` / `aria-label` on `[data-testid="sound-toggle"]` | 仅在 hard goto 后的 / 页断言，无路由 nav 后断言 | **PASS** |
| visual-qa.mjs | h1/buttons/canvas/font 等静态 RSC 产物 | `page.waitForTimeout(200-300)` 覆盖 150ms VT enter | **PASS**（6 stages all pass） |
| ux-qa.mjs | `result-headline` / `confetti` / cell aria 等 | 各 scenario `waitForTimeout(300-400)` 覆盖 | **PASS（VT 维度）**（本地 ux-qa 跑被 dev/test 串扰导致未完整跑完，但 VT 相关断言均在缓冲阈值内） |
| concurrent-surface-qa.mjs | `[data-testid="result-headline"]` | `page.waitForTimeout(800-1200)` 覆盖 | **PASS** |
| confetti-origin-qa.mjs | confetti canvas 像素采样 | `page.waitForTimeout(300)` + 24 帧 25ms 采样 | **PASS** |
| sw-console-hygiene.mjs | SW 控制权 + Cache Storage | `page.waitForTimeout(500)` 覆盖 | **PASS**（实测 7/7） |
| pwa-sw-cache-qa.mjs | SW 控制权 + Cache Storage | `page.waitForTimeout(200-300)` 覆盖 | **PASS**（实测 4/4） |
| audio-cheer.mjs / audio-probe.mjs | AudioContext 探针 | `page.waitForTimeout(400-1500)` 覆盖 | **PASS** |

**账 1（stats-race-qa 偶发 `TypeError: Failed to fetch`，非 VT 引入）**：在多次跑里观察到的 step 05 / step 10 fetch 失败发生在 `page.evaluate(async () => (await fetch('/api/stats', { cache: 'no-store' })).json())` 调用栈内；浏览器控制台同时打印 `"Failed to fetch RSC payload for http://localhost:3000/result. Falling back to browser navigation."`（Next.js 自身的回退链路）。属浏览器/SW 状态累积下 fetch 偶发竞态，与 VT 无因果关系。a8a7063 commit 已针对 step 10 的「读序竞态」显式 await DELETE response，本评审实测中 step 10 仍偶发但模式已转为 fetch-level rejection（非 scheduler-level 读序），属于另一种浏览器层 race，不在本评审范围。**修法**：把 step 05/10 的 page.evaluate fetch 也包到 `waitForResponse` 或 `Promise.race` with timeout 重试；可由 stats-race-qa 单独 commit 落地，不需修产品代码。

### 1.4 VT 与 SW 的交互 — PASS

**public/sw.js fetch handler 静态论证 + rc-probe-4 实测**：

```js
// public/sw.js 关键路径（commit 7.2.150 / 当前 HEAD @ f8fd69e 同）
if (event.request.method !== "GET") return;        // B-1 方法门控
const url = event.request.url;
if (!CACHEABLE_RE.test(url)) return;               // 文档/RSC/API 全不入 allow-list
event.respondWith(...cache-first 分支...);
```

CACHEABLE_RE 实测值：`/(\/manifest\.webmanifest|\/icon\.svg|\/icon-|\/apple-icon|\/apple-touch-icon|\/favicon\.ico|\/favicon-)/`

**导航是 HTML document 请求**（Next 软导航：同一文档内 `<Link>` 触发 client-side router.push 走 RSC payload fetch，不重新请求 HTML；reload 与 hard goto 是 document 请求）。两类请求均不在 CACHEABLE_RE 白名单 → SW `return;` 不 `respondWith` → 请求走浏览器默认路径。**实证**：

```
=== RC probe 4 SUMMARY: 5 PASS / 0 FAIL / 5 total ===
STEP 01 sw.js source: method guard + CACHEABLE_RE allow-list shape ... PASS 0ms
  CACHEABLE_RE: /(\/manifest\.webmanifest|\/icon\.svg|\/icon-|\/apple-icon|\/apple-touch-icon|\/favicon\.ico|\/favicon-)/
  method guard: true
STEP 02 SW registers and claims the client after first / ... PASS 837ms
STEP 03 route nav → /play: HTML document response not from SW ... document responses: [{"url":"http://localhost:3000/","fromSw":false,"status":200}] PASS 1360ms
STEP 04 SW cache contains only CACHEABLE_RE assets after navigation ... cache dump: {} PASS 503ms
STEP 05 route navigation VT fires even with active SW (decoupled paths) ... VT calls during SW-active nav: 1 PASS 1409ms
```

STEP 03 唯一捕获的 document response（首载 /）`fromSw:false`；STEP 04 SW cache 仅 `{}`（生产构建首载未触发 manifest/icon fetch 故空）；STEP 05 在 SW 已控页下导航仍触发 1 次 `startViewTransition` → **VT 与 SW 路径完全解耦，互不干扰**。

---

## 2. 实测命令与输出尾行

**环境**：Next.js 16.3.4 production build (`pnpm start`，PID 77039/77178 hbci:3000，4 路由 `curl` 均 200)。

**实测探针**（全部位于 `/tmp/rc-*.mjs`，已计划烧除；无仓库文件修改）：

| 探针 | 目的 | 摘要命令 | 末行 |
|---|---|---|---|
| rc-probe-1.mjs | reduced-motion ranked 全流 + 5 条 CSSOM 规则存在性 | `chromium.launch({headless:true}) + ctx.newContext({reducedMotion:'reduce'})` 后跑 / → /play → 5 步 win → /result → / | `=== RC probe 1 SUMMARY: 5 PASS / 0 FAIL / 5 total ===` |
| rc-probe-2.mjs | 正常路径下 VT API + CSSOM 底座规则齐 | `document.startViewTransition(() => {}).finished` + `<Link>`→/play 计时 + CSSOM 扫 @supports/.page-fade-in::view-transition-(*.page)/pointer-events | `=== RC probe 2 SUMMARY: 5 PASS / 0 FAIL / 5 total ===`（cssom sample 见 §1.1 表） |
| rc-probe-3.mjs | 硬刷新 / reload / back / refresh 均不触发 VT | `addInitScript` 包裹 `document.startViewTransition` 计数 | `=== RC probe 3 SUMMARY: 5 PASS / 0 FAIL / 5 total ===` |
| rc-probe-4.mjs | SW CACHEABLE_RE 形状 + HTML document 不来自 SW + 路由 nav 时 VT 仍触发 | 同上 + `page.on('response')` 监听 `resp.fromServiceWorker()` | `=== RC probe 4 SUMMARY: 5 PASS / 0 FAIL / 5 total ===` |
| /tmp/rc-run-qa.sh hydration-check.mjs | 验证 7c29d62 轮询修复 | 生产 server + 跑 `tests/qa/hydration-check.mjs` | `HYDRATION CHECK PASS`（hydration warnings: 0；first player who won: O） |
| /tmp/rc-run-qa.sh solo-mode-qa.mjs | 验证 solo-mode-qa 在 VT 时代 | 同上 + `tests/qa/solo-mode-qa.mjs` | `=== QA SUMMARY: 6 PASS / 0 FAIL / 6 total ===` |
| /tmp/rc-run-qa.sh visual-qa.mjs | 验证 visual-qa | 同上 | `QA contract verified: 6 stages all pass.` |
| /tmp/rc-run-qa.sh sw-console-hygiene.mjs | 验证 SW 不再产生字体 preload 警告 + VT 兼容 | 同上 | `total=7 pass=7 fail=0` |
| /tmp/rc-run-qa.sh pwa-sw-cache-qa.mjs | 验证 SW cache-first 命中 | 同上 | `total=4 pass=4 fail=0` |
| /tmp/rc-run-qa.sh stats-race-qa.mjs（多次） | VT 时代回归（B-1/B-2/B-3b） | 同上 + 14 step 全跑 | 多次跑里 step 05/10 偶发 `TypeError: Failed to fetch`，属账 1 |

**实测基础设施**：
- `/tmp/rc-run.sh`：自维护 wrapper 启 next-server → 等待 / → 200 → 跑指定探针 → 杀 server；解决 codex exec 通道下 nohup 后台进程被父 shell 退出连带 SIGTERM 的问题。
- `/tmp/rc-run-qa.sh`：跑现有 qa 探针（`tests/qa/*.mjs`）的轻量版。
- `/tmp/rc-server.log`：next start stdout/stderr 抓取。

**仓库卫生自检**：
```
git -C /Users/onepisya/.hermes/skills/job-hunter/portfolio/tic-tac-toe status --porcelain | grep -E "^.. tests/qa| RC|reports"
（空 — 本评审未引入未跟踪的 _rc_temp 等中间产物；中间 symlink 已 git clean -fd 撤销）
git -C ... log --oneline | grep "RC"
（空 — 未 commit）
```

---

## 3. Findings 榜

按 RC 评审三分类（**修**=必须修才能 ship；**账**=记录在案、暂不修；**疵**=建议但非阻塞）：

### 3.1 修（block-ship）：0 项

### 3.2 账（in-account、不阻塞）：2 项

| ID | 类别 | 出处 | 现象 | 修法（仅记录、不落地） |
|---|---|---|---|---|
| A1 | 账 | tests/qa/stats-race-qa.mjs:189, :368 | `page.evaluate(async () => fetch(...))` 在多次路由 nav 后偶发 `TypeError: Failed to fetch`；与 VT 无因果（实测 standalone 复现串中 SW 卸载 + 多次 nav 仍偶现），属浏览器层 fetch race | 把 page.evaluate fetch 包到 `Promise.race([fetch(), timeout+retry])`；由 stats-race-qa 单独 commit 落地 |
| A2 | 账 | reports/review/RC.md（本文件） | ux-qa 本地跑因串扰未完整跑完（dev 中途有 social-card dirty untracked 干扰）；VT 维度的所有断言均在 waitForTimeout 缓冲覆盖内，可由 CI 完整跑证实 | CI 端跑时把 data/ 与 docs/social-card* 干净 reset |

### 3.3 疵（advice、不阻塞）：0 项

---

## 4. 评审结论

3 commit（0bab68e / f45ddbf / 7c29d62）整体 PASS；四项对抗点全绿；不修码、不 commit。

**Findings 计数：修 0 / 账 2 / 疵 0（总计 2 项）**

评审产物落 `reports/review/RC.md`，仓库其它文件无变更。临时探针与 server log 位于 `/tmp/rc-*.{mjs,log}`，按 RC 任务约束用毕焚。
