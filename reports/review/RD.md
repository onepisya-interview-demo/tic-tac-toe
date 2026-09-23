# RD · Review-only audit · 2026-09-15

**分支 / 模式：** main · RD（read-only，禁写禁 commit，禁 apply_patch 已遵守，全程 exec_command + read）
**范围：** a8a7063 / 7c29d62 / 02c654d / d8329a4 / f8fd69e 五码 + tests/qa/stats-race-qa.mjs（515L）/ hydration-check.mjs（97L）全貌 + README.md ↔ README.en.md 逐段 diff + docs/screenshots/{home,board,result,solo}.png sips 尺寸 + tests/qa/solo-mode-qa.mjs（238L，对照范本）。
**teach-back：** 范围如上；产出 = 本文件（findings 榜 修/账/疵 + file:line + 修法 + 六项判定表 + 尾部计数）；零文件写入仅本 `reports/review/RD.md`、零 commit。
**等级化：** 修 = 必须修；账 = 记账（知情可继续）；疵 = 文档/工艺缺陷（可独立后续 PR）。

## 1. 六项判定表

| # | 对抗点 | 判定 | 等级 | 证据（file:line） |
|---|--------|------|------|--------------------|
| 1 | a8a7063 — STEP 10 `waitForResponse` 谓词唯一 + 注册-后-点击时序 + 超时上限 | PASS · 1 账项（超时未显式） | 账 | [tests/qa/stats-race-qa.mjs:349-358](tests/qa/stats-race-qa.mjs) |
| 2 | 7c29d62 — 2000 ms 轮询 vs VT enter ~400 ms + `assert.fail` actual 保留 | PASS | — | [tests/qa/hydration-check.mjs:65-83](tests/qa/hydration-check.mjs) |
| 3 | 双 `launchQA` 旧疵（文件顶 + 首步各 launch 一次，各取一弃一） + 资源泄漏 | **FAIL · 修级** | 修 | [tests/qa/stats-race-qa.mjs:67-68, 503, 509](tests/qa/stats-race-qa.mjs) |
| 4 | README 双语一致 + 四图 alt 对应 + /solo 描述真伪（零服务端写 / localStorage / 离线可计） | PASS · 1 账项（PNG 无再生脚本） | 账 | [README.md:36-50, 75](README.md) ↔ [README.en.md:40-56, 75](README.en.md)；[lib/store.ts:254-262](lib/store.ts)、[components/SoloStatsPanel.tsx:10-19](components/SoloStatsPanel.tsx)、[tests/qa/solo-mode-qa.mjs:118-141](tests/qa/solo-mode-qa.mjs) |
| 5 | 截图 vs 真实 UI 等价（production build、1280×900 桌面视口、visual-qa 第 7 阶） + sips 尺寸一致 | PASS · 1 账项（社卡四图未重制，commit 02c654d 自报待办） | 账 | `sips -g` 4/4 = 1280×900；[tests/qa/visual-qa.mjs:138-144](tests/qa/visual-qa.mjs) |
| 6 | d8329a4（herdr v2.1） / f8fd69e（solo-stats 文档）事实一致性 | PASS | — | [docs/herdr-session-hygiene.md:17-18](docs/herdr-session-hygiene.md)；[.omo/plans/ulw-solo-mode-split-view-transitions.md:124,128-129](/Users/onepisya/.hermes/skills/job-hunter/portfolio/tic-tac-toe/.omo/plans/ulw-solo-mode-split-view-transitions.md)；[components/AGENTS.md:29](components/AGENTS.md)、[lib/AGENTS.md:11](lib/AGENTS.md) ↔ [lib/solo-stats.ts](lib/solo-stats.ts)、[components/SoloStatsPanel.tsx:5](components/SoloStatsPanel.tsx) |

## 2. Findings 榜

### F-01 · 【修】stats-race-qa.mjs 67-68 双 `launchQA` 致 Chromium 实例泄漏 · 修级

**位置：** [tests/qa/stats-race-qa.mjs:67-68](tests/qa/stats-race-qa.mjs)

