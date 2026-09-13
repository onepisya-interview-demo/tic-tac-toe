# favicon-analytics-warnings - 工作计划

## TL;DR（写给人看的）
<!-- 写完下面的详细计划后再回填。这里写人话：不要文件路径、不要 todo 编号、不要 wave/agent/tool 名。 -->

**你会拿到：** 浏览器标签和书签里出现井字棋的品牌图标（深色方块 + 青色 X + 粉色 O），移动端浏览器顶部色条与页面底色对齐，Vercel Analytics 控制台开始显示真实访问数据；线上的 build warning（Node engines 自动升级 + pnpm Ignored build scripts `better-sqlite3 / esbuild`）在代码侧全部解决，线上的部署警告中能在代码里解决的部分全部解决，剩下需要 Vercel Dashboard 操作的 5 个部署保护特性被列入人工清单；仓库新建 `docs/verification-gauntlet.md` 作为 6 层 gauntlet + on-demand 规则的 single source of truth，AGENTS.md §验证门禁 加指针。

**为什么这么干：** Next.js 16 把 favicon/icon 抽成 `app/` 下的文件约定、把 viewport/themeColor 从 metadata 拆出来作为独立 export，所以一份提交里同时换图标 + 加 viewport 是同一类「视觉/元数据契约」的改动，回归面一致；Analytics 是另一个独立关注点，单独提交便于回滚；最后一份文档同步把已经解决的项、需要人去 Vercel Dashboard 配置的项、gauntlet 6 层的 on-demand 规则都记清楚——分两文件：`docs/operations.md` 只管部署警告，`docs/verification-gauntlet.md` 是代码层验证规则的 single source of truth（避免双处真相漂移）。

**不会做的事：** 不改任何已有玩法（棋盘、胜负、状态机、API），不改 design tokens，不新增 npm 依赖（`@vercel/analytics` 是用户明确要求且已在 dirty `package.json` 里），不动 Vercel 平台侧的 5 个部署保护特性（需要登录 Dashboard 操作，不在 agent 射程内），不改 AGENTS.md 除 §验证门禁 末尾追加指针段之外的任何其它段；commit 0 不顺手 absorb 其它 dirty `package.json` 改动（`@vercel/analytics` 留给 commit 2）、不升级 pnpm、不新增 npm 依赖、不改 `package.json` 无关字段（scripts / dependencies / devDependencies）。

**工作量：** Short（短）
**风险：** Low —— 只触碰 `app/` 下的布局/图标 + `tests/qa/visual-qa.mjs` + `docs/` 新增一个文件 + AGENTS.md §验证门禁 末尾 ~10 行 + `package.json` 字段 2 处（`engines.node` + `pnpm.onlyBuiltDependencies`，仅 commit 0）；任何一份提交都可独立 git revert。
**值得人工把关的决策：**
- favicon 直接复用 `public/logo.svg` 的旧配色（`#0b0f17` / `#22d3ee` / `#f472b6`），不强行同步到设计令牌里的 `--color-bg-base / --color-player-x / --color-player-o`（旧的色板就是品牌现状，重排超出本次范围）。
- `themeColor` 写成 `'#0A0A0A'` 字面量并在注释里指明它对应的 `--color-bg-base`（Next.js 的 viewport 字段要求字面 CSS 颜色，Server Component 里读不到 CSS 变量）。
- `metadataBase` 用生产域名 `https://3t-tic-tac-toe.vercel.app/`，与 `runtime-cleanup-finalize.md` 的「用户唯一公开入口」决策保持一致。
- 6 层 gauntlet 中 coverage / mutation / property 三层在 `package.json` 已 wire 完脚本但**不在每 commit 闸门里**——本计划所有 commit 在 `Not-tested:` trailer 显式声明 scope 不覆盖本次改动；未来 commit 触及 `lib/`、`db/` 或新增纯函数时按 on-demand 规则启用，并把 trailer 改为 `Tested:` + 触发原因。
- 5 项 Vercel Dashboard 特性全部标 OUT-OF-SCOPE（4 项需 Pro/ Enterprise 计划 + 1 项需用户手动 Connect GitHub Repository）；docs/operations.md §部署 末尾表格给「Dashboard 入口 URL + 一句话理由」作为人工清单。

下一步：在 worker 会话里跑 `$start-work favicon-analytics-warnings` 启动执行。本计划已通过 ulw-plan 审批门禁；执行阶段不重新走面试。

---

> TL;DR（写给机器看的）：Short effort, Low risk. 14 个实现 todo + F1–F4 终验。四份原子提交落在 main：(0) `build(vercel)` 修复线上 build warning（`engines.node` + `pnpm.onlyBuiltDependencies`，`package.json` 字段级改动）；(1) 自有图标 + Next.js 16 viewport/metadata；(2) `<Analytics />` 挂载；(3) docs 双文件 + AGENTS.md 指针（一次性提交 `docs/operations.md` + `docs/verification-gauntlet.md` + `AGENTS.md`）。不新增依赖，不动 app/api/components/lib/db；commit 0 不 absorb 其它 dirty `package.json` 改动（`@vercel/analytics` 留给 commit 2）。

## 范围
### 必须有
- **commit 0 修复线上 build warning（`package.json` 字段级改动）**：(a) `engines.node` 从 `">=20"` 改为 `"20.x"`（钉住 Node 20 major，minor 跟随 Vercel default；消除「automatically upgrade when a new major Node.js Version is released」warning）；(b) 新增 `pnpm.onlyBuiltDependencies: ["better-sqlite3", "esbuild"]`（pnpm 9+ 标准字段，授权 pnpm 跑这两个原生模块的 postinstall 脚本，消除 `Ignored build scripts` warning）
- 仓库就绪审计：`pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 四件全部 exit 0（基线）
- 捕获基线 `pnpm build` 输出（warnings 原样落盘）到 `.omx/evidence/favicon-analytics-warnings/task-0-baseline-build.log`，作为后续「警告面未扩大」的对照基线
- 删除 `app/favicon.ico`（Next.js 16 stock ICO，仅含 Next.js logo 的 16x16/32x32 multi-res）
- 新增 `app/icon.svg`，与 `public/logo.svg` 字节一致；保留品牌旧配色（`#0b0f17` 背景 / `#e2e8f0` 棋盘线 / `#22d3ee` 青 X / `#f472b6` 粉 O）
- `app/layout.tsx` 新增 `import type { Viewport } from "next";` 并 export 一个 `viewport` 对象：`{ themeColor: '#0A0A0A', colorScheme: 'dark' }`；文件顶部声明 `const THEME_COLOR = '#0A0A0A' as const;` 配套 JSDoc 注释指明它镜像 `app/globals.css` 的 `--color-bg-base` 设计令牌
- `app/layout.tsx` 的 `metadata` 对象新增 `metadataBase: new URL('https://3t-tic-tac-toe.vercel.app/')`
- `app/layout.tsx` 新增 `import { Analytics } from "@vercel/analytics/next";` 并在 `<body>` 内 `{children}` 之后挂载 `<Analytics />`；layout 仍是 Server Component，不加 `'use client'`
- 复用 dirty `package.json` / `pnpm-lock.yaml` 里的 `@vercel/analytics ^2.0.1` 改动（不要 reset、不要重新 add；commit 2 时整段 diff 一并提交）
- 每次 commit 完成后跑 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build`，全部 exit 0 才进入下一个 commit
- `tests/qa/visual-qa.mjs` 扩展：在 `snapshot(page)` 函数里追加三个字段：`iconHref`（读 `document.querySelector('link[rel="icon"]')?.getAttribute('href')`）、`themeColor`（读 `document.querySelector('meta[name="theme-color"]')?.getAttribute('content')`）、`analyticsScript`（在生产 HTML 里读 Analytics 实际注入的 script 标记，selector 按 `@vercel/analytics` 实际产物调整）
- `tests/qa/hydration-check.mjs` 复用（无需修改），作为 commit 2 后的回归探针
- 末尾跑 `node tests/qa/commit-audit.mjs --branch main`，0 violations
- `docs/operations.md` §部署 末尾追加两个子小节：(a)「### 已解决部署警告（代码侧）」表格列本次 commit 1/2 修复项；(b)「### 待人工操作（Vercel Dashboard）」表格**5 行 4 列**（项 | 决定 do/skip/out-of-scope | 一句话理由 | Dashboard 配置入口 URL），覆盖 Build Multiple Deployments Simultaneously / Prevent Frontend-Backend Mismatches / Secure Preview Deployments / Deployment Protection / Preview Deployment
- **新增文件** `docs/verification-gauntlet.md`（路径前缀 `docs/`，仓库内 single source of truth），含 5 节：(1) Title + 顶部说明；(2) `## 1. 6 层 Gauntlet 现状对照` —— 6 行 4 列表（Tests / Types / Lint / Changed-line coverage / Mutation / Property-based × 项目状态 / 跑吗 / 在 AGENTS.md 门禁吗）；(3) `## 2. On-demand 触发规则` —— 3 条触发条件（coverage：改 lib/db；mutation：改 4 个 scope 文件；property：新增 lib/X.ts 纯函数）+ 每条配「启用步骤 + Tested trailer 模板」；(4) `## 3. Gap 清单` —— 4 项已知 follow-up（AGENTS.md §验证门禁 缺 3 层 / coverage-mutation-property scope 不覆盖 app/ / `pnpm eslint .` ≡ `pnpm lint` / `pnpm test:property` 是空跑脚本）；(5) `## 4. 与 docs/operations.md §部署 的边界` —— 两文分工说明 + 链接互指
- 编辑 `AGENTS.md` **仅 §验证门禁 一节**末尾追加一段（**不动其他节**）：引用 `docs/verification-gauntlet.md` + on-demand 触发规则摘要（覆盖 coverage/mutation/property 三条）
- 三份原子提交都带 `Plan: .omo/plans/favicon-analytics-warnings.md` footer + 完整 lore trailer（Constraint / Rejected / Confidence / Scope-risk / Directive / Tested / Not-tested）；每个 commit 的 `Not-tested:` 必须显式声明 coverage / mutation / property 跳过原因（scope 不覆盖本次改动）

