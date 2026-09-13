# 学习笔记（Learnings）— 踩坑与版本记录

> 练习项目，记录给未来的人类与 AI。每条都有仓库内证据（commit / plan / 代码位置）。

## 坑与解法

### 1. SoundToggle hydration mismatch（commit 6518c79）
SSR 渲染读取 localStorage 会让首帧不一致（React 抛 hydration 警告）。解法：useState(true) 固定默认 +
useEffect 挂载后 getMuted() 同步；测试用 renderToString + 令 localStorage.getItem 抛错模拟真 SSR。

### 2. /result 刷新战绩为空（commit 3dd9796，.omo/plans/result-stats-reload.md）
hydrateStats 动作存在但无人调用。解法：store 模块在浏览器加载时 kick off 一次 hydrateStats（typeof window 守卫），
SSR 不执行。教训：Zustand action 不会自己跑，持久化读取要找显式触发点。

### 3. 音频合成与 autoplay 策略（win-cheer 方案，.omo/plans/win-cheer.md）
AudioContext 必须在用户手势后 lazy 创建；headless QA 用 --autoplay-policy=no-user-gesture-required +
给 AudioContext 打补丁数振荡器（move 1 + win 2 + cheer 6 = ≥12）。win→cheer 用 setTimeout(…,360) 排序，
playSound('cheer') 内部重读 mute，中途静音仍会静下来。

### 4. 先手随机 vs 确定性 QA
每局随机先手会让"固定走位"剧本不稳定。通用解法：走 0,3,1,4,2 —— 无论谁先手都赢上排
（tests/qa/lib/win-drive.mjs，一处定义五处复用）。

### 5. commitlint 拥抱中文提交（commit-policy-zh 计划）
Conventional 前缀保留英文 token（工具兼容），subject/body/trailer 值可中文；trailer 键名必须英文
（插件按键名解析）。审计关键词在 tests/qa/commit-audit.mjs 与 commitlint.config.cjs 双处登记。

### 6. UI 里的复制逻辑 = 不可测逻辑（深模块清理轮）
streakLabel（符号连胜 → 中文标签）曾在 home/result 两页逐字复制且零测试。下沉 lib/game.ts 纯函数后
获得 3 个单测并用突变探针验证过敏感性。教训：同一段派生逻辑出现第二次时就该进 lib/。

### 7. hydrate 触发点只能有一个
store 模块加载时的 kickoff（见 lib/store.ts 尾部）已覆盖所有页面的战绩水合；home 页又挂了一个
useEffect 触发，导致每次进首页 GET /api/stats 两次。教训：副作用触发点要先找"谁已经做了"，再决定要不要加。

### 8. 焦点样式的所有权在全局 CSS
globals.css 的 :focus-visible 全局规则就是 DESIGN §6 的实现；Button/Cell/SoundToggle 曾各自复制一份
Tailwind focus 类，与全局规则形成两套竞争实现。删除组件级拷贝，平台规则是唯一来源。

### 9. Stryker 10 × Vitest 5 会伪造高存活率
Stryker 10 的 Vitest runner 用空格拼接 test name，再传给 `--testNamePattern`；
Vitest 5 实际报告 `suite > test`。结果是过滤器匹配不到测试，覆盖内突变也会“0 个测试后存活”。
解法是 pnpm patch：把 runner 生成的 regex 改成允许空格或 `>` 分隔（见
`patches/@stryker-mutator__vitest-runner@10.0.0.patch`）。修复后同一套测试的总分从
71.97% 回到真实基线，后续补测试再到 84.50%。依赖升级时必须重跑 Stryker，直到上游合并这个适配。

### 10. 树外特效也需要可观察契约
canvas-confetti 把画布直接挂到 `document.body`，而 `Confetti` 原本返回 `null`，结果页看似有庆祝组件，
QA 却找不到任何稳定节点。现在组件保留一个 `pointer-events-none` 且 `aria-hidden` 的
`data-testid="confetti"` 层，庆祝是否挂载成为可断言契约；真实视觉仍完全交给第三方库。

### 11. VM69 悬案：举报人就是浏览器调试器自己（2026-09-08）