**现状（按 grep 实证）：**

```
67:  const { browser, ctx } = await launchQA();   // A：browser_A + ctx_A + page_A（page_A 直接丢弃）
68:  let { page } = await launchQA();             // B：browser_B + ctx_B + page_B（browser_B/ctx_B 永不绑定变量）
...
414:  const ctx2 = await browser.newContext(...);  // 复用 browser_A 的 browser 变量开新 ctx_D
...
503:  await ctx.close();                           // 关 ctx_A（A 已于 395 行关过一次，幂等空跑）
509:  await browser.close();                       // 关 browser_A
```

**浪费 / 泄漏量级：**
- **Chromium 实例：** 启动两次（browser_A + browser_B），只用其一。**browser_B 永远未关闭，进程残留**直至 Node 主进程退出。Chromium headless 单实例 RSS 100–200 MB 级。
- **Page A：** launchQA 返回 `{browser, ctx, page}`，line 67 仅解构出 `browser`、`ctx`，line 67 内层 page 对象无人接收，但因属于 line 67 的临时返回对象，GC 即可——无泄漏。
- **Context B：** 同上，仅 `page` 被解构，`browser_B` 和 `ctx_B` 立即成为孤儿引用，GC 后句柄消失，但**底层 Chromium 子进程不会随 GC 终止**，OS 子进程残留直到父进程退出。
- **重复页签：** line 414 `browser.newContext()` 才是真正用于 step 12+ 的 ctx2（D），它**复用**的是 `browser` 变量（指向 A），所以 line 67 的 browser 一直在被使用——line 67 的浪费仅在 page_A 被丢弃；line 68 的浪费是完整 chromium_B 孤儿。
- 与其他探针对照（hydration-check / visual-qa / solo-mode-qa / audio-* / pwa-sw-cache-qa 等）：**全部用单 `const { browser, ctx, page } = await launchQA();` 一行起**，仅 stats-race-qa.mjs 67-68 是双 launch 范式。

**修法（最小、行为零变更）：**

```diff
- const { browser, ctx } = await launchQA();
- let { page } = await launchQA();
+ const { browser, ctx, page } = await launchQA();
```

仅改两行，把两个 `launchQA()` 合并成一个，移除掉被丢弃的 page_A / 整组 browser_B&ctx_B。step 11 内 `const { browser: b2, ctx: c2, page: p2 } = await launchQA();`（line 396）保留——那是按设计的中段「关闭老 context / 开新 context」契约，跨 session 持久化断言（cross-session persistence）必须新 context，与本次修复无关。

**判定：** 修（一处明确 Chromium 子进程泄漏，量级 1 个实例 + 1 context + 1 page，~100–200 MB RSS，与 commit-audit 边界一致——属于测试工艺而非产品代码，可下个测试维护 PR 带走）。

---

### F-02 · 【账】a8a7063 `waitForResponse` 未显式 timeout，靠 Playwright 30 s 默认 · 账级

**位置：** [tests/qa/stats-race-qa.mjs:351-354](tests/qa/stats-race-qa.mjs)

```
const deleteSettled = page.waitForResponse(
  (r) => r.request().method() === "DELETE" && r.url().includes("/api/stats"),
);
await page.click('[data-testid="reset-stats"]');
await deleteSettled;
```

- **谓词唯一性：** ✅ `(method==='DELETE' && url.includes('/api/stats'))` 在 step 10 上下文里唯一——step 10 之前没有 DELETE 触发（step 02–09 用的是 POST outcome），reset 按钮只命中 `/api/stats`（不是 `/api/stats/outcome`），不会与其它请求撞车。
- **注册-后-点击时序：** ✅ 标准 Playwright 范式：`page.waitForResponse` 返回 Promise 同步注册监听，再 `page.click` 触发动作；点击事件与响应之间没有窗口期漏掉的概率。
- **超时：** ⚠️ 未传 `{timeout}` 参数，默认 30000 ms。reset 路径客户端 `withTimeout` 已硬限 8000 ms（lib/store.ts:121–135 实证），但服务端 DELETE 偶发 30 s（H-2 §P2），30 s 默认反而更接近真实环境，不是劣势。
  - **风险：** 万一 DELETE 真的卡 31 s+（理论可能），探针会以 Playwright 通用 "Timeout exceeded while waiting for response" 失败，错误信息不指向业务——可读性账项。
  - **建议（账级，可不修）：** 加 `{ timeout: 10000 }` 与 `assert.fail(actual)` 写 actual 响应状态，仿 hydration-check.mjs:62-83 范式。当前不修不阻塞，30 s 默认反而与历史 Turso DELETE 长尾相容。