### 不能有（护栏、反 slop、范围边界）
- 新增 npm 依赖（`@vercel/analytics` 是用户明确要求且已在 dirty `package.json`）
- commit 0 不顺手 absorb 其它 dirty `package.json` / `pnpm-lock.yaml` 改动（`@vercel/analytics` 留给 commit 2）、不升级 pnpm、不改 `package.json` 无关字段（scripts / dependencies / devDependencies）、不触碰 `pnpm-lock.yaml`（字段改动与依赖图无关）
- 在 `app/layout.tsx` 上加 `'use client'`（必须保留 Server Component 才能 export `metadata` + `viewport`）
- emoji 图标、Tailwind 原生色板、组件级 focus ring、内联 hex（design tokens 优先；`themeColor` 字面量在 Server Component metadata 字段里出现是 Next.js 类型约束，文件内带注释指明对应令牌）
- 任何对 `lib/`、`db/`、`components/`、`app/api/`、`app/page.tsx`、`app/play/page.tsx`、`app/result/page.tsx` 的修改
- 新增 `app/apple-icon.*` 或 `app/opengraph-image.*`（用户没要求；Next.js 16 的 apple-icon 仅支持 JPG/PNG，OG 图需要 JPG/PNG/GIF，两类都不能直接复用 SVG）
- 在 `metadata` 里加 `openGraph` / `twitter` 块（没有 OG 图就没有意义）
- 修改 `next.config.ts`、`commitlint.config.cjs`、`eslint.config.mjs`、`tsconfig.json`、`vitest.config.ts`、`stryker.config.mjs`
- 新增测试文件（`tests/qa/` 目录其它文件）；`tests/qa/visual-qa.mjs` 仅追加快照字段
- 使用 `git commit --no-verify` 绕过 commit-msg 钩子
- 在 executor turn 内执行 `vercel --prod` 或任何 Vercel CLI/Dashboard 自动化操作（需要用户凭据）
- 引入 Sentry / Datadog / 可观测性工具
- 自定义域名绑定、多 region 部署、备份恢复脚本
- 改 AGENTS.md 除 §验证门禁 末尾追加段之外的任何其它段（守住范围边界）
- 改 `db/schema.ts`、不改 `app/api/stats/route.ts` 的 `runtime = 'nodejs'` 注释（Edge 已弃用，commit `7781857` 已记录，不动）
- 改 Playwright 配置 / browsers 安装流程
- 把 `.env.local` 或 secrets 推到任何位置

## 验证门禁（项目实际 vs Gauntlet 6 层）

> 把用户列的 6 层 gauntlet 对照本项目实际配置与 AGENTS.md §验证门禁的差距。这一节是 plan 内部过渡产物——commit 3 完成后 `docs/verification-gauntlet.md` 是仓库内 single source of truth，本节随之降级。

### Gauntlet 6 层 × 项目状态对照

| 层 | 工具 | 推荐命令 | 项目状态 | 跑吗 | 在 AGENTS.md 门禁吗 |
| --- | --- | --- | --- | --- | --- |
| Tests | vitest | `npx vitest run` | 已配：vitest 5 + jsdom + 84 例（`pnpm test` = `vitest run`） | ✅ 在 commit 1/2/3 各跑一次 | ✅ §验证门禁第 2 条「pnpm vitest run 100% 通过」 |
| Types | tsc | `npx tsc --noEmit` | 已配：tsc 5 strict + `pnpm typecheck = tsc --noEmit` | ✅ 在 commit 1/2/3 各跑一次 | ✅ §验证门禁第 3 条「pnpm typecheck 通过」 |
| Lint | eslint | `npx eslint .` | 已配：eslint 9 + eslint-config-next/core-web-vitals + typescript + `pnpm lint = eslint`（用 eslint.config.mjs 默认 targets，自动排除 tests/qa/**） | ✅ 在 commit 1/2/3 各跑一次 | ✅ §验证门禁第 4 条「pnpm lint 通过」 |
| Changed-line coverage | vitest --coverage | `npx vitest run --coverage` (v8, per-file) | 部分配：`pnpm test:coverage = vitest run --coverage`，v8 provider，覆盖 lib/** + db/**（thresholds: lines 80 / functions 80 / branches 70 / statements 80） | ❌ 本计划内**不跑**（仅 lib/db 覆盖；本次改动全在 app/ + tests/qa/，coverage 不触及）；其余时跑 | ❌ §验证门禁**未列**；只在「命令」段列出 |
| Mutation | Stryker | `npx stryker run`（scope mutate: [...]） | 已配：`pnpm test:mutation = stryker run`，scope = lib/game.ts + lib/db.ts + lib/store.ts + db/schema.ts，break: null（信息性），vitest-runner + 仓库 patch 适配 Vitest 5 | ❌ 本计划内**不跑**（scope 仅 lib/db，与本次改动面无重叠；全项目跑 ≈ 258 mutants × 13s 较慢） | ❌ §验证门禁**未列**；只在「命令」段列出 |
| Property-based | fast-check | `fc.assert(fc.property(...))` | 部分配：fast-check 4 已装；`pnpm test:property = vitest run lib/**/*.property.test.ts` **但仓库里 0 个 `*.property.test.ts` 文件**（`lib/game.test.ts` 用了 fast-check 但归在 `*.test.ts` 里，跑在 `pnpm test` 路径）；AGENTS.md / docs/operations.md 均未提及 | ❌ 本计划内**不跑**（本次改动面无纯函数 lib/） | ❌ §验证门禁**未列**；AGENTS.md 也未提及 `pnpm test:property` |

### Gap 清单（不在本次范围内，但写到 docs/verification-gauntlet.md 作为后续 follow-up）

1. **AGENTS.md §验证门禁只列了 3 层（test/typecheck/lint）+ build + commit-audit + browser QA**——6 层 gauntlet 实际能跑 4 层（test/typecheck/lint/build），coverage/mutation/property 只在「命令」段提到、不在门禁。**本次在 AGENTS.md §验证门禁 末尾追加指针段**（不动其它节），将 6 层全表的 single source of truth 指向 `docs/verification-gauntlet.md`。后续单独提一个 `chore(docs): AGENTS.md §验证门禁补全 6 层 gauntlet inline 摘要` 的 follow-up 才考虑。
2. **Coverage / mutation / property 三层 scope 都不覆盖 `app/`、`components/`、`tests/qa/`**。本次改动恰好命中这三个目录的边缘，所以三层在本计划内**主动跳过**并在每个 commit 的 lore `Not-tested:` trailer 里写清。如未来想做 changed-line 覆盖守护，需要在 `vitest.config.ts` 里扩 `coverage.include`、`stryker.config.mjs` 里扩 `mutate` 数组——这又是单独的 plan。
3. **`pnpm eslint .` 与 `pnpm lint` 的语义差**：本项目 `pnpm lint = eslint`（不传参），等价于 `eslint .` 由 eslint.config.mjs 默认 targets + `globalIgnores(['tests/qa/**', ...])` 共同决定；用户表里写的 `npx eslint .` 与 `pnpm lint` 在本项目结果一致，**不需要改命令**。
4. **`pnpm test:property` 是空跑脚本**：仓库 0 个 `*.property.test.ts` 文件，实际的 fast-check 性质测试（`lib/game.test.ts` 里 200-sample 不变量）走的是 `pnpm test` 而不是 `pnpm test:property`。要么把 `lib/game.test.ts` 里的 fast-check 块搬到 `lib/game.property.test.ts` 让 `test:property` 真跑出东西；要么把 `pnpm test:property` 从 `package.json` 删掉，避免「存在但永远 0 测试」的伪门禁。**本次不动**（守住范围边界），但作为 follow-up anchor 写到 `docs/verification-gauntlet.md`。

### 对本次执行的结论（on-demand 原则 + 守门范围）

- **6 层是工具箱（toolkit），不是每 commit 必跑的闸门（gate）。** 本计划 14 个 todo 真正每 commit 跑的是 **3 层**（tests / types / lint，AGENTS.md §验证门禁已强制）+ 1 个 build（§验证门禁已强制）+ 1 个 browser QA（触及 UI 时跑）+ 1 个 commit-audit。剩下 **3 层**（coverage / mutation / property）**不跑**在本计划的所有 commit 里。
- **「不跑」≠ 「可以删掉」≠ 「永远不跑」。** 这 3 层在 `package.json` 里都已 wire 完脚本（`pnpm test:coverage` / `pnpm test:mutation` / `pnpm test:property`），未来任何 commit **触及对应 scope 时必须启用**，具体规则：
  - **Coverage**（scope = `lib/**` + `db/**`，vitest v8 thresholds: lines 80 / functions 80 / branches 70 / statements 80）：未来任何 commit 修改 `lib/` 或 `db/` 下任意文件 → 必须跑 `pnpm test:coverage` 并满足 thresholds，把 `Not-tested:` trailer 改成 `Tested: pnpm test:coverage PASS`，并在 lore 里说明触发原因。本计划改动不在 `lib/db` scope，所以不启用。
  - **Mutation**（scope = `lib/game.ts` + `lib/db.ts` + `lib/store.ts` + `db/schema.ts`，break: null 信息性）：未来任何 commit 修改这 4 个文件 → 必须跑 `pnpm test:mutation`。本计划不触碰，所以不启用。
  - **Property-based**（scope = `lib/**/*.property.test.ts`，当前仓库 0 个匹配文件——见 Gap 4）：未来 commit 新增 `lib/X.ts` 纯函数 → 必须配套 `lib/X.property.test.ts` 并跑 `pnpm test:property`。本计划不新增纯函数，所以不启用。
- **本计划 14 个 todo 的 commit lore trailer 必须各自显式写明**：「Coverage / Mutation / Property-based 三层跳过：scope 不覆盖本次改动（app/ + tests/qa/ + docs/），后续如需启用见 `docs/verification-gauntlet.md` §2 on-demand 规则」。这不是装饰，是给下一次 reviewer / executor 的「下次该跑什么」的明确指针。
- **仓库内 single source of truth 在 `docs/verification-gauntlet.md`**（todo 11 新建），不是 `docs/operations.md`。本 plan §验证门禁 是过渡产物——commit 3 之后 §验证门禁 的内容以 `docs/verification-gauntlet.md` 为准；AGENTS.md §验证门禁 只留指针（todo 12）。任何 commit 修改 `package.json` / `vitest.config.ts` / `stryker.config.mjs` / 新增 `*.test.ts` / `*.property.test.ts` 时，必须同步更新 `docs/verification-gauntlet.md` 的 §1 + §2 + §3，并在该 commit 的 lore `Directive:` trailer 里点出「同步 docs/verification-gauntlet.md 是本 commit 的可见证据」。

## 验证策略
> 零人工介入 —— 全部验证由 agent 自动执行。
- 测试策略：tests-after（扩展 `tests/qa/visual-qa.mjs` 的 `snapshot(page)` 读取新加的 `<link rel="icon">` / `<meta name="theme-color">` / Analytics script tag，作为本次改动唯一的机器可读契约；既有 84 例 vitest + 7 个 QA 脚本保持全绿）
- 证据落点：`.omx/evidence/favicon-analytics-warnings/task-<N>-<slug>.{log,json,png}`（基线 build 在 task-0；commit 1 后 build 在 task-5；commit 2 后 build + 视觉探针在 task-8；最终 commit-audit 在 task-13）
- 通道栈：
  - 单元测试：`pnpm vitest run` 全 84 例输出
  - 静态检查：`pnpm typecheck && pnpm lint && pnpm build` 三件 exit 0
  - 真实 surface（浏览器）：`pnpm build && pnpm start &` 后 `node tests/qa/visual-qa.mjs`，断言 5 个 stage 的 `qa-log.json` 里每个快照的 `iconHref` 含 `/icon`、 `themeColor === '#0A0A0A'`、 Analytics script tag `present`
  - Hydration 回归：`node tests/qa/hydration-check.mjs`，断言 `<Analytics />` 挂载后 0 条 console hydration warning（覆盖三路由 + 一局胜利 + 持久化）
  - 提交契约：`node tests/qa/commit-audit.mjs --branch main`，断言 0 violations（包含 lore trailer + Plan: footer）
- 必须留下的清理回执：`pnpm start` 后台进程必须 `kill <pid>` + `kill -0 <pid>` 失败验证；Playwright 上下文在每个 probe 末尾 `.close()`；`.omx/evidence/` 已 gitignore 不需清理；dirty `package.json` + `pnpm-lock.yaml` 在 commit 2 时随 `<Analytics />` 改动一并提交（不要 stash / 不要 reset）

## 执行策略
### 并行执行 waves
> 每波 5-8 个 todo。除了最后一波，少于 3 个意味着下就拆细。

**Wave -1 — 线上 build warning 修复（commit 0，最前）**
- W-1.1 `package.json` 字段修改：(a) `engines.node` 从 `">=20"` 改为 `"20.x"`；(b) 新增 `pnpm.onlyBuiltDependencies: ["better-sqlite3", "esbuild"]`
- W-1.2 commit 0 前验证：`pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 四件全绿（特别注意 build 输出**不再**含 `Detected "engines"` 字符串也**不再**含 `Ignored build scripts` 字符串）
- W-1.3 重生成 `.omx/evidence/favicon-analytics-warnings/task-0-baseline-build.log`（覆盖原 dirty baseline，作为 commit 0 后的干净基线；commit 1/2/3 的「警告未扩大」检查以此 log 为对照）
- W-1.4 commit 0 提交：`build(vercel): pin engines.node to 20.x + allow pnpm build scripts`