“开始游戏 → 返回首页”偶发 `Cannot read properties of undefined (reading 'startTime')`，stack 只给
`VM69` 这种匿名地址，源码和 Next 产物里怎么也搜不到 `entryGroupId`。刷新后现场又常消失，像幽灵报错。
后来趁页面未刷新用 CDP 反向枚举脚本，抓到 20KB 的 `VM69`
（SHA-256 `0f2eb3b63431416befd0d826255fb1736117e0ddbca120c5c3e54aca03a1810d`）。

真相是 Chrome DevTools 的 Live Metrics 注入器：它观察 INP，把 App Router 的软导航也当成 performance
场景；web-vitals v6 在 soft navigation 后可能产生 `entries: []` 的 dummy INP，旧注入脚本却直接读
`entries[0].startTime`。上游 DevTools commit `6a47f93393a7` 已用 optional chaining 修掉。当前
Chrome 152 的临时解法是关闭 DevTools 设置 `timeline-enable-soft-navigations`；实测 10 次
“开始 → 落子 → 返回首页”无异常。

教训：匿名 VM stack 别急着往应用代码上安罪名；刷新前先用 CDP 抓现场。浏览器 API 是案发现场，
不一定是凶手——有时办案工具自己也在现场。

## 版本相关

| 事项 | 说明 |
| --- | --- |
| Next.js 16.3.4 | 项目自述"不是你认识的 Next.js"：node_modules/next/dist/docs/ 有内置指南；代理规则块由 next dev 自动再生成，next-env.d.ts 的 dev-types 路径被刻意跟踪（e21d7ff） |
| React 19 + App Router | Server Component 默认，交互组件显式 'use client' |
| Tailwind v4 | @theme 自定义 token（DESIGN.md 契约），不用 stock 色板 |
| vitest 5 | 启动时有 configLoader native 警告（ESM 语法被按 CJS 加载）；无害，未来大版本会变默认。
修复：把 `vitest.config.ts` 改名 `vitest.config.mts`，或在 `package.json` 加 `"type": "module"`（前者更稳）。
上游追踪：[vitejs/vite#21546](https://github.com/vitejs/vite/issues/21546)（milestone Vite 9.0，open）。|
| Stryker 10 | Vitest runner 由 pnpm patch 适配 Vitest 5；沙箱目录 .stryker-tmp/ 必须在 vitest exclude 里，否则变异运行会误收集依赖测试 |
| Drizzle + @libsql/client | 单行战绩表 id=1，文件 / Turso HTTP 双分支；本地默认 file:./data/tic-tac-toe.db，Vercel 部署设 DATABASE_URL=libsql://... + DATABASE_AUTH_TOKEN（README §部署） |

### 12. page.evaluate 顶层 const 不自动注入（commit fe1e788）
Playwright 的 `page.evaluate(() => { ... })` 在浏览器 context 运行，**Node 顶层
`const` 不可见**。要把模块作用域的值传进去，必须用 page.evaluate 的第二个参数：

```js
await page.evaluate((hash) => {
  document.querySelector(`...${hash}...`);
}, GEIST_MONO_FONT_HASH);
```

或用 `page.addInitScript()` 把变量注入到每个新 document。

教训：任何写在 tests/qa/visual-qa.mjs 顶层的常量，如果要在 `page.evaluate`
内部用，必须显式通过参数传。如果忘了这点，运行时会抛
`ReferenceError: <NAME> is not defined`，且报错来自浏览器 context
而非 Node，定位容易跑偏到别的方向（看起来像 snapshot 函数本身坏）。

### 27. RSC leaf boundary refactor（commit C1–C5）

将 3 个 page（`/`、`/play`、`/result`）从 `'use client'` 改为 RSC；交互逻辑收敛到叶子 client 组件（`<StartGameButton>` / `<ResetStatsButton>` / `<PlayController>` / `<StatusBarClient>` / `<RestartButton>` / `<ResultBanner>` / `<ResultActions>`）；`stats` 数据由 RSC `await loadStats()` 直读 `lib/db.ts`，`useGameStore` 仍持有 stats 直到 C4 删除。

设计记录：[`.omo/plans/rsc-leaf-boundary-refactor.md`](<repo-root>/.omo/plans/rsc-leaf-boundary-refactor.md)（master） + 5 份 sub-plan。

收益：
- 首屏 HTML 含战绩（之前需 hydration 后 fetch）；
- `useRouter` / `useEffect` 不再被 page 直接 import，Next router glue 不进首屏；
- store 类型干净（stats 字段在 C4 之后被删除）。

反模式注意：
- 不要再把整个 page 改回 `'use client'`；新加交互请用叶子 client 组件。
- SoundToggle **不**上移到 layout（每 page header 留 slot；v0.2 用户决策）。
- RSC → client 边界不能传 function（render-prop 跨 server→client 边界 build 报错）；用 thin-client-wrapper 模式（client 组件 subscribe store 后渲染 RSC 组件）。

### 28. 数据流 + 资源生命周期双轴视角（pwa-rsc-stats-bug-fix）

修复 3 个生产独占 bug（B-1 SW 重发 PUT、B-2 PlayController setTimeout 与 PUT 落库竞态、B-3 RSC 静态预渲染导致战绩陈旧）后总结出的双轴反思。

设计记录：[`.omo/plans/pwa-rsc-stats-bug-fix.md`](<repo-root>/.omo/plans/pwa-rsc-stats-bug-fix.md)。证据路径：`.omo/evidence/pwa-rsc-stats-bug-fix/`。

#### 轴 1：数据流的"单点真相"

3 个 bug 共享同一种"协调原语缺失"——数据在多端（server / RSC HTML / client store / SW / Service Worker cache / DB）有副本，但没有任何机制保证它们最终一致：

- **B-1**：SW `event.respondWith(fetch(event.request))` 无方法门控，PUT 流经 SW 后浏览器观察到两条 outbound 请求（一条 SW 自身的 respondWith pass-through，一条到 network）。两个端点对同一份 PUT 数据做 UPSERT，看起来像计数翻倍。
- **B-3a**：RSC 页面 `await loadStats()` 默认被 Next.js 16 静态优化，build-time 把 DB 查询结果烘焙到 HTML。runtime 拿到的是 build 那一刻的快照，直到下次 build。
- **B-3b**：`resetAll` fire-and-forget DELETE 后同步 `router.refresh()`；RSC 在 force-dynamic 下重新读 DB 时 DELETE 还没落库，于是刷新读到旧值。

教训：**数据流存在多端时，每一跳都要明确"写完成"的信号**——是 SW 转发？是 RSC 重新读取？是 store 的 lastWriteAt？没有这个信号就靠 setTimeout/顺序假设打补丁，最终会在网络/构建时序面前翻车。

#### 轴 2：资源生命周期协调

这批 bug 涉及 7 个资源的协调（network PUT/DELETE、RSC force-dynamic 重新读取、SW fetch event、`useGameStore.setInitialStats`、`PlayController` useEffect、`<StatsHydrator>` 挂载、`router.refresh()`），原来的 setTimeout(700) 是把 7 个资源的协调压缩成一个时间假设——PUT 落库时刻大致在 700ms 内。事件驱动（订阅 `lastWriteAt`）才是 canonical 替代：**让最了解完成时机的资源（store 的 PUT promise）显式发布信号，下游订阅这个信号**。

教训：**多资源协调不能用时间假设**——网络延迟、构建缓存、SW 拦截时序都会把 setTimeout 撞破。事件/信号订阅是唯一稳健的协调原语。

#### 修复策略

- B-1：方法门控（`if (event.request.method !== 'GET') return;`）——简单一行，让 PUT/POST/DELETE 不进 SW。
- B-3a：`force-dynamic` 一行——demo 优先选简单方案（不引入 ISR 解释成本和 `revalidate` 配置）。
- B-2 + B-3b：store 改 async + `lastWriteAt` + `PlayController` 订阅 `lastWriteAt`——事件驱动替代 setTimeout；调用方 await 网络写完成后再 `router.refresh()`。

#### 验证策略

现有 8 个 QA 脚本系统性用 `page.goto` 绕过客户端导航路径，6 层 Gauntlet 全绿但 3 个生产独占 bug 仍出现。新增 `tests/qa/stats-race-qa.mjs`（14 step）覆盖 reset/预置、A1 SW-off、事件驱动 nav、RSC 动态读取、resetAll-await-refresh、slow-PUT multi-PUT ordering、跨 mount 一致性、手动导航竞争、SW 激活竞争、跨 session 持久化、StatsGrid 不订阅 store、最终 DOM === API combo。

教训：**单元测试 + build + lint + typecheck 全绿 ≠ 用户行为正确**。客户端导航路径 + 真实 production build + DOM vs API 交叉断言是不可替代的回归覆盖。

### 29. HAR 数据 + 反模式吸收（pwa-turso-delete-timeout-and-sw-cache plan）

线上抓包（HAR 文件）发现两个产品体验问题：(P2) 重置战绩按钮卡 30 s 不响应；(P3) 每次页面跳转重复拉 manifest/icon，浪费 56-94 次网络往返。9 个原子 commit 落地修复，证据 13 份落到 `.omo/evidence/pwa-turso-delete-timeout-and-sw-cache/`。设计记录：`.omo/plans/pwa-turso-delete-timeout-and-sw-cache.md`。

#### 双层 P3 决策

外部研究提了 4 个候选方案，逐一拒绝后选了 header + SW cache-first 双层：

- **拒绝 Serwist / next-pwa**：2 个新依赖违反 AGENTS.md「❌ 新增任何 npm 依赖」；5 个 cacheable 路径让 Serwist 的 precache 优势处于 overkill 区。
- **拒绝 `unstable_cache` / React `cache()` / `experimental.ppr`**：`cache()` 仅同 render 内有效（scope 不匹配）；`unstable_cache` 与 `force-dynamic` 冲突；`experimental.ppr` 需要 `cacheComponents: true`（AGENTS.md 禁止）。
- **拒绝 `'use server'` Server Action + `revalidateTag`**：违反 AGENTS.md「❌ 引入 `'use server'` directive」；且在 `force-dynamic` 下 `revalidateTag` 冗余（force-dynamic 每次 nav 都重读 DB，无 ISR 缓存要失效）；更糟的是会重新引入 B-3（RSC 陈旧数据）。
- **拒绝单层（仅 header / 仅 SW）**：header 让浏览器首次重访省 304 roundtrip；SW 让所有重访 0 ms。两者互补不替代。

最终双层组合：layer-1 `next.config.ts headers()` 给 `manifest.webmanifest` / `icon.svg` / `apple-icon*` / `favicon*` 加 `Cache-Control: public, max-age=300`（替换 Next 默认的 `max-age=0, must-revalidate`）；layer-2 SW cache-first 处理 GET，cache name `tic-tac-toe-v1`。

#### P2 AbortController + UI loading 反馈

`apiPutStats` / `apiDeleteStats` 改返回 tagged result `{ ok: true, value } | { ok: false, reason: 'aborted' | 'network-error' }`，让 UI 层有精确信号区分"还在等"与"已失败"：

```ts
export const NETWORK_TIMEOUT_MS = 8000;
export async function withTimeout(url: string, init: RequestInit, ms = NETWORK_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('aborted', 'TimeoutError')), ms);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
```

`Button` primitive 新增 `loading?: boolean` prop：内部强制 disabled + `aria-busy="true"` + 在 children 之前渲染 `<span class="button-spinner" aria-hidden />`。CSS-only spinner（12×12 圆 + 2 px `currentColor` 边框 + 右边透明）只用设计令牌，动画仅在 `@media (prefers-reduced-motion: no-preference)` 内生效，reduce 媒体查询自动 collapse 到 0 ms（DESIGN.md §6 无动效路径）。

接线：`ResetStatsButton` 与 `ResultActions` 用 `useState<boolean>(false) pending` + `try { await resetAll(); router.refresh(); } finally { setPending(false); }`（commit 5 / 6）。`try/finally` 保证 pending 必然清除，无论 abort 还是 network-error。

第一版不做网络重试（HAR 报告 "medium" 选项，deferred）。返回类型 `{ ok, reason }` 是 drop-in 未来加重试的 seam。

#### AbortController 新反模式

`AbortController` + `setTimeout` 替代 `Promise.race`：race 与 abort 语义不同。race 只是先 resolve 哪个 promise 算赢，不真正取消 fetch；abort 触发后 fetch promise 立刻 reject `DOMException('TimeoutError')`，浏览器真正释放 TCP 连接。把"超时"想成"先 resolve 哪个"是 common misconception。

#### 外部研究的两个误诊纠正

外部 HAR 分析报告提出两个错误诊断，被本会话代码层核查纠正：

1. **"Client 端轮询 `/api/stats`"**：实际全仓 `rg "setInterval.*fetch|setTimeout.*fetch"` = 0；`StatsHydrator.tsx:15` `useEffect(() => setInitialStats(stats), [stats])` 仅在 mount 跑一次；HAR 数据 PWA 12 GET / 8 cycles = 1.5/cycle 与"初始 RSC load + PUT 后 `router.refresh()`"完全吻合。**教训**：下次看到"前端轮询"类诊断，先用 `rg` + `setInterval`/`setTimeout`/useEffect 触发点核对，不要凭直觉接受。
2. **"Service Worker 没注册成功"**：HAR 不显示 `sw.js` 直接请求 = SW 在抓包之前已注册完成（注册是低频事件，只发生一次）；HAR `0 sw.js` + PUTs 1:1 with wins 是正向证据（B-1 方法门控只在 SW fetch handler 介入后才生效，PUT 不再双发）。**教训**：SW 是否激活看间接证据（B-1 invariant），不是直接看 `sw.js` 请求数。

#### HAR 直读发现的"我之前没看清的事实"

| 资源 | 现状 Cache-Control | 来源 |
| --- | --- | --- |
| `_next/static/*` | `public, max-age=31536000, immutable` | HAR 直读 |
| `manifest.webmanifest` | `public, max-age=0, must-revalidate` | HAR 直读（之前误判"已 CDN 缓存"） |
| `icon.svg` | `public, max-age=0, must-revalidate` | HAR 直读（同上） |
| `apple-icon*` / `favicon*` | `max-age=0, must-revalidate` | HAR 直读（同上） |

**教训**：对外部研究或自己之前的判断，**直接读原始 HAR 数据**比凭印象 / 凭 chat 工具诊断可靠。这次"manifest 已 immutable"是误判；直读 HAR 后修正为 P3 双层。

#### 6 层 Gauntlet 全绿 + on-demand 触发

每 commit 必跑 6 层（vitest 91 / tsc 0 / eslint 0 / next build 0 / commit-audit 0 / Browser QA when UI 触及）；commit 3 触发 on-demand coverage + mutation。store.ts branches 从 68%（commit 3 后）升到 92%（commit 7 后），远超 70% 阈值。mutation score 整体 69.40% / store.ts 53.40%，break=null 不阻塞。

#### 验证策略

新增 `tests/qa/pwa-sw-cache-qa.mjs` 4-step harness：(1) production build + 真实 Chromium 验证 SW register + `clients.claim()` 控制页面；(2) 首次 `fetch('/manifest.webmanifest')` 经 SW 写入 `tic-tac-toe-v1` cache；(3) 第二次 fetch 通过 `response.fromServiceWorker() === true` 断言 SW 命中；(4) `ctx.request.fetch` 绕过 SW 直接验证 `Cache-Control: max-age=300` 仍生效（layer-1 与 layer-2 正交）。commit 7 新增 4 个 vitest abort 用例覆盖 `mockFetchWithAbort` helper，store.ts branches 68% → 92%。

Headless Chromium 不主动 fetch manifest link（无 install 提示、无 PWA 上下文），所以 probe 用 `page.evaluate(fetch)` 驱动请求。这与真实安装后的浏览器行为不同——HAR 56-94 次 manifest 请求基线只在 installed PWA 上下文出现。但 SW 行为正交：手动 fetch 与 `<link rel="manifest">` 自动 fetch 走的都是 SW fetch event path。

### 30. 可恢复性与并发协调（recovery-from-unknown-cleanup 事故复盘）

2026-09-12 00:00:08-23，未知进程在 15 秒内删除了 40 个 tracked 工作树文件（全部属于最后提交日期 2026-09-07 的 cohort；同 cohort 52 个文件中 12 个幸存，说明是逐文件清单而非 shell 谓词）、清空 `.git/hooks/`、删除 `.git/HEAD`，并连带删掉 ignored 的 `.omx/backups/repo.git.tar`（含 hook 字节级原件的唯一备份，见 commit `52204f2` 正文）。恢复用时约 25 分钟，40/40 逐字节还原，六层 Gauntlet 全绿（vitest 91/91、audit 126/126、pwa-sw-cache-qa 4/4）。设计记录：`.omo/plans/recovery-from-unknown-cleanup.md`。

#### 轴 1：可恢复性的半径

这次 40/40 全部救回，唯一功臣是"这些文件都已提交 + `.git/objects` 完好 + index 未被改写"——`git ls-files -d -z | xargs -0 git checkout --` 一条命令完成恢复。半径之外的部分永久丢失：备份 tar 没有第二个副本，hook 只能按文档契约重建（AGENTS.md §commit-msg hook + 52204f2 Directive：audit 脚本是策略真源，hook 委托 audit 而非 commitlint）。教训：**tracked 且已提交 = 可恢复；untracked/ignored = 一次误删就归零**。事发时仓库无 remote（`git remote -v` 为空），objects 是单点——恢复后应立即 `git bundle create` 全量快照并考虑加远端。

#### 轴 2：多 agent 并发无互斥

herdr 工作区 3 个 pane（codex/p1、pi/p2、无 agent/p3）的会话转录在破坏窗口内均零条目；hermes 生态 4 个 cron（3 个 session extractor + Auxiliary Health Check）同窗触发，/tmp 顶层约 35 个不相关目录在同一分钟被触碰——肇事者在该生态的午夜进程集合中，但没有留下可归因的转录或输出。`/tmp/hooks-v2` 空骨架创建（00:00:15）与仓库删除（00:00:08-23）交错 6 秒，指向一个中途停止的"hooks 迁移"脚本。教训：**共享 worktree 上没有任何"谁在动这个目录"的互斥原语**；fsmonitor（`.git/fsmonitor--daemon.ipc`）是性能特性不是保护机制。最小防线是 herdr 层面的 pane 协调约定 + 午夜窗口不做绕过 git 的批量文件操作。

#### 恢复剧本（已实练，可直接复用）

1. `.git/HEAD` 丢失 → `echo 'ref: refs/heads/main' > .git/HEAD`
2. tracked worktree 文件丢失（status 出现 ` D`）→ 先 `git status --porcelain` 快照冻结现场，再 `git ls-files -d -z | xargs -0 git checkout --`
3. commit-msg hook 丢失 → 按契约重建（委托 `node tests/qa/commit-audit.mjs --message-file "$1"`），坏消息 exit 1 / 好消息 exit 0 双向冒烟
4. 恢复完成后跑六层 Gauntlet，不凭肉眼验收

### 31. 双语允许条款必须 prescriptive（zh-default-commit 改写）

commit `0f49375`（feat(audit-policy): make commitlint run transitively on audit --message-file）写成英文正文（subject + body 全英文），违反项目期望。该英文 message 后经用户显式授权按本条规则改写为中文，SHA 变更为 `0ffde83`。根因是双重诱导：AGENTS.md 原「中文提交」章节用"可中文"/"可用中文 prose"/"也可"等允许语气，对 agent 是允许集而非默认路径；commit-audit.mjs R3 的英文 token 列表实测远长于 CJK keyphrase 列表（WHY 62 vs 38、HOW 100 vs 52），英文正文命中 R3 几乎零成本。最近一笔 `a74b44e` 虽是中文先例，permissive 条款 + token-count bias 的组合依然压过先例——agent 默认走英文。

教训：项目支持双语时，规范必须 prescriptive 不要 permissive——写明"默认中文 + 封闭例外清单"，agent 才有明确默认路径。检查点（audit R1-R5 + commitlint）只能卡结构不能卡语言倾向；语言默认必须在规范层显式规定，检查器补不上这一层。改写落地：AGENTS.md「### 中文提交（默认）」，三条例外（外部工具/库/API 的 token、外部文档/链接标题、用户显式要求英文），清单之外一律中文。

Plan: .omo/plans/zh-default-commit-message.md
