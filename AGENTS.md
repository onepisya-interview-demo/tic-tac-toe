<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-contribution-guidelines -->
总是使用中文进行回复。
# 项目知识库

**生成时间：** 2026-09-12
**提交：** 5c51f4a
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

中心度基于 `grep -rln` import 扫描（项目无 LSP / codegraph 工具暴露给 agent；文件级中心度 = 直接 import 该文件的源文件数，含 co-located `*.test.ts`）。粗扫精确度受 import path 别名与 barrel re-export 影响，需要时跑一遍 `grep -rln "from .*lib/X['"]"` 自验。

| 符号/模块 | 类型 | 位置 | 引用点 | 作用 |
| --- | --- | --- | --- | --- |
| game | 纯规则 + 战绩 | lib/game.ts:1 | 9（4 prod + 5 test） | 棋盘、胜负、落子、连胜、streakLabel |
| useGameStore | Zustand store | lib/store.ts:72 | 10（9 prod + 1 test） | 局面阶段、落子、API 同步、AbortController |
| stats API | Route handlers | app/api/stats/route.ts:6 | 1 prod + 7 QA + 1 test | GET/PUT/DELETE + 形状校验 |
| Board | 有状态 UI | components/Board.tsx:26 | 1 direct（/play）；间接经 PlayController/ResultBanner 等消费 | roving focus、键盘输入、落子动画 |
| launchQA | Playwright 启动器 | tests/qa/lib/browser.mjs:7 | 9 探针 | 统一 Chromium、context、autoplay policy |

库与 QA 都靠 `lib/game.ts` 与 `lib/store.ts`；store 是浏览器内单例。修改这两文件必跑对应 vitest / Stryker / fast-check（见 §验证门禁）。

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
- **LSP 服务端工具（typescript-language-server / yaml-language-server / bash-language-server）允许作为 devDependency** —— 它们是本地编辑器 / Codex `lsp.*` MCP 的语言服务端，永不进 Next.js runtime bundle；项目本地安装是为了与项目 typescript 编译器版本对齐（vp 全局 shim 与 typescript-language-server 的 tsserver 查找路径有冲突，2026-09-12 实证：`vp add -g` 后 server 报 `Could not find a valid TypeScript installation`）。任何 LSP 改动必须：(1) 三个 server 同时增删，保持列表一致；(2) `.codex/lsp-client.json` 同步；(3) 跑 `pnpm vitest run` + `pnpm typecheck` 确认不破 Gauntlet。
- **RSC 页面读取可变数据必须声明 `dynamic = 'force-dynamic'`** —— Next.js 16 默认静态优化可能烘焙 build-time 异步数据（如 Drizzle DB 调用）的结果到 HTML，runtime 返回脏数据直到下次 build。B-3a 实证：首屏 HTML 显示旧战绩而 DB 已是新战绩。
- **Service Worker fetch handler 必须按方法门控** —— `event.respondWith(fetch(event.request))` 无门控会让 PUT/POST/DELETE 被发两次（浏览器观察到两条 outbound 请求）。可安装但不缓存的 SW 范式：`if (event.request.method !== 'GET') return;` 后再 respondWith。B-1 实证：生产 DevTools Network 面板观察到 2 行 PUT。
- **store 的网络写 action 必须返回 Promise** —— 让调用方可以 await 后再调 `router.refresh()`。在 `force-dynamic` 下无需 `revalidatePath`（冗余）；在 ISR 下 Route Handler 必须调 `revalidatePath('/')` + `revalidatePath('/result')`。B-2 + B-3b 实证：setTimeout 700ms 与 PUT 落库时刻不固定；resetAll fire-and-forget DELETE 后同步 router.refresh() 会读到旧值。
- **网络写 action 必须带 AbortController timeout** —— Turso HTTP 在 iad1 偶发 30 s 默认 fetch 超时；client 必须主动 8 s `AbortController.timeout()` abort + Button `loading` state + 强制 disabled，否则重置战绩按钮会卡 30 s 不响应。HAR §P2 实证：线上抓到一个孤立 DELETE 200 time=30733 ms。
- **静态资源缓存必须双层** —— `_next/static/**` 已被 Vercel 边缘 immutable 缓存；但 `manifest.webmanifest` / `icon.svg` / `apple-icon*` / `favicon*` / `icon-*.png` 默认 `max-age=0, must-revalidate` 会让浏览器每次 nav 都 304 roundtrip（50-200 ms）。必须 `next.config.ts headers()` + SW cache-first 双层。HAR 直读实证：单次 PWA 会话 56-94 次 manifest 请求 + 头 = `max-age=0`。
- **仓库内任何"清理/迁移/deslop"批量文件操作必须走 git 通道：删 tracked 文件前先 commit，删 untracked/ignored 内容前先备份** —— worktree-only 删除可由 `git ls-files -d -z | xargs -0 git checkout --` 一条命令恢复，但 ignored 内容（如 `.omx/backups` 备份 tar）被删即永久丢失。2026-09-12 00:00:08-23 实证：40 个 tracked 文件（全部属于最后提交日期 2026-09-07 的 cohort）+ `.git/hooks` + `.omx/backups/repo.git.tar` 在 15 秒内被未知进程按清单删除；同波进程还触碰了 /tmp 顶层 35 个不相关目录。
- **herdr 多 pane 工作区内，同一 worktree 同时只允许一个 agent 写入；午夜定时任务窗口（00:00±15min）不做绕过 git 的批量文件操作** —— 2026-09-12 实证：仓库删除（00:00:08-23）与 `/tmp/hooks-v2` 空骨架创建（00:00:15）交错 6 秒，指向同一迁移脚本中途停止；三个 herdr pane 的会话转录在窗口内均零条目，hermes 生态 4 个 cron 同窗触发但无一认领删除行为——reflog/index 零记录证明它绕过了 git。
- **commit-msg hook 位于 `.git/` 内，git 永不跟踪；重建只能靠文档契约，重建后必须双向冒烟** —— 契约三源：本文件 §commit-msg hook、`.omo/plans/commit-policy-enforcement.md`、commit `52204f2` 正文与 Directive（audit 脚本是策略真源，hook 委托 audit）。任何 commit（含 `fcbde26f`）都不含 hook 原件；`.git/HEAD` 丢失用 `echo 'ref: refs/heads/main' > .git/HEAD` 恢复；hook 重建脚本见 `.omo/plans/recovery-from-unknown-cleanup.md` 附录 B。

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