**Wave 0 — 基线捕获（前置门禁，单任务）**
- W0.1 仓库就绪审计 + 基线 build 警告快照

**Wave 1 — 自有 favicon + Next.js 16 viewport/metadataBase（commit 1）**
- W1.1 删除 `app/favicon.ico`
- W1.2 新增 `app/icon.svg`（复制 `public/logo.svg` 字节一致）
- W1.3 `app/layout.tsx` 新增 `viewport` export + `metadataBase` + 顶部 `THEME_COLOR` 常量
- W1.4 commit 1 前验证：`pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 全绿
- W1.5 commit 1 提交：`feat(layout): 自有 favicon + Next.js 16 viewport/themeColor/metadataBase`

**Wave 2 — Vercel Analytics 挂载（commit 2）**
- W2.1 `app/layout.tsx` 新增 `import { Analytics } from "@vercel/analytics/next";` 并在 `<body>` 末挂载
- W2.2 `tests/qa/visual-qa.mjs` 扩展 `snapshot(page)`：加 `iconHref` / `themeColor` / `analyticsScript` 三个字段
- W2.3 commit 2 前验证：`pnpm build` + `pnpm start` 后台启动 + `tests/qa/visual-qa.mjs` 抓 5 个 stage + `tests/qa/hydration-check.mjs` 0 hydration warning
- W2.4 commit 2 提交：`feat(analytics): 挂载 <Analytics /> from @vercel/analytics/next`，附带 dirty `package.json` + `pnpm-lock.yaml` 改动

**Wave 3 — 文档外化（commit 3，3 个文件一次性提交）**
- W3.1 `docs/operations.md` §部署 末尾新增「已解决部署警告（代码侧）」与「待人工操作（Vercel Dashboard）」两个子小节（含 5 项 Vercel 决策表，每行 4 列）
- W3.2 创建 `docs/verification-gauntlet.md`（**新文件**）—— 6 层 Gauntlet 现状表 + on-demand 触发规则 + Gap 清单 + 与 operations.md 边界说明
- W3.3 编辑 `AGENTS.md` §验证门禁 末尾追加指针段（指向 docs/verification-gauntlet.md）+ on-demand 摘要
- W3.4 commit 3 前全套验证：`pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` + `tests/qa/visual-qa.mjs` + `tests/qa/hydration-check.mjs` 全绿
- W3.5 commit 3 提交（**3 个 doc 文件一次性**）：`git add docs/operations.md docs/verification-gauntlet.md AGENTS.md && git commit -m '...'` 主题 `chore(docs): 同步部署警告解决方案 + gauntlet 文档化 + AGENTS.md 指针`
- W3.6 末尾跑 `node tests/qa/commit-audit.mjs --branch main`，0 violations

**Final verification wave F1–F4（依赖 Wave 3）**
- F1 计划合规审计：3 份 commit 各自独立 build + tests 绿；lore trailer 齐全；`Plan: .omo/plans/favicon-analytics-warnings.md` footer 齐全；commit-audit 0 violation
- F2 代码质量审计：diff ≤ 500 LOC、≤ 10 代码文件；新增/改动文件仅限 `app/icon.svg`、`app/layout.tsx`、`tests/qa/visual-qa.mjs`、`docs/operations.md`、`docs/verification-gauntlet.md`、`AGENTS.md`；dirty `package.json` + `pnpm-lock.yaml` 只在 commit 2 里出现一次
- F3 真实 manual QA：`tests/qa/visual-qa.mjs` 的 `qa-log.json` 里每个 stage 的 `iconHref` / `themeColor` / `analyticsScript` 字段都断言成功；`tests/qa/hydration-check.mjs` 0 hydration warning
- F4 范围忠实性审计：核对 AGENTS.md §反模式 与 DESIGN.md §6，无新增 emoji / 内联 hex（除 metadata 字面量）/ 组件级 focus ring / 第二个水合触发点；`grep -r "use client" app/layout.tsx` 必须 0 命中；`grep -r "favicon" app/page.tsx app/play/page.tsx app/result/page.tsx` 必须 0 命中；AGENTS.md diff 仅限 §验证门禁 末尾；新文件 `docs/verification-gauntlet.md` 含完整 5 节

### 依赖矩阵
| Todo | 依赖 | 阻塞 | 可并行 |
| --- | --- | --- | --- |
| W-1.1 package.json engines + onlyBuiltDependencies | — | W-1.4 | — |
| W-1.2 build verify (no engines/Ignored warnings) | W-1.1 | W-1.4 | — |
| W-1.3 regenerate task-0-baseline-build.log | W-1.2 | W-1.4 | — |
| W-1.4 commit 0 | W-1.3 | W0.1, W1.x, W2.x, W3.x | — |
| W0.1 baseline build | W-1.4 | W1.x | — |
| W1.1 delete app/favicon.ico | W0.1 | W1.5 | — |
| W1.2 add app/icon.svg | W0.1 | W1.5 | W1.1 |
| W1.3 layout.tsx viewport+metadataBase | W0.1 | W1.5 | W1.1, W1.2 |
| W1.4 build verify | W1.1, W1.2, W1.3 | W1.5 | — |
| W1.5 commit 1 | W1.4 | W2.x | — |
| W2.1 layout.tsx Analytics mount | W1.5 | W2.3 | — |
| W2.2 visual-qa.mjs extend | W1.5 | W2.3 | W2.1 |
| W2.3 build + visual-qa + hydration | W2.1, W2.2 | W2.4 | — |
| W2.4 commit 2 | W2.3 | W3.x | — |
| W3.1 docs/operations.md | W2.4 | W3.4 | W3.2, W3.3 |
| W3.2 docs/verification-gauntlet.md (new) | W2.4 | W3.4 | W3.1, W3.3 |
| W3.3 AGENTS.md §验证门禁 pointer | W2.4 | W3.4 | W3.1, W3.2 |
| W3.4 full verify | W3.1, W3.2, W3.3 | W3.5 | — |
| W3.5 commit 3 (3 doc files) | W3.4 | F1, F2, F3, F4 | — |
| W3.6 commit-audit | W3.5 | F1 | — |
| F1 计划合规审计 | W3.6 | — | F2, F3, F4 |
| F2 代码质量审计 | W3.5 | — | F1, F3, F4 |
| F3 真实人工 QA | W3.5 | — | F1, F2, F4 |
| F4 范围忠实性 | W3.5 | — | F1, F2, F3 |

## Todos
> 实现 + 测试 = 一个 todo，绝不分拆。
<!-- 下面的 todo 行用 edit/apply_patch 追加，绝不重写上面的 headers。 -->

- [ ] 1. baseline: 跑仓库就绪审计并捕获基线 `pnpm build` 警告
  怎么做 / 不要做：在仓库根跑 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 四件，必须全部 exit 0；将 build 输出（含任何 warning）原样写入 `.omx/evidence/favicon-analytics-warnings/task-0-baseline-build.log`。不动任何代码；不动 dirty `package.json` / `pnpm-lock.yaml`。
  并行度：Wave 0 | 阻塞：— | 被阻塞于：W1.1, W1.2, W1.3
  参考：AGENTS.md §验证门禁（`pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build`）；docs/operations.md §日常命令
  验收标准（agent 自动执行）：`echo $?` 在每条命令后为 0；基线 build log 文件存在且行数 > 0
  QA 场景：shell — `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build 2>&1 | tee .omx/evidence/favicon-analytics-warnings/task-0-baseline-build.log; test ${PIPESTATUS[0]} -eq 0` PASS
  证据：`.omx/evidence/favicon-analytics-warnings/task-0-baseline-build.log`
  提交：N

- [ ] 2. 删除 app/favicon.ico
  怎么做 / 不要做：`git rm app/favicon.ico`（不是 `rm`，保留 index 历史）；不要触碰 `public/logo.svg`；不要新建任何 favicon 文件。
  并行度：Wave 1 | 阻塞：1 | 被阻塞于：5
  参考：AGENTS.md §「已有命名令牌时...」反模式 + DESIGN.md 视觉契约不涉及此删除（DESIGN.md 全文不引用 favicon）
  验收标准：`ls app/favicon.ico 2>&1` 返回 `No such file`；`git status --short` 含 `D app/favicon.ico`
  QA 场景：shell — `git rm app/favicon.ico && ls app/favicon.ico 2>&1 | grep -q 'No such file' && echo PASS` PASS
  证据：`git status -s` + 后续 `git show --raw HEAD | grep favicon`
  提交：Y（在 commit 1 内）

- [ ] 3. 新增 app/icon.svg（复制 public/logo.svg 字节一致）
  怎么做 / 不要做：`cp public/logo.svg app/icon.svg`；不要修改任何字节；不要 inline 重排或换成 design token 配色；不要在两个文件间建立任何 `import` 关系（每个独立文件）。
  并行度：Wave 1 | 阻塞：1 | 被阻塞于：5
  参考：node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md（icon 接受 .svg）；public/logo.svg 现状
  验收标准：`cmp public/logo.svg app/icon.svg` exit 0；`ls -la app/icon.svg` 显示非零字节；`git status -s` 含 `?? app/icon.svg`
  QA 场景：shell — `cp public/logo.svg app/icon.svg && cmp public/logo.svg app/icon.svg && echo PASS` PASS
  证据：`cmp` 输出 + `git status -s`
  提交：Y（在 commit 1 内）

- [ ] 4. layout.tsx：viewport export + metadataBase + THEME_COLOR 常量
  怎么做 / 不要做：编辑 `app/layout.tsx`，按以下精确顺序：(a) 文件顶部（在 import 之前）添加 `// THEME_COLOR mirrors --color-bg-base from app/globals.css. Next.js viewport.themeColor requires a literal CSS color; CSS variables cannot be read in a Server Component.` 一行注释 + `const THEME_COLOR = '#0A0A0A' as const;`；(b) 在现有 `import type { Metadata } from "next";` 行下方加 `import type { Viewport } from "next";`；(c) 在现有 `export const metadata: Metadata = { ... };` 块内的 `description:` 之后加一行 `metadataBase: new URL('https://3t-tic-tac-toe.vercel.app/'),`；(d) 在 `metadata` export 之后、`RootLayout` 之前加 `export const viewport: Viewport = { themeColor: THEME_COLOR, colorScheme: 'dark' };`。不要加 `'use client'`；不要改 metadata 的 title / description 文案；不要把 `viewport` 放到 metadata 内部（Next.js 16 deprecation warning）；不要触碰 `<html>` / `<body>` 结构或 `body` className。
  并行度：Wave 1 | 阻塞：1 | 被阻塞于：5
  参考：node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md（viewport 必须是独立 export；不接受 themeColor/viewport 在 metadata 内）；node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md（`metadataBase` 字段说明，line ~391）；app/globals.css `--color-bg-base: #0A0A0A`
  验收标准：`pnpm typecheck` exit 0；`grep -c "export const viewport" app/layout.tsx` 返回 ≥ 1；`grep -c "metadataBase" app/layout.tsx` 返回 ≥ 1；`grep -c "use client" app/layout.tsx` 返回 0
  QA 场景：shell — `pnpm typecheck && grep -q 'export const viewport' app/layout.tsx && grep -q 'metadataBase: new URL' app/layout.tsx && ! grep -q 'use client' app/layout.tsx && echo PASS` PASS
  证据：`pnpm typecheck` 输出 + 三个 grep 命令退出码
  提交：Y（在 commit 1 内）