**判定：** 账。

---

### F-03 · 【账】02c654d 截图无 commit-tracked 再生脚本 · 账级

**位置：** [docs/screenshots/{home,board,result,solo}.png](docs/screenshots/) + commit message `02c654d` HOW 段「result 成品图取同规格 Playwright 疾摄（headline 后 250ms）」。

- **sips 尺寸：** 4/4 全部 1280×900，与 launchQA 默认 `viewport: {width:1280, height:900}` 完全一致 ✅。
- **生产构建等价：** commit message 自报 `pnpm build && pnpm start` + Playwright，BASE_URL 默认 `http://localhost:3000`（launchQA 共享）✅。
- **缺：** visual-qa.mjs 默认 `EVIDENCE_DIR = '.omx/evidence/scaffold-qa'`，**不会**写到 docs/screenshots/。commit 02c654d 提交的 PNG 与 visual-qa.mjs 默认 EVIDENCE_DIR 不在同一路径——即 PNG 由「同规格 Playwright 疾摄」生成，但**该疾摄脚本不在仓内**。commit message 描述 HOW 但未提交脚本，下次 UI 大改时无脚本可复跑。
- **影响：** 截图可能与产品轻微漂移后无人察觉，违背 commit-audit 期望「测试脚本与产物同源」。但本次四图均为视觉交付件，RED-first 难独立证明（视觉非二元）。
- **建议（账级，可独立 PR）：** 把 `docs/screenshots/refresh.mjs` 入仓：BASE_URL+viewport+shootTo(docs/screenshots/)+ 复跑 visual-qa 7 阶。下次截图重制时一键复现。
- **社卡** `docs/social-card-*.png`：commit 自报「系一次性手工合成（仓内无再生脚本），本次不动，列汇报待办」——同样的账项，已知未跟踪。

**判定：** 账（不在 a8a7063 / 7c29d62 / d8329a4 / f8fd69e 范围；仅 02c654d 一处）。

---

### F-04 · 【账】d8329a4 W1/W5 证据链跨文件指向同一 plan · 账级（事实一致性通过）

**位置：** [docs/herdr-session-hygiene.md:17-18](docs/herdr-session-hygiene.md) vs [.omo/plans/ulw-solo-mode-split-view-transitions.md:124,128-129](/Users/onepisya/.hermes/skills/job-hunter/portfolio/tic-tac-toe/.omo/plans/ulw-solo-mode-split-view-transitions.md)。

- 文档声明「pi worker 竣后终态是 done（实证：W1 竣后 agent_status=done 而 `wait --until idle` 超时；W5 同）」。
- Plan 文件实证：W1 ✓ bb171bf + 4f5ec71（C1+C2），W5 ✓ 02c654d（C6）。两次都用 `--until done` 等到的，与文档描述对齐。
- 已知账项：完整「25 min / 30 min 长 wait 被中止」的原始 stderr / herdr transcript 不在仓内——证据强度中等（plan 文字 + 文档断言），未来若 plan 迁移/重写可能追溯断链。当前一致，无新增疵。

**判定：** 账（事实一致，证据链可追溯）。

---

### F-05 · 【账】f8fd69e 文档与代码一致性核查 · 账级（事实一致性通过）

