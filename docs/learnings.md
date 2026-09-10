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

设计记录：[`.omo/plans/rsc-leaf-boundary-refactor.md`](/private/tmp/tic-tac-toe/.omo/plans/rsc-leaf-boundary-refactor.md)（master） + 5 份 sub-plan。

收益：
- 首屏 HTML 含战绩（之前需 hydration 后 fetch）；
- `useRouter` / `useEffect` 不再被 page 直接 import，Next router glue 不进首屏；
- store 类型干净（stats 字段在 C4 之后被删除）。

反模式注意：
- 不要再把整个 page 改回 `'use client'`；新加交互请用叶子 client 组件。
- SoundToggle **不**上移到 layout（每 page header 留 slot；v0.2 用户决策）。
- RSC → client 边界不能传 function（render-prop 跨 server→client 边界 build 报错）；用 thin-client-wrapper 模式（client 组件 subscribe store 后渲染 RSC 组件）。