- [ ] 5. commit 1：feat(layout): 自有 favicon + Next.js 16 viewport/themeColor/metadataBase
  怎么做 / 不要做：把 todo 2/3/4 的 dirty staged 改动一次性 commit。步骤：(a) `git add app/favicon.ico app/icon.svg app/layout.tsx`（注意 git rm 已 stage 删除，但 add 仍需列出来去重）；(b) 跑 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 全绿；(c) commit message 主题 `feat(layout): 自有 favicon + Next.js 16 viewport/themeColor/metadataBase`，正文用中文 WHAT/WHY/HOW，必带完整 lore trailer（Constraint: Next.js 16 把 viewport 从 metadata 拆出来，要求独立 export；Rejected: 把 themeColor 留在 metadata 内部 | 会触发 deprecation warning；Confidence: high；Scope-risk: narrow；Directive: 后续若加 openGraph / twitter，必须先 ensure 对应图片文件存在；Tested: pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build 四件 exit 0；Not-tested: 移动端浏览器真实色条渲染需后续生产部署人工验证 + Coverage/Mutation/Property-based 三层跳过：scope 不覆盖本次改动（app/ + tests/qa/），后续如需启用见 docs/verification-gauntlet.md §2 on-demand 规则）+ `Plan: .omo/plans/favicon-analytics-warnings.md` footer。不要把 dirty `package.json` / `pnpm-lock.yaml` 加进这次 commit（属于 commit 2）；不要用 `--no-verify`；commit-msg 钩子失败必须修到通过。
  并行度：Wave 1 | 阻塞：2, 3, 4 | 被阻塞于：6, 7, 8
  参考：AGENTS.md §提交约定 + §五步提交流程 + §中文提交；tests/qa/commit-audit.mjs（审计规则）；commitlint.config.cjs；.git/hooks/commit-msg
  验收标准：`git log -1 --format=%s` 含 `feat(layout):` 主题前缀；`git log -1 --pretty=%b` 包含所有 lore trailer key + `Plan: .omo/plans/favicon-analytics-warnings.md`；`node tests/qa/commit-audit.mjs --message-file <(git log -1 --pretty=%B)` exit 0
  QA 场景：shell — `git add app/favicon.ico app/icon.svg app/layout.tsx && git commit -m '<msg>' && node tests/qa/commit-audit.mjs --message-file <(git log -1 --pretty=%B) && echo PASS` PASS
  证据：`git log -1` 输出 + commit-audit exit 0 + `pnpm build` 输出落 `.omx/evidence/favicon-analytics-warnings/task-5-commit-1-build.log`
  提交：Y

- [ ] 6. layout.tsx：Analytics 挂载
  怎么做 / 不要做：编辑 `app/layout.tsx`，在文件顶部 import 区域新增 `import { Analytics } from "@vercel/analytics/next";`（与 next/font import 一起按字母序），在 `<body>` 内 `{children}` 之后、闭合 `</body>` 之前挂载 `<Analytics />`（独立一行）。不要传 `mode="production"`（默认 `auto` 在生产自动启用）；不要传任何 prop（最小化 surface）；不要包 `<Suspense>`（layout 不需要）；不要给 layout 加 `'use client'`。
  并行度：Wave 2 | 阻塞：5 | 被阻塞于：8
  参考：node_modules/@vercel/analytics/README.md（Quickstart + `<Analytics />` 文档）；node_modules/@vercel/analytics/dist/index.d.ts（AnalyticsProps.mode 默认 'auto'）
  验收标准：`pnpm typecheck` exit 0；`grep -c '<Analytics />' app/layout.tsx` 返回 ≥ 1；`grep -c 'analytics/next' app/layout.tsx` 返回 ≥ 1；`grep -c 'use client' app/layout.tsx` 仍为 0
  QA 场景：shell — `pnpm typecheck && grep -q '<Analytics' app/layout.tsx && grep -q '@vercel/analytics/next' app/layout.tsx && ! grep -q 'use client' app/layout.tsx && echo PASS` PASS
  证据：`pnpm typecheck` 输出 + 三个 grep 退出码
  提交：Y（在 commit 2 内）

- [ ] 7. visual-qa.mjs：snapshot helper 扩展（iconHref/themeColor/analyticsScript）
  怎么做 / 不要做：编辑 `tests/qa/visual-qa.mjs` 的 `snapshot(page)` 函数，在现有返回对象末尾追加三个字段：`iconHref: document.querySelector('link[rel="icon"]')?.getAttribute('href') ?? null`、`themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content') ?? null`、`analyticsScript: (document.querySelector('script[src*="vercel"]') || document.querySelector('script[data-va]') || Array.from(document.querySelectorAll('script')).find(s => s.textContent?.includes('va('))) ? 'present' : 'absent'`（按 `@vercel/analytics` 实际产物形态调整 selector；先 `pnpm build && pnpm start` 后 curl localhost:3000 查 HTML 真实产物再写 selector）。不要改其它 probe；不要新建 probe 文件；不要把 `snapshot` 函数返回值改成异步；不要新增 `import` 包（Playwright 已经可用）。
  并行度：Wave 2 | 阻塞：5 | 被阻塞于：8
  参考：tests/qa/visual-qa.mjs（snapshot 函数当前定义）；node_modules/@vercel/analytics/dist/next/index.mjs（实际产物 script 标签形态，可在 `pnpm build && pnpm start` 后 curl 查看）
  验收标准：`node -e "import('./tests/qa/visual-qa.mjs')" 2>&1 | grep -c 'syntax'` 返回 0；`grep -c 'iconHref' tests/qa/visual-qa.mjs` ≥ 1；`grep -c 'themeColor' tests/qa/visual-qa.mjs` ≥ 1；`grep -c 'analyticsScript' tests/qa/visual-qa.mjs` ≥ 1；后续 todo 8 跑 probe 时 qa-log.json 每个 stage都都含这三个字段且非 null/present
  QA 场景：shell — `grep -q 'iconHref' tests/qa/visual-qa.mjs && grep -q 'themeColor' tests/qa/visual-qa.mjs && grep -q 'analyticsScript' tests/qa/visual-qa.mjs && echo SYNTAX_OK` PASS（运行验证留到 todo 8）
  证据：grep 输出 + 后续 todo 8 的 qa-log.json
  提交：Y（在 commit 2 内）