| 文档条目 | 源码实证 | 一致性 |
|----------|----------|--------|
| [lib/AGENTS.md:11](lib/AGENTS.md) `solo 模式浏览器持久化 · solo-stats.ts · load/persist/clear` | [lib/solo-stats.ts](lib/solo-stats.ts) 三导出 + SOLO_STATS_KEY + isGameStats 校验 | ✅ |
| [components/AGENTS.md:29](components/AGENTS.md) 例外「SoloStatsPanel pull-only 读 loadSoloStats」 | [components/SoloStatsPanel.tsx:5](components/SoloStatsPanel.tsx) 仅 `import { loadSoloStats }`，无 `persistSoloStats` / `clearSoloStats` | ✅ |
| 写路径仍在 store | [lib/store.ts:254-262, 285-289, 318-321](lib/store.ts) 三处 `persistSoloStats(internalStats)` / `clearSoloStats()` | ✅ |

无新疵。文档与代码 1:1 对齐。

**判定：** 账。

---

## 3. README 双语 + /solo 真相核查（F-04 / F-05 之外的横向复检）

| 段 | 中文 | 英文 | 一致 |
|----|------|------|------|
| Hero 句 | 「两人同设备 pass-and-play 对战 + 单机练习双模式」 | 「two-player, same-device pass-and-play versus and solo practice」 | ✅ |
| Features 双模式 | 「ranked 对战... 战绩经服务端持久化；solo 单机练习... 战绩存浏览器 localStorage，零服务端写，离线也能完整计分」 | 「ranked — ... scores persist server-side; solo — ... scores live in browser `localStorage` with zero server writes, so scoring works fully offline」 | ✅ |
| Routes `/solo` | 「3x3 棋盘 + 单机战绩面板 + 清空本地战绩（零网络写）」 | 「3x3 board + local stats panel + clear local stats (zero network writes)」 | ✅ |
| 目录树 `solo/page.tsx` | 「单机练习页 (Server Component)」 | 「solo practice page (Server Component)」 | ✅ |
| Preview 表四列 alt | 首页 / 对局 / 结算（胜局彩纸） / 单机练习 | Home / Play / Result (win confetti) / Solo practice | ✅ 中英四列一一对应 |
| 新增「页面过渡」条目 | 「React 19 `<ViewTransition>` 双向 crossfade，旧浏览器自动降级」 | 「React 19 `<ViewTransition>` as a bidirectional crossfade; older browsers fall back」 | ✅ |
| 「离线能玩」FAQ | ranked：「离线时玩的一局战绩会丢」；与 `/solo` 段不冲突——FAQ 答的是 ranked 路径 | 同 | ✅ |

**/solo 真实行为复检（commit f8fd69e 收尾）：**
- [app/solo/page.tsx:12](app/solo/page.tsx) 注释「Solo practice route. Composition only — the page is a Server Component」——无 API 写入。
- [lib/store.ts:254-262](lib/store.ts) `if (s.mode === 'solo') { persistSoloStats(internalStats); ... }` —— 写路径仅 `persistSoloStats`，零 `withTimeout('/api/stats/...')`。
- [components/SoloStatsPanel.tsx:5](components/SoloStatsPanel.tsx) 仅 import `loadSoloStats` —— 只读。
- [tests/qa/solo-mode-qa.mjs:118-141](tests/qa/solo-mode-qa.mjs) step 03 断言 `soloWriteCount === 0` 已在 baseline 跑通（commit message Tested 段声明 6/6 PASS）—— 探针层面独立证实。
- README 称「离线也能完整计分」准确——solo 路径零网络，关闭 WiFi 仍可走棋、累计、本地刷新。**无夸大**。

**判定：** 通过。

---

## 4. 截图 vs 真实 UI 等价核查（F-03 同源）

| 文件 | sips pixelWidth | sips pixelHeight | launchQA 默认 viewport | 路径来源 |
|------|-----------------|------------------|-------------------------|----------|
| home.png | 1280 | 900 | `{width:1280, height:900}` | commit 02c654d 重制 |
| board.png | 1280 | 900 | 同 | 同 |
| result.png | 1280 | 900 | 同 | 同 |
| solo.png | 1280 | 900 | 同 | 同（新增） |