### 中文提交（默认）

默认 commit message 用中文。type/scope 保留英文 token，描述默认中文（按 Unicode 码点计 ≤100），正文默认中文 prose，WHAT/WHY/HOW 显式 heading 也默认中文。

**保留英文的三种例外**：

1. 引用外部工具/库/API 的 token（`pnpm exec commitlint`、`execFileSync` 等代码标识符）
2. 引用外部文档/链接的标题
3. 用户明确要求英文 commit message

清单之外的场景一律走默认中文。tests/qa/commit-audit.mjs、commitlint.config.cjs 和 commit-msg hook 是同一策略的三个检查点。

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

**engines.node 必须三环境对齐**：本仓库 `package.json#engines.node` 必须与
「Vercel project Node.js Version setting」+「CI Node」+「本地 vite-plus runtime 解析到的 Node major」三者对齐，否则分别触发：(a) Vercel build cache 失效 / "Detected engines" 警告，(b) CI 与 engines.node 不一致，(c) 本地 vitest fork pool 退化为 `undici 8` 报错（`webidl.util.markAsUncloneable is not a function`）。

当前对齐：engines.node = `24.x` ↔ Vercel project default = `24.x` ↔ CI Node = `24`（`.nvmrc=24`，`setup-node@v4 node-version: 24` 5 处统一）↔ vite-plus shim 当前解析到 `24.21.0`（shim 在不同 session 可能切到 `22.23.2`，每次启动 `node --version` 确认）。

修改 `engines.node` 时必须：(1) `pnpm vitest run` 实测本地 fork pool 不退化；(2) `vercel --prod` 部署后 build log 0 条 Detected engines 警告 + 0 条 Skipping build cache 信息行；(3) CI workflow Node 与新 engines.node 同步（`.github/workflows/*.yml` 或 `.nvmrc`）。

历史决策链：commit `cd47efb` (20.x) → `cf9435b` (>=22) → `875877c` (24.x)。

## commit-msg hook

.git/hooks/commit-msg 会调用 node tests/qa/commit-audit.mjs --message-file "$1"。消息不合规时提交失败；禁止用 git commit --no-verify 绕过。需要独立校验时使用 pnpm exec commitlint --edit <message-file>。

<!-- END:project-contribution-guidelines -->