- [ ] 8. build + visual-qa 真实 surface 验证 + cleanup
  怎么做 / 不要做：`pnpm build 2>&1 | tee .omx/evidence/favicon-analytics-warnings/task-8-post-build.log`；`pnpm start &` 后台启动；`BASE_URL=http://localhost:3000 node tests/qa/visual-qa.mjs` 跑完 5 个 stage；`kill <pid> && kill -0 <pid>` 必须失败（cleanup receipt）。断言每个 stage 的 qa-log.json 里 `iconHref` 含 `/icon`、`themeColor === '#0A0A0A'`、`analyticsScript === 'present'`。然后跑 `BASE_URL=http://localhost:3000 node tests/qa/hydration-check.mjs`，确认 0 hydration warning。
  并行度：Wave 2 | 阻塞：6, 7 | 被阻塞于：9
  参考：tests/qa/visual-qa.mjs（5 stage 探针）；tests/qa/hydration-check.mjs（三路由 hydration 探针）；docs/operations.md §浏览器 QA（环境变量 BASE_URL / EVIDENCE_DIR）
  验收标准：post-build log 文件 存在；qa-log.json 含 5 个 stage 且每个 stage都都含新三个字段；hydration-check exit 0；`kill -0 <pid>` 失败（确认 server 关闭）
  QA 场景：shell — `pnpm build && pnpm start & SERVER_PID=$! && BASE_URL=http://localhost:3000 node tests/qa/visual-qa.mjs && BASE_URL=http://localhost:3000 node tests/qa/hydration-check.mjs; kill $SERVER_PID 2>/dev/null; kill -0 $SERVER_PID 2>/dev/null && echo FAIL_CLEANUP || echo PASS` PASS
  证据：`.omx/evidence/favicon-analytics-warnings/task-8-post-build.log` + `.omx/evidence/visual-qa/qa-log.json` + `.omx/evidence/hydration-check/qa-log.json` + cleanup receipt 一行
  提交：N

- [ ] 9. commit 2：feat(analytics): 挂载 <Analytics /> from @vercel/analytics/next
  怎么做 / 不要做：`git add app/layout.tsx tests/qa/visual-qa.mjs package.json pnpm-lock.yaml`（dirty `package.json` + `pnpm-lock.yaml` 在此 commit 一并提交，不要分开提交也不要 stash）；commit message 主题 `feat(analytics): 挂载 <Analytics /> from @vercel/analytics/next`，正文中文 WHAT/WHY/HOW，lore trailer 必带：Constraint: `@vercel/analytics` 是用户明确要求且已在 dirty package.json 预备的依赖，本次提交一次性 absorb 该 diff；Rejected: 在 executor turn 内 `vercel --prod` 验证 dashboard 数据流 | 需要用户 Vercel 凭据，超出 agent 范围；Confidence: high；Scope-risk: narrow；Directive: Vercel Analytics 在 `mode='auto'` 下默认仅生产环境跟踪数据，本地 `pnpm dev` 不会触发网络请求，但 `pnpm build && pnpm start` 会在 HTML 中注入 script tag；Tested: pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build 四件 exit 0；visual-qa 5 stage 全部含 iconHref/themeColor/analyticsScript 三字段；hydration-check 0 hydration warning；Not-tested: Vercel Analytics dashboard 真实数据流入需要 production deploy + 用户在 dashboard 截图确认，本 executor turn 不操作 Vercel + Coverage/Mutation/Property-based 三层跳过：scope 不覆盖本次改动（app/ + tests/qa/），后续如需启用见 docs/verification-gauntlet.md §2 on-demand 规则）+ `Plan: .omo/plans/favicon-analytics-warnings.md`。不要 `--no-verify`。
  并行度：Wave 2 | 阻塞：8 | 被阻塞于：10, 11, 12
  参考：AGENTS.md §提交约定；tests/qa/commit-audit.mjs；.git/hooks/commit-msg
  验收标准：`git log -1 --format=%s` 含 `feat(analytics):`；`git log -1 --pretty=%b` 含完整 lore + Plan 行；`git show --stat HEAD` 含 `app/layout.tsx | tests/qa/visual-qa.mjs | package.json | pnpm-lock.yaml` 四文件；commit-audit exit 0；dirty `package.json` / `pnpm-lock.yaml` 不再出现在 `git status --short`
  QA 场景：shell — `git add app/layout.tsx tests/qa/visual-qa.mjs package.json pnpm-lock.yaml && git commit -m '<msg>' && node tests/qa/commit-audit.mjs --message-file <(git log -1 --pretty=%B) && git status --short | wc -l | grep -q '^0$' && echo PASS` PASS
  证据：`git log -1` + commit-audit exit 0 + `git status --short` 输出
  提交：Y

- [ ] 10. docs/operations.md：「已解决部署警告」+「Vercel Dashboard 人工清单」两节
  怎么做 / 不要做：编辑 `docs/operations.md` §部署 末尾（**不要**新增 §验证门禁 节——该节内容由 todo 11 单独建 `docs/verification-gauntlet.md` 承载，避免双处真相）：(a) 新增 `### 已解决部署警告（代码侧）` 子小节 —— 表格列出本次 commit 1/2 的修复项（favicon / viewport+themeColor+metadataBase / Analytics mount），每行三列（项 | 文件 | 行为）；(b) `### 待人工操作（Vercel Dashboard）` —— 5 行 4 列表（项 | 决定 do/skip/out-of-scope | 一句话理由 | Dashboard 配置入口 URL），覆盖 Build Multiple Deployments Simultaneously / Prevent Frontend-Backend Mismatches / Secure Preview Deployments / Deployment Protection / Preview Deployment，每项给出 Dashboard 配置入口（Project Settings → Deployments → 各自开关 + 文档链接）。**不要**改其它小节；**不要**新增 Vercel CLI / 自动化命令；**不要**把「待人工操作」包装成 agent 能跑的命令。

  五项 Vercel 决策（每项给一刀切的 do / skip / out-of-scope + 一句话理由，docs 表格必须照抄）：
  - **1. Build Multiple Deployments Simultaneously**（On-Demand Concurrent Builds）→ **OUT-OF-SCOPE / 计划升级后做**。本项目在 Vercel Hobby 计划（vercel-deploy-runbook.md §部署 锁定），Hobby 计划只允许 1 个并发 build，On-Demand Concurrent Builds 仅 Pro / Enterprise 可用。Hobby 内此开关在 Dashboard 不可见也不生效。等升级到 Pro 时启用，路径：Project Settings → Builds → On-Demand Concurrent Builds → `Run up to one build per branch`（避免同分支反复 push 抢资源）。Dashboard URL：https://vercel.com/docs/builds/build-queues
  - **2. Prevent Frontend-Backend Mismatches**（Skew Protection）→ **OUT-OF-SCOPE / 计划升级后做 + 框架自动启用**。Vercel Skew Protection 仅 Pro / Enterprise 可用；Hobby 不可开。即便升级，Next.js 是 supported framework，部署后 client 会自动 attach `?dpl=` query 或 `x-deployment-id` header，无需手写。决策：现阶段不动作，升级到 Pro 后 Dashboard 默认开启即可。Dashboard URL：https://vercel.com/docs/skew-protection
  - **3. Secure Preview Deployments**（Deployment Protection → Vercel Authentication）→ **OUT-OF-SCOPE / 由用户决定是否启用**。本项目是个人 hobby app，公开预览是设计意图（任何人打开 PR preview 就能玩）。若想加 auth gate，路径：Project Settings → Deployment Protection → Protection Scope = Standard Protection + Protection Method = Vercel Authentication（默认全 plans 可用）。默认建议**不开启**，因为这会阻塞任何人打开预览链接；若需 gate，单独建 `chore(docs): enable Vercel Authentication on Standard Protection scope` follow-up。Dashboard URL：https://vercel.com/docs/security/deployment-protection
  - **4. Deployment Protection**（伞型：method × scope 矩阵）→ **OUT-OF-SCOPE / 由用户决定**。方法三种（Vercel Authentication / Password Protection / Trusted IPs），scope 三种（Standard / All / Pre-Production）。本项目用不到；建议保持「off」。docs 表里写明三种 method 的入口路径 + 各自适用场景，便于以后真要加时不用再调研。Dashboard URL：https://vercel.com/docs/security/deployment-protection
  - **5. Preview Deployment**（每 push 自动 preview URL）→ **OUT-OF-SCOPE / 一键启用**，但**这是当前最大的 deployment warning 来源**。当前状态：用户在 Vercel Dashboard 看到「Missing GitHub Connection」，意味着仓库还没连 GitHub，所以**完全没有 preview URL**。操作：Project Settings → Git → Connect GitHub Repository → 选 `onepisya/tic-tac-toe` → production branch = `main`。docs 必须把这一行单列出来，标红/加粗「最高优先级，唯一一个不需凭据就能改、且关掉后会显著改善 deployment experience」。Dashboard URL：https://vercel.com/docs/deployments/environments#preview-environment-pre-production

  并行度：Wave 3 | 阻塞：9 | 被阻塞于：13
  参考：docs/operations.md §部署 现有段落；本计划「## 验证门禁（项目实际 vs Gauntlet 6 层）」整节；用户原始消息中粘贴的 5 项部署警告列表；vercel.com/docs/builds/build-queues（Build Queues）；vercel.com/docs/skew-protection（Skew Protection）；vercel.com/docs/security/deployment-protection（Deployment Protection）
  验收标准：`grep -c '已解决部署警告' docs/operations.md` ≥ 1；`grep -c 'Build Multiple Deployments Simultaneously' docs/operations.md` ≥ 1；`grep -c 'Skew Protection' docs/operations.md` ≥ 1；`grep -c 'Deployment Protection' docs/operations.md` ≥ 1；`grep -c 'Preview Deployment' docs/operations.md` ≥ 1；`wc -l docs/operations.md` 比改前增加 ≥ 20 行（不再要求 §验证门禁 节——该节在 todo 11 的新文件里）
  QA 场景：shell — `grep -q '已解决部署警告' docs/operations.md && grep -q 'Skew Protection' docs/operations.md && grep -q 'Build Multiple Deployments Simultaneously' docs/operations.md && grep -q 'Deployment Protection' docs/operations.md && grep -q 'Preview Deployment' docs/operations.md && echo PASS` PASS
  证据：grep 输出 + `git diff --stat docs/operations.md`（应见 ≥ 20 行新增）
  提交：Y（在 commit 3 内，与 todo 11/12 合并提交）