- 视觉契约等价：base 路径 `BASE_URL = http://localhost:3000`（production server，非 dev）— `lib/browser.mjs:6` `BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'`，`launchQA` 默认 viewport 1280×900，4 张 PNG 一致。
- 「ranked 真实 UI 走完 5 阶段 + 新增 solo 第 7 阶段」：[tests/qa/visual-qa.mjs:138-144](tests/qa/visual-qa.mjs) 第 7 阶 `await page.goto('/solo')` → 等 board + solo-stats → 等 200 ms → `shoot('06-solo.png')`，与 committed docs/screenshots/solo.png 同规格。
- 已知 trade-off（commit 02c654d WHY 段）：result 成品图取「headline 后 250 ms 疾摄」而非走 visual-qa 原时序（waitForURL + selector + 300 ms）——彩纸粒子已散，**观感与旧 result.png 不同**（commit 自承）。**但 PNG 仍真实反映 production 服务渲染状态**，非伪造。
- 修法：见 F-03（建 `docs/screenshots/refresh.mjs` 入仓，把疾摄脚本固化）。

**判定：** 通过。

---

## 5. 未发现疵（none-of）

- a8a7063 桥接 listener POST 分支：谓词 `(method==='POST' && url.endsWith('/api/stats/outcome'))` 唯一，line 419-426，桥接到原 PUT 计数并行的 swPostCount 计数 [stats-race-qa.mjs:74, 419-426](tests/qa/stats-race-qa.mjs) ✅。
- 7c29d62 轮询 2000 ms vs VT enter ~400 ms：5× 余量充足，poll-default interval 默认即可，无需显式 polling interval [hydration-check.mjs:62-83](tests/qa/hydration-check.mjs) ✅。
- 7c29d62 `assert.fail(actual)`：`catch` 块读 `aria-label` 当前值入消息，失败可诊断 ✅。
- 02c654d 双语 preview 表扩四列 alt：「首页 / 对局 / 结算（胜局彩纸） / 单机练习」 ↔ 「Home / Play / Result (win confetti) / Solo practice」列名 + alt 全对应 ✅。
- d8329a4 协议命令字面：`herdr agent wait <name> --until done --timeout <T/5>` 与 herdr CLI 现行语法对齐（project 既有 dispatcher-roles-retrospective.md §4 同款引用）✅。
- f8fd69e 例外条目：「写路径仍在 store」与 store 三处 persistSoloStats/clearSoloStats 实点一一对齐 ✅。

---

## 6. 修法清单（按优先级，仅 RD 列项，不修不 commit）

| # | 等级 | 修法 | 落点 | 影响面 |
|---|------|------|------|--------|
| F-01 | 修 | 把 [stats-race-qa.mjs:67-68](tests/qa/stats-race-qa.mjs) 双 `launchQA` 合并为 `const { browser, ctx, page } = await launchQA();`；删除被丢弃的临时 page / 孤儿 browser_B | tests/qa/stats-race-qa.mjs · 1 commit | 修 1 个 Chromium 子进程泄漏 |
| F-02 | 账 | （可选）`waitForResponse(..., { timeout: 10000 })` + `assert.fail(actual)` 提升可诊断性 | tests/qa/stats-race-qa.mjs · 1 commit | 不阻塞；与现有 30 s 默认功能等价 |
| F-03 | 账 | 新增 `docs/screenshots/refresh.mjs` 入仓，复跑 visual-qa 7 阶 + 疾摄到 docs/screenshots/ | docs/screenshots/refresh.mjs · 1 commit | 截图再生脚本可复现 |

---

## 7. findings 计数

- **修（必须修）：** 1
- **账（记账 / 可后续 PR）：** 4（F-02 / F-03 / F-04 / F-05）
- **疵（未发现）：** 0
- **PASS 判定点：** 6 / 6 全通过（含账项容差）
- **FAIL 判定点：** 1（修级，F-01 双 launchQA 资源泄漏）

合计 **5 项 findings（1 修 + 4 账 + 0 疵）**，六项对抗点 5 项 PASS + 1 项 FAIL（修级）。
