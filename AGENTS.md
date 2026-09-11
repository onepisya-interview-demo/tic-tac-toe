<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-contribution-guidelines -->
总是使用中文进行回复。
# 项目知识库

**生成时间：** 2026-09-08
**提交：** b279939
**分支：** main

## 概览

两人同设备对战的井字棋，战绩自动持久化。技术栈是 Next.js 16 App Router、React 19、strict TypeScript、Tailwind v4 设计令牌、Zustand、Drizzle ORM 和 @libsql/client（本地 file: sqlite / Vercel 走 Turso HTTP）。

## 结构

    .
    ├── app/               # 三个页面路由、战绩 API、全局字体和设计令牌
    ├── components/        # 棋盘、音效/彩纸客户端组件，以及 ui/ 基础组件
    ├── lib/               # 纯规则、客户端 store、浏览器效果、SQLite I/O
    ├── db/                # Drizzle schema：game_stats 单行表
    ├── tests/qa/          # 面向生产服务的 Playwright 探针和提交审计
    ├── docs/              # 面向人的测试、运维和经验记录
    ├── .omo/plans/        # 非平凡提交必需的设计记录
    └── data/              # 已忽略的 SQLite 运行数据库

## 查找入口

| 任务 | 位置 | 说明 |
| --- | --- | --- |
| 路由或 API 行为 | app/ | 客户端页面和 Node runtime 的 /api/stats |
| 规则、战绩、持久化 | lib/game.ts、lib/store.ts、lib/db.ts、db/schema.ts | 纯规则不依赖 React/DOM |
| 视觉和无障碍契约 | DESIGN.md、app/globals.css、components/ | 设计令牌与全局 focus 所有权是契约 |
| 浏览器验证 | tests/qa/ | 先 pnpm build && pnpm start，不要用 dev server |
| 提交策略 | 下方贡献指南 | tests/qa/commit-audit.mjs 和 Git hook 共同强制 |
| 既有设计理由 | .omo/plans/*.md | 非平凡提交必须引用 Plan footer |

## 代码地图

中心度来自 import 位置扫描；本次会话没有暴露 LSP/codegraph 工具。

| 符号/模块 | 类型 | 位置 | 引用点 | 作用 |
| --- | --- | --- | --- | --- |
| game | 纯规则和战绩 | lib/game.ts:1 | 7 | 棋盘、胜负、落子、连胜计算 |
| useGameStore | Zustand store | lib/store.ts:72 | 5 | 局面阶段、落子和 API 同步 |
| stats API | Route handlers | app/api/stats/route.ts:6 | store + QA | GET/PUT/DELETE 与形状校验 |
| Board | 有状态 UI | components/Board.tsx:26 | /play | roving focus 和键盘输入 |
| launchQA | Playwright 启动器 | tests/qa/lib/browser.mjs:7 | 7 个脚本 | 统一浏览器、context 和 page 设置 |

## 约定

- 修改路由、handler、类型或生成文件前，先阅读上方 Next.js 16 自动警告。
- Server Component 是默认；只有交互或浏览器 API 需要时才添加 'use client'。
- 路径别名 @/* 指向仓库根目录；规则放 lib，schema 放 db，UI 组合放 components。
- 设计令牌保存在 app/globals.css 和 DESIGN.md；Tailwind class 引用令牌。
- 提交主题和正文可以中文；Conventional 前缀与 lore trailer 键名保持英文。

## 本项目反模式

- 已有命名令牌时，不要使用 Tailwind 原生色板或内联 hex。
- 不要在 SSR 首帧读取 localStorage；先渲染安全默认值，再用 useEffect 同步。
- 不要引入 UI、路由、动画、数据访问或表单库；这些是项目约束明确排除的。
- 不要使用 div onClick、emoji 图标、组件级 focus ring，或新增第二个水合触发点。
- 不要用 --no-verify 绕过 commit-msg hook。
- 契约要求生产构建时，不要对 dev server 跑浏览器 QA。
- **RSC 页面读取可变数据必须声明 `dynamic = 'force-dynamic'`** —— Next.js 16 默认静态优化可能烘焙 build-time 异步数据（如 Drizzle DB 调用）的结果到 HTML，runtime 返回脏数据直到下次 build。B-3a 实证：首屏 HTML 显示旧战绩而 DB 已是新战绩。
- **Service Worker fetch handler 必须按方法门控** —— `event.respondWith(fetch(event.request))` 无门控会让 PUT/POST/DELETE 被发两次（浏览器观察到两条 outbound 请求）。可安装但不缓存的 SW 范式：`if (event.request.method !== 'GET') return;` 后再 respondWith。B-1 实证：生产 DevTools Network 面板观察到 2 行 PUT。
- **store 的网络写 action 必须返回 Promise** —— 让调用方可以 await 后再调 `router.refresh()`。在 `force-dynamic` 下无需 `revalidatePath`（冗余）；在 ISR 下 Route Handler 必须调 `revalidatePath('/')` + `revalidatePath('/result')`。B-2 + B-3b 实证：setTimeout 700ms 与 PUT 落库时刻不固定；resetAll fire-and-forget DELETE 后同步 router.refresh() 会读到旧值。

## 项目特有风格

- 桌面优先的暗色 UI；移动端保持可用，但不是优化目标。
- 音效默认静音，本地持久化，并在用户手势后懒创建 AudioContext。
- 所有装饰性动效都有 prefers-reduced-motion 下的无动效路径。
- 稳定的 data-testid 节点是 QA 契约，包括不接收交互的彩纸层。
- 胜局探针使用 0,3,1,4,2，保证随机先手总能赢上排。

## 命令

    pnpm dev
    pnpm build && pnpm start
    pnpm test
    pnpm typecheck && pnpm lint
    pnpm test:coverage
    pnpm test:mutation
    node tests/qa/visual-qa.mjs

## 备注

- lib/db.ts 通过 @libsql/client + Drizzle 初始化并缓存 libsql 客户端；测试通过 DATABASE_URL/临时目录隔离，并调用 closeDb()。
- 战绩表唯一行是 id=1；即使 PUT 失败，本地 UI 状态仍保持正确。
- next-env.d.ts 是已跟踪的生成文件；切换构建模式时，它的引用发生变化是合理的。

# 贡献指南

本区块由项目维护，不是 next dev 再生成的内容。它是本仓库的权威贡献和验证契约。

## 提交约定

提交遵循 Conventional Commits，正文使用 WHAT / WHY / HOW。同一分支有两类提交，不能混在一个提交里：

- **Context Prompt 提交**：主题以 prompt(<scope>): 开头，供后续 AI 审查消费；适合文档、设计记录和主要读者是评审者的产物。
- **常规功能/修复提交**：主题使用 feat、fix、refactor、test、docs、chore、build、ci 或 perf；不进入 prompt 转换流程，但仍遵守正文规范。

### 五步提交流程

1. 先检查 git status -s、git diff 和 git diff --cached，只提交已理解的变化。
2. 清理死代码、临时日志、调试器、脚手架和占位标识；不修改自己不理解的行为。
3. 按文件或 hunk 精确暂存。纯格式化、依赖升级、大规模重命名和无关变更单独提交。
4. 编写符合下方 schema 的提交消息。
5. 提交后同步相关文档；行为变化要运行对应的 tests/qa 脚本并保留 PASS/FAIL 证据。

### 正文 schema

- **WHAT**：一句话说明动作和对象，祈使语气，不展开实现细节。
- **WHY**：说明缺陷、需求、动机或架构权衡；有关联 issue/PR 时引用。
- **HOW**：说明策略、兼容性、验证、风险和用户影响；diff 已列出文件，正文不逐文件复述。

非平凡提交还要带 lore trailer：Constraint:、Rejected:、Confidence:、Scope-risk:、Directive:、Tested:、Not-tested:。设计记录页脚写 Plan: .omo/plans/<slug>.md。trailer 键名保持英文，值可以中文。

### 中文提交

主题形如 feat(audio): 在胜利提示之上叠加合成欢呼。type/scope 保留英文 token，描述可中文，按 Unicode 码点计长度不超过 100。正文可用中文 prose，WHY/HOW 关键词也可直接写成显式 heading。tests/qa/commit-audit.mjs、commitlint.config.cjs 和 commit-msg hook 是同一策略的三个检查点。

## 原子提交

一个提交一个主题。每个提交都必须独立构建、测试为绿；不提交 WIP 或 omnibus。next-env.d.ts 和 Next 自动生成区块的变化单独作为 chore 提交，方便未来 bisect。

## 设计记录

非平凡工作先在 .omo/plans/<slug>.md 写设计记录，记录选项取舍、禁止事项和提交约定。实现提交通过 Plan: footer 引用它。

## Pull Request 大小

代码部分尽量少于 500 LOC、少于 10 个代码文件；文档、生成文件和 lockfile 不计入。超过时按层、功能组件或重构/功能拆分。

## 验证门禁

提交完成前必须验证：

- node tests/qa/commit-audit.mjs 通过，当前分支 0 violations。
- pnpm vitest run 100% 通过。
- pnpm typecheck 通过。
- pnpm lint 通过。
- pnpm build 通过；纯文档提交不改 Next route 数量。
- 触及浏览器界面时，运行相关的 tests/qa/*.mjs 探针。

**完整 6 层 Gauntlet 现状 + on-demand 触发规则**见
[docs/verification-gauntlet.md](docs/verification-gauntlet.md)。下面是 6 层 inline
摘要 + on-demand 触发条件，把上面 6 条「每 commit 必跑」放回全 6 层视图里对齐：

| 层 | 工具 / scope | 跑吗 | 触发条件 |
| --- | --- | --- | --- |
| Tests | vitest 5 + jsdom 30（88 例） | ✅ 每 commit | — |
| Types | tsc 5 strict | ✅ 每 commit | — |
| Lint | eslint 9（含 tests/qa/** ignore） | ✅ 每 commit | — |
| Build | next build | ✅ 每 commit | — |
| Commit-audit | tests/qa/commit-audit.mjs --branch main | ✅ 每 commit | — |
| Browser QA | tests/qa/*.mjs 探针 | ✅ 触及 UI 时 | — |
| Coverage | vitest --coverage（v8, `lib/**`+`db/**`, thresholds 80/80/70/80） | ⚠️ on-demand | commit 修改 `lib/**` 或 `db/**` 下任意文件 |
| Mutation | Stryker（scope 4 个文件：`lib/game.ts` `lib/db.ts` `lib/store.ts` `db/schema.ts`，break: null） | ⚠️ on-demand | commit 修改 4 个 Stryker scope 文件任一个 |
| Property-based | fast-check（`lib/**/*.property.test.ts`，当前 0 个文件） | ⚠️ on-demand | commit 新增 `lib/X.ts` 纯函数（必须配套 `lib/X.property.test.ts`） |

触发后 lore trailer `Not-tested:` 改为 `Tested:` + 触发原因。6 层全表 + on-demand
规则细节（thresholds / scope 数组 / 启用步骤 / Tested trailer 模板 / Gap 清单）见
[docs/verification-gauntlet.md](docs/verification-gauntlet.md)；本文 §验证门禁 是
入口，详细契约以 docs/verification-gauntlet.md 为准。

**engines.node 与 Node 运行时的三环境对齐（vite-plus shim 注意）**：本仓库
`package.json#engines.node` 必须与「Vercel project Node.js Version setting」+「CI
.github/workflows 设定的 Node 版本」+「本地 vite-plus runtime 解析到的 Node major」三者
对齐，否则会触发：(a) Vercel「Skipping build cache since Node.js version changed」
信息行（pin 与 project default 不一致，强制降级/升级丢 cache）+ (b) Vercel「Detected
"engines": { node: ... } in your package.json that will automatically upgrade when
a new major Node.js Version is released」警告（major 没 pin 触发）+ (c) 本地 vitest
fork pool 退化为 undici 8 报错（pin 与 vite-plus 解析到的 Node major 不一致时
`webidl.util.markAsUncloneable is not a function`）。本仓库当前对齐状态：
engines.node = `24.x` ↔ Vercel project default = `24.x` ↔ CI Node = `24`（`.nvmrc=24`，
`setup-node@v4 node-version: 24` 5 处全部统一）↔ vite-plus shim 当前解析到 `24.21.0`
（shim 在不同 session 可能切换到 `22.23.2` / `24.21.0`，每次启动 `node --version`
确认）。任何 commit 修改 `engines.node` 时必须：(1) `pnpm vitest run` 实测本地 fork
pool 不退化；(2) `vercel --prod` 部署后 build log 同时确认 0 条 Detected engines 警告
+ 0 条 Skipping build cache 信息行；(3) CI workflow Node 版本若与新 engines.node
冲突，需要同步更新 `.github/workflows/*.yml` 或 `.nvmrc`。历史决策链见 commit
`cd47efb` (20.x) → `cf9435b` (>=22) → `875877c` (24.x)，迭代 3 次才稳定；CI Node 24
升级由 commit（本次）落地。

## commit-msg hook

.git/hooks/commit-msg 会调用 node tests/qa/commit-audit.mjs --message-file "$1"。消息不合规时提交失败；禁止用 git commit --no-verify 绕过。需要独立校验时使用 pnpm exec commitlint --edit <message-file>。

<!-- END:project-contribution-guidelines -->