- [ ] 11. docs/verification-gauntlet.md（新文件，6 层 gauntlet + on-demand 规则的仓库 single source of truth）
  怎么做 / 不要做：创建 `docs/verification-gauntlet.md`（**新文件**，路径前缀在 `docs/` 不在 `.omo/`——这是仓库根文档的一部分）。文件结构 5 节：(1) `# 验证门禁（6 层 Gauntlet + on-demand 规则）` 一级标题 + 顶部一段说明「这是仓库 single source of truth；AGENTS.md §验证门禁 仅做指针；commit 触及 gauntlet 配置时必须同步更新本文」；(2) `## 1. 6 层 Gauntlet 现状对照` —— 把本 plan §验证门禁 / Gauntlet 6 层 × 项目状态对照 表照搬过去（含 Tests / Types / Lint / Changed-line coverage / Mutation / Property-based 6 行 + 「项目状态 / 跑吗 / 在 AGENTS.md 门禁吗」 4 列），**未来 scope 变化时此表是唯一更新源**；(3) `## 2. On-demand 触发规则` —— 3 条触发条件（coverage：改 lib/db；mutation：改 4 个 scope 文件；property：新增 lib/X.ts 纯函数）+ 每条配「启用步骤 + Tested trailer 模板」；(4) `## 3. Gap 清单` —— 把本 plan §验证门禁 / Gap 清单 的 4 项（AGENTS.md 缺 coverage/mutation/property gate；coverage/mutation/property scope 不覆盖 app/；pnpm eslint . ≡ pnpm lint；pnpm test:property 是空跑脚本）照搬，明确每项的「本次不动 + follow-up anchor」状态；(5) `## 4. 与 docs/operations.md §部署 的边界` —— 一段说明两文分工：operations.md §部署 关注部署警告解决方案（favicon / viewport / analytics）+ Vercel Dashboard 5 项人工清单；verification-gauntlet.md 关注代码层验证规则；二者不重复，链接互指。**不要**写散文式介绍；**不要**复制本 plan 文件本身——只把已经成为合同的 6 层表 + on-demand 规则 + Gap + 边界四块搬过去；**不要**碰现有文件。
  并行度：Wave 3 | 阻塞：9 | 被阻塞于：13
  参考：本 plan §验证门禁 整节（line 62–93）；AGENTS.md §验证门禁（line 142–155）；docs/operations.md §部署；package.json scripts
  验收标准：`test -f docs/verification-gauntlet.md && wc -l docs/verification-gauntlet.md | awk '{print $1}'` 落在 [50, 300]；`grep -c 'On-demand' docs/verification-gauntlet.md` ≥ 1；`grep -c '6 层 Gauntlet\|6 层' docs/verification-gauntlet.md` ≥ 1；`grep -c 'docs/operations.md' docs/verification-gauntlet.md` ≥ 1（边界节互链）
  QA 场景：shell — `test -f docs/verification-gauntlet.md && grep -q 'On-demand' docs/verification-gauntlet.md && grep -q '6 层' docs/verification-gauntlet.md && grep -q 'docs/operations.md' docs/verification-gauntlet.md && echo PASS` PASS
  证据：`head -40 docs/verification-gauntlet.md` + `git status -s` 含 `?? docs/verification-gauntlet.md`
  提交：Y（在 commit 3 内，与 todo 10/12 合并提交）

- [ ] 12. AGENTS.md §验证门禁：加指针 + on-demand 摘要
  怎么做 / 不要做：编辑 `AGENTS.md` **仅 §验证门禁 一节**（line 142–155）末尾追加一段（**不动其他节、不动其他项目贡献指南**）。追加内容固定模板：
  > 「**完整 6 层 Gauntlet 现状 + on-demand 触发规则**见 [docs/verification-gauntlet.md](docs/verification-gauntlet.md)。本节列出的 6 件是「每 commit 必跑」；coverage / mutation / property 三层在 `package.json` 已 wire 完脚本但**不在每 commit 闸门里**——其启用条件为：(a) coverage：commit 修改 `lib/**` 或 `db/**` 下任意文件；(b) mutation：commit 修改 `lib/game.ts` / `lib/db.ts` / `lib/store.ts` / `db/schema.ts` 任任任；(c) property：commit 新增 `lib/X.ts` 纯函数（必须配套 `lib/X.property.test.ts`）。触发后 lore trailer `Not-tested:` 改为 `Tested:` + 触发原因。」
  **不要**改 AGENTS.md 其他节；**不要**改「项目反模式」「代码地图」「约定」「命令」「备注」「贡献指南」「提交约定」「commit-msg hook」任何其他段落；**不要**加 emoji 或装饰性格式。
  并行度：Wave 3 | 阻塞：9 | 被阻塞于：13
  参考：AGENTS.md §验证门禁 现有 line 142–155；docs/verification-gauntlet.md（todo 11 产出）；本 plan §验证门禁 / 对本次执行的结论
  验收标准：`git diff AGENTS.md | wc -l` 在 8–20 行之间（净增，不动其他段）；`grep -c 'docs/verification-gauntlet.md' AGENTS.md` ≥ 1；`grep -c 'On-demand\|on-demand' AGENTS.md` ≥ 1；`grep -c '本节列出的 6 件' AGENTS.md` ≥ 1
  QA 场景：shell — `git diff AGENTS.md | grep -c '^+' | awk '$1>=3 && $1<=30' && grep -q 'docs/verification-gauntlet.md' AGENTS.md && grep -q 'On-demand\|on-demand' AGENTS.md && echo PASS` PASS
  证据：`git diff AGENTS.md` 输出（必须只动 §验证门禁 末尾）
  提交：Y（在 commit 3 内，与 todo 10/11 合并提交）

- [ ] 13. commit 3 前全套验证 (build + tests + QA + commit-audit)
  怎么做 / 不要做：跑 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 四件 exit 0；`pnpm start &` 后 `node tests/qa/visual-qa.mjs` + `node tests/qa/hydration-check.mjs`；`kill <pid>` cleanup；`node tests/qa/commit-audit.mjs --branch main` 0 violations。将所有 probe 输出落到 `.omx/evidence/favicon-analytics-warnings/task-13-final-ver.log`。
  并行度：Wave 3 | 阻塞：10, 11, 12 | 被阻塞于：14
  参考：AGENTS.md §验证门禁；docs/operations.md §浏览器 QA；tests/qa/commit-audit.mjs（--branch 模式审计所有 commit）
  验收标准：全部命令 exit 0；task-13-final-ver.log 行数 > 30；commit-audit 0 violations
  QA 场景：shell — `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build && (pnpm start & SERVER_PID=$!; BASE_URL=http://localhost:3000 node tests/qa/visual-qa.mjs; BASE_URL=http://localhost:3000 node tests/qa/hydration-check.mjs; kill $SERVER_PID 2>/dev/null) 2>&1 | tee .omx/evidence/favicon-analytics-warnings/task-13-final-ver.log && node tests/qa/commit-audit.mjs --branch main && echo PASS` PASS
  证据：`.omx/evidence/favicon-analytics-warnings/task-13-final-ver.log` + commit-audit exit 0
  提交：N（这是 commit 3 提交前的验证步骤）

- [ ] 14. commit 3：chore(docs): 同步部署警告解决方案 + gauntlet 文档化 + AGENTS.md 指针
  怎么做 / 不要做：`git add docs/operations.md docs/verification-gauntlet.md AGENTS.md`（3 个文档文件一次性提交，dirty `package.json` / `pnpm-lock.yaml` 必须为空——已在 commit 2 absorb）；commit message 主题 `chore(docs): 同步部署警告解决方案 + gauntlet 文档化 + AGENTS.md 指针`，正文中文 WHAT/WHY/HOW，lore trailer 必带：Constraint: 已解决项必须可被 commit 1/2 的文件路径交叉验证；Rejected: 把待人工操作包装成 agent 自动化脚本 | 需要用户凭据 + Vercel Dashboard 交互，超出 agent 范围；Confidence: high；Scope-risk: narrow；Directive: Vercel Dashboard 的 5 项开关在 docs 中保留稳定 anchor，下次有人跟进部署警告时可锚定查阅；docs/verification-gauntlet.md 是 6 层 gauntlet + on-demand 规则的仓库 single source of truth，后续任何 commit 触发 on-demand 规则时以此文件为准；Tested: docs diff 与 commit 1/2 文件列表交叉验证一致；Not-tested: 真实部署后 Dashboard 警告是否减少需用户人工确认 + Coverage/Mutation/Property-based 三层跳过：scope 不覆盖本次改动（docs/ + tests/qa/ 边缘），后续如需启用见 docs/verification-gauntlet.md §2 on-demand 规则）+ `Plan: .omo/plans/favicon-analytics-warnings.md`。不要 `--no-verify`。
  并行度：Wave 3 | 阻塞：13 | 被阻塞于：F1, F2, F3, F4
  参考：AGENTS.md §提交约定；tests/qa/commit-audit.mjs；本 plan §验证门禁 / 对本次执行的结论
  验收标准：`git log -1 --format=%s` 含 `chore(docs):`；`git log -1 --pretty=%b` 含完整 lore + Plan 行；`git status --short` 为空（dirty 清零——仅 docs 改动，无 lockfile / package.json）；`git show --stat HEAD` 含 3 个文件 `docs/operations.md` + `docs/verification-gauntlet.md` + `AGENTS.md`
  QA 场景：shell — `git add docs/operations.md docs/verification-gauntlet.md AGENTS.md && git commit -m '<msg>' && node tests/qa/commit-audit.mjs --message-file <(git log -1 --pretty=%B) && git status --short | wc -l | grep -q '^0$' && echo PASS` PASS
  证据：`git log -1` + commit-audit exit 0 + `git status --short`
  提交：Y

## Final verification wave
> 在所有 todo 完成后并行跑。所有项必须 APPROVE。把结果回报给用户并等显式确认才能宣告完成。

- [ ] F1. 计划合规审计
- [ ] F2. 代码质量审查
- [ ] F3. 真实人工 QA
- [ ] F4. 范围忠实性

### F1 具体口径
- 四份 commit 各自独立 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 全绿
- `node tests/qa/commit-audit.mjs --branch main` 0 violations（lore trailer + Plan: footer 齐全）
- 计划目录存在：`.omo/plans/favicon-analytics-warnings.md` 与本计划正文一致
- 末尾证据：`.omx/evidence/favicon-analytics-warnings/` 含 task-0-baseline（commit 0 后干净基线）/ task-5-commit-0-build.log / task-8-post-build.log / task-13-final-ver.log 四份 log

### F2 具体口径
- `git diff main~4..main --stat` LOC ≤ 500、≤ 10 代码文件（docs/generated/lockfile 不计入）
- 改动文件集合 ⊆ `{package.json, app/icon.svg, app/layout.tsx, tests/qa/visual-qa.mjs, docs/operations.md, docs/verification-gauntlet.md, AGENTS.md, pnpm-lock.yaml}`
- commit 0 仅改 `package.json` 两个字段（`engines.node` + `pnpm.onlyBuiltDependencies`），不触碰 `pnpm-lock.yaml`
- dirty `package.json` 在 commit 0 出现一次（build config 字段），在 commit 2 出现一次（absorb `@vercel/analytics` 依赖声明 + lockfile）；commit 1 / commit 3 不出现
- 无新增 ESLint disable / `@ts-ignore` / `as any` / `console.log` / 调试器

### F3 具体口径
- `.omx/evidence/visual-qa/qa-log.json` 5 个 stage 全部含 `iconHref` / `themeColor` / `analyticsScript` 三字段，且 `iconHref` 含 `/icon`、`themeColor === '#0A0A0A'`、`analyticsScript === 'present'`
- `.omx/evidence/hydration-check/qa-log.json` 0 hydration warning
- 浏览器截图证据：`.omx/evidence/visual-qa/0[1-5]-*.png` 5 张

### F4 具体口径
- **`package.json` build config**：`engines.node === "20.x"`（不再为 `">=20"`）；`pnpm.onlyBuiltDependencies` 含 `["better-sqlite3", "esbuild"]`（commit 0 唯一改动 `package.json` 的两个字段）
- **`pnpm-lock.yaml` 未变化**：`git diff main~1 main -- pnpm-lock.yaml | wc -l` 在 commit 0 上为 0（build config 字段改动与依赖图无关，commit 0 不改 lockfile）
- AGENTS.md §反模式 审计：
  - `grep -r "use client" app/layout.tsx` 必须 0 命中
  - `grep -rn 'className="[^"]*\b(focus|focus-visible|focus-visible:|outline)' app/` 必须 0 命中（无组件级 focus ring）
  - `grep -rn 'className="[^"]*\b(text|bg|border)-(red|blue|green|yellow|orange|purple|pink|gray|slate|zinc|neutral|stone|emerald|cyan|teal|sky|indigo|violet|fuchsia|rose|amber|lime)-[0-9]' app/` 必须 0 命中（无 Tailwind 原生色板）
  - `grep -rn "localStorage" app/page.tsx app/play/page.tsx app/result/page.tsx` 必须 0 命中（SSR 首帧不读 localStorage）；`lib/store.ts` 内部 localStorage 读取必须在 effect 内（既有契约，不动）
- DESIGN.md 视觉契约：`themeColor` `#0A0A0A` 等价于 `--color-bg-base`，无视觉漂移
- 范围忠实性：未触碰 `lib/`、`db/`、`components/`、`app/api/`、`app/page.tsx`、`app/play/page.tsx`、`app/result/page.tsx`、`next.config.ts`、`commitlint.config.cjs`、`eslint.config.mjs`、`tsconfig.json`、`vitest.config.ts`、`stryker.config.mjs`、`DESIGN.md`、`AGENTS.md §验证门禁 之外任何段`、`CONTRIBUTING.md`、`db/schema.ts`
- **AGENTS.md 边界**：本次 commit 3 **改了** AGENTS.md §验证门禁 末尾 ~10 行（加指针 + on-demand 摘要）；其他节（项目反模式 / 代码地图 / 约定 / 命令 / 备注 / 贡献指南 / 提交约定 / commit-msg hook）**未触碰**
- **新文件存在性**：`test -f docs/verification-gauntlet.md && wc -l docs/verification-gauntlet.md | awk '{print $1}'` 落在 [50, 300]；`grep -c 'On-demand' docs/verification-gauntlet.md` ≥ 1；`grep -c 'docs/operations.md' docs/verification-gauntlet.md` ≥ 1（边界节互链）
- **AGENTS.md diff 范围**：`git diff main~1 main -- AGENTS.md | wc -l` ≤ 30 行净增；只动 §验证门禁 一节（line 142–155 范围）

## 提交策略

- **4 份原子提交落在 main**，每份独立 build + tests 全绿：
  0. `build(vercel): pin engines.node to 20.x + allow pnpm build scripts` —— 唯一触碰 `package.json` 字段（`engines.node` + `pnpm.onlyBuiltDependencies`）；不触碰 `pnpm-lock.yaml`（字段改动与依赖图无关）。commit 0 之后 `pnpm build` 不再出现 `Detected "engines"` 或 `Ignored build scripts` warning，task-0-baseline-build.log 被覆盖为 commit 0 后的干净基线。这一步在历史上是 fix-up，挪到这里是因为用户的 4 份提交清单 = 视觉契约（commit 1）+ 数据契约（commit 2）+ 文档契约（commit 3）+ **构建契约（commit 0）**，4 件事各占一份原子 commit。
  1. `feat(layout): 自有 favicon + Next.js 16 viewport/themeColor/metadataBase` —— 触碰 `app/favicon.ico`（delete）+ `app/icon.svg`（new）+ `app/layout.tsx`（viewport + THEME_COLOR + metadataBase）。不含 dirty `package.json` / `pnpm-lock.yaml`（commit 2 才 absorb）。
  2. `feat(analytics): 挂载 <Analytics /> from @vercel/analytics/next` —— 触碰 `app/layout.tsx`（Analytics import + mount）+ `tests/qa/visual-qa.mjs`（snapshot helper 扩展）+ `package.json` + `pnpm-lock.yaml`（absorb dirty diff，一次性提交不分开）。这是唯一 absorb `@vercel/analytics` 依赖声明的 commit。
  3. `chore(docs): 同步部署警告解决方案 + gauntlet 文档化 + AGENTS.md 指针` —— 触碰 `docs/operations.md` §部署 末尾新增两子小节 + 新建 `docs/verification-gauntlet.md` + `AGENTS.md` §验证门禁 末尾追加指针段。3 个文件一次性提交。
- 每份 commit 必须独立 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 全绿（commit 2 与 commit 3 还要在 server 启动时跑完 visual-qa + hydration-check）
- 每份 commit 必带完整 lore trailer（Constraint / Rejected / Confidence / Scope-risk / Directive / Tested / Not-tested）+ `Plan: .omo/plans/favicon-analytics-warnings.md` footer；Not-tested trailer 必显式声明 coverage/mutation/property 跳过原因（scope 不覆盖本次改动）
- commit-msg 钩子由 `node tests/qa/commit-audit.mjs --message-file <(git log -1 --pretty=%B)` 兜底校验；不允许 `--no-verify`
- 历史上 `feat(scope)` / `chore(scope)` 主题均带中文（见 commit 71511c9 / 7781857 / 64f8766），保持一致
- 不动 `main` 之外的分支；不动 `runtime-cleanup-finalize.md` / `vercel-deploy-runbook.md` 等历史 plan 的 footer

## 成功标准
- 浏览器打开 https://3t-tic-tac-toe.vercel.app/ 后 tab 显示品牌图标（深色方块 + 青色 X + 粉色 O），而非 Next.js 默认 logo
- 浏览器开发者工具 `<head>` 含 `<link rel="icon" href="/icon?..." type="image/svg+xml" sizes="any">` + `<meta name="theme-color" content="#0A0A0A">` + `<meta name="color-scheme" content="dark">` + Analytics 注入的 script tag
- `pnpm build` warning 列表与 baseline 相比**未扩大**（基线文件保留在 `.omx/evidence/favicon-analytics-warnings/task-0-baseline-build.log`，commit 0 后该 log 不再含 `Detected "engines"` 或 `Ignored build scripts`）
- commit 0 后线上 Vercel build log 的两条 warning（Node engines 自动升级 + pnpm Ignored build scripts）全部消失
- `tests/qa/visual-qa.mjs` 跑完后 qa-log.json 的 5 个 stage 全部含新三字段且断言值正确
- `tests/qa/hydration-check.mjs` 0 hydration warning（`<Analytics />` 不引入 hydration 漂移）
- `node tests/qa/commit-audit.mjs --branch main` 0 violations
- `git log main -4 --format=%s` 四个主题前缀分别是 `build(vercel):` / `feat(layout):` / `feat(analytics):` / `chore(docs):`，每个 `git log -1 --pretty=%b` 含完整 lore + Plan: footer
- `docs/operations.md` §部署 末尾出现「已解决部署警告（代码侧）」与「待人工操作（Vercel Dashboard）」两个子小节，5 项 Dashboard 警告各有一行指引（含 5 行 4 列表，do/skip/out-of-scope 决定 + 一句话理由 + Dashboard URL）
- 不在 executor 射程内的 5 项 Vercel Dashboard 警告（Build Multiple Deployments Simultaneously / Prevent Frontend-Backend Mismatches / Secure Preview Deployments / Deployment Protection / Preview Deployment）已被 docs 标记为待人工操作，executor turn 内不假装已配置
- `git status --short` 在 commit 14 之后为空
- 无新增 npm 依赖（`@vercel/analytics ^2.0.1` 是用户明确要求且已在 dirty `package.json`）；commit 2 absorb 该 diff 一次性提交
- 新文件 `docs/verification-gauntlet.md` 存在（≥ 50 行 ≤ 300 行），含 5 节（Title + 6 层表 + on-demand 规则 + Gap + 与 operations.md 边界），关键词命中「On-demand」与「docs/operations.md」互链
- AGENTS.md §验证门禁 末尾追加段（不动其他节），含 `docs/verification-gauntlet.md` 链接 + on-demand 触发规则摘要（coverage/mutation/property 三条）
- 4 份 commit 的 lore `Not-tested:` trailer 各自显式声明 coverage / mutation / property 跳过原因（scope 不覆盖 app/ + tests/qa/ + docs/）
- 本计划 commit 3 改了 AGENTS.md §验证门禁 末尾加指针 + on-demand 摘要；其他节未触碰（守住范围边界）

---

## 执行备注（2026-09-10 落地后补，git-level 摘要）

本 plan 在执行时产生 3 类偏差，全部 commit lore trailer（`Rejected:` / `Directive:` /
`Not-tested:`）已记录；本节是 `cat .omo/plans/favicon-analytics-warnings.md` 时的
一眼全貌速查，不需要 git log 全文搜索。原 design 部分（含 engines.node=20.x 的原
案、4 份原子 commit 清单、范围护栏、成功标准）一字不动 —— 这是 plan 的语义（设
计记录），任何偏差都在 commit lore 里追溯。

### Engines.node 迭代链（plan 原案 20.x → 最终 24.x）

| Commit | engines.node | 触发原因 | 结果 |
| --- | --- | --- | --- |
| `cd47efb` | `"20.x"` | plan 原案 | 本地 vite-plus 解析 Node 22 时 vitest fork pool 退化为 `undici 8 缺 webidl.util.markAsUncloneable`，与计划验证门禁冲突 |
| `cf9435b` | `">=22"` | 想让 Vercel 跟随 project default 24.x | Vercel 报 `Detected "engines": { node: ">=22" } ... automatically upgrade` 警告 × 2，违背 commit 0 核心目标 |
| `875877c` | `"24.x"` | vite-plus shim 后切到 Node 24.21.0，pin 与 runtime 对齐 | 三方（engines.node / Vercel / 本地 vite-plus）均绿，0 条 Detected engines 警告 + 0 条 Skipping build cache 信息行 |

中间 `">=22"` 是迭代过程的暂时态，最终被 `24.x` 否决。完整 lore 见三个 commit 的
`Rejected:` / `Directive:` trailer。

### 计划外扩展（4 份 follow-up commit + 2 份 doc-only）

plan 原案是 4 份原子 commit（cd47efb / 955b24d / e7100e6 / b8d042f），落地后扩展为
11 份 commit（4 份原案 + 4 份 follow-up + 2 份 engines.node 迭代 + 1 份 CI 升级）：

| Commit | 类型 | 内容 |
| --- | --- | --- |
| `cd47efb` | build(vercel) | plan 原案 #0：engines.node=20.x + pnpm.onlyBuiltDependencies（原案） |
| `955b24d` | feat(layout) | plan 原案 #1：自有 favicon + Next.js 16 viewport/themeColor/metadataBase |
| `e7100e6` | feat(analytics) | plan 原案 #2：挂载 `<Analytics />` + visual-qa 探针扩展 3 字段 |
| `b8d042f` | chore(docs) | plan 原案 #3：docs 双文件 + AGENTS.md §验证门禁 末尾指针段 |
| `59e66f5` | fix(qa) | 第一次 vercel --prod 部署后发现 visual-qa.mjs Analytics 正则只匹配本地 `/_vercel/insights/script.js`，不匹配 Vercel 生产 `/<numeric-sandbox-id>/script.js`（实测 `/5376560351325243/script.js`）；新增 `^/\d+/script\.js$` 分支 |
| `8739896` | chore(docs) | AGENTS.md §验证门禁 inline 6 层 gauntlet 摘要（Tests/Types/Lint/Build/Commit-audit/Browser QA 每 commit + Coverage/Mutation/Property-based on-demand）+ 关闭 Gap #1 |
| `b0e2a3e` | test(lib) | lib/game.test.ts 的 fast-check describe 块（5 条不变量）搬到新建 `lib/game.property.test.ts` + `package.json#scripts.test:property` 从 `vitest run lib/**/*.property.test.ts`（vitest 不识别 shell glob）改为 `vitest run property`（vitest substring 过滤） |
| `42ad36f` | chore(docs) | docs/verification-gauntlet.md §3 Gap #4 标 ~~删除线~~ + §1 表 Property-based 行状态更新 |
| `cf9435b` | build(vercel) | 迭代 #1：engines.node 放回 `>=22` 让 Vercel 跟随 project default（已被 875877c 否决） |
| `875877c` | build(vercel) | 迭代 #2：engines.node pin 到 `24.x` 与 Vercel project default 对齐 |
| `8f7a8f6` | chore(docs) | 记录 engines.node 三环境对齐 + vite-plus shim 注意（AGENTS.md §验证门禁 末尾新增 19 行段落 + docs/verification-gauntlet.md §3 新增 Gap #5） |
| `35c97b0` | ci | `.github/workflows/ci.yml` 5 处 + `.nvmrc` Node 22 → 24，关闭 Gap #5（CI 与 engines.node 严格对齐） |

### Vercel 部署证据

4 次 `vercel --prod --yes`：

| 部署 | 触发 commit | Production URL | build log 关键观察 |
| --- | --- | --- | --- |
| #1 | `b8d042f` | `dpl_<deployment-id>` → alias `tic-tac-iq4kzug11-...vercel.app` | Vercel project default 24.x → engines.node 22.x 强制降级，build cache 丢失 |
| #2 | `42ad36f` | `tic-tac-asopu6a9i-...vercel.app` | 仍 22.x，0 Detected engines 警告 |
| #3 | `cf9435b` | `tic-tac-ey28l10gn-...vercel.app` | 24.x 跟随 project default，但 `">=22"` 引 Detected engines 警告 × 2 |
| #4 | `35c97b0` | `tic-tac-nyekyn5s4-...vercel.app` | 24.x pin + 0 警告 + build cache 复用（"Restored build cache from previous deployment"） |

最终部署（#4）实测 `curl https://3t-tic-tac-toe.vercel.app/`：

```
GET /: 200
<link rel="icon" href="/icon.svg?icon.13h9hmkl237y7.svg" sizes="any" type="image/svg+xml">
<meta name="theme-color" content="#0A0A0A">
<meta name="color-scheme" content="dark">
<script src="/5376560351325243/script.js">  ← Vercel Analytics SDK 生产端点
```

build log 同时 0 条 Detected engines 警告 + 0 条 Skipping build cache 信息行 +
0 条 Ignored build scripts 警告。证据文件：

- `.omx/evidence/favicon-analytics-warnings/task-{0-baseline,0-post-fix,1,2,3}-build.log`
- `.omx/evidence/favicon-analytics-warnings/deploy-{1,2,3,4}.log`
- `.omx/evidence/favicon-analytics-warnings/visual-qa{-final,-regex-local}/}/qa-log.json` + 5 张 PNG
- `.omx/evidence/favicon-analytics-warnings/hydration-check-final/` 输出 `HYDRATION CHECK PASS`

### 仍未完成的项（executor 射程外）

详见 `docs/operations.md` 「待人工操作（Vercel Dashboard）」表（5 项）：

- **#1 Preview Deployment（GitHub Connect）** —— 最高优先级，唯一一键可改项；连 GitHub 后 future commit 自动有 preview URL，关掉 deployment warning 最大来源
- **#2 Secure Preview Deployments**（out-of-scope，Hobby plan 不可用）
- **#3 Deployment Protection**（out-of-scope，Hobby plan 不可用）
- **#4 Build Multiple Deployments Simultaneously**（skip，Hobby plan 限定 1 concurrent build）
- **#5 Skew Protection**（skip，单页 Next.js 不需要）

executor 已把 5 项以 5 行 4 列表（do/skip/out-of-scope 决定 + 一句话理由 + Dashboard
配置入口 URL）写入 `docs/operations.md` §部署 末尾子小节；用户登录 Vercel Dashboard
即可逐项处理。

### 计划范围忠实性（commit 后的 F4 审计回放）

- 改动文件集合 ⊆ `{package.json, app/icon.svg, app/layout.tsx, tests/qa/visual-qa.mjs, docs/operations.md, docs/verification-gauntlet.md, AGENTS.md, pnpm-lock.yaml, lib/game.test.ts, lib/game.property.test.ts, .github/workflows/ci.yml, .nvmrc}` = 12 个文件
- 0 lines changed in `lib/game.ts` / `lib/db.ts` / `lib/store.ts` / `db/schema.ts` / `app/api/stats/route.ts` / `app/page.tsx` / `app/play/page.tsx` / `app/result/page.tsx` / `next.config.ts` / `commitlint.config.cjs` / `eslint.config.mjs` / `tsconfig.json` / `vitest.config.ts` / `stryker.config.mjs` / `DESIGN.md` / `CONTRIBUTING.md`
- 0 ESLint disable / 0 `@ts-ignore` / 0 `as any` / 0 `console.log` / 0 调试器
- AGENTS.md 唯一触碰 §验证门禁 末尾段（19 行），其他节未触碰
- 4 反模式审计：0 `use client` in `app/layout.tsx` / 0 组件级 focus ring / 0 Tailwind 原生色板 / 0 `localStorage` in page files

### 验证门禁最终状态（commit 0 原始目标 + 后续 follow-up 一起）

- `pnpm typecheck` / `pnpm lint` / `pnpm vitest run` (88 passed) / `pnpm build` 全 exit 0
- `pnpm test:property` 5 passed（commit `b0e2a3e` 之前是 "No test files found"）
- `pnpm test:coverage` 与 `pnpm test:mutation` 按 docs/verification-gauntlet.md §2 on-demand 规则按需启用（本次 scope 不命中，未启用）
- `node tests/qa/commit-audit.mjs --branch main` 输出 `branch=main total=81 pass=81 fail=0`
- production `https://3t-tic-tac-toe.vercel.app/` 4 个 page stage × `iconHref` / `themeColor` / `analyticsScript` 字段全 present（证据 `.omx/evidence/favicon-analytics-warnings/visual-qa-final/qa-log.json`）
- production hydration-check 输出 `HYDRATION CHECK PASS` + `hydration warnings: 0`

### 开源 readiness 备注

仓库当前 `package.json#private = false` + `repository = git+https://github.com/onepisya/tic-tac-toe.git`
+ LICENSE 文件存在 = 开源 ready 状态。本计划所有 commit 不动这些字段。后续真正开源前
需要：(a) 用户创建 GitHub 仓库并 Connect 到 Vercel（详见 docs/operations.md「待人工操作」
表 #1）；(b) 第一次 git push 后 Vercel 自动跑 preview URL + build cache；(c) README 
§部署 章节检查当前示例 URL 是否需要更新。
