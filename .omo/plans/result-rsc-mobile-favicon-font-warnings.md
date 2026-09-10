# result-rsc-mobile-favicon-font-warnings - Work Plan

## TL;DR (For humans)
**What you'll get:** iPhone Safari 和 iPhone Chrome 标签页 + 主屏书签 + 地址栏显示井字棋品牌图标（青色 X / 粉色 O / 深色底），Chrome devtools 不再报 mono 字体预加载警告。`/result` 的 RSC 请求保留为零代码改动——本项目刻意保留作为 Next.js 16 App Router 客户端导航 + 服务端组件的演示窗口。

**Why this approach:** iOS Safari/Chrome-on-iOS 根本不支持 SVG favicon（Next.js 16 的 `app-icon` 文件约定只接受 `.jpg`/`.jpeg`/`.png`），所以 SVG 再漂亮也看不见——必须补一份 `apple-touch-icon` PNG。字体警告的根因是 `app/layout.tsx` 把 Geist_Mono 应用到 `<html>` 上做全局预加载，但 `font-mono` 实际上只在 `/` 和 `/result` 路由的 `StatsCard` 里出现，`/play` 路由根本没用到——把预加载关掉，字体照常按需加载。`/result` 的 RSC 请求不是数据 fetch 而是 React tree 预取，几百字节且 Vercel CDN 边缘节点已 HIT（`x-vercel-cache: HIT`），是项目架构的展示窗口而非缺陷。

**What it will NOT do:** 不引入新 npm 依赖，不改任何 UI 组件、状态机、API、design tokens，不删 `/result` 路由，不改 `router.replace('/result')`，不写新文档（AGENTS.md / DESIGN.md / docs/ 全不动）。

**Effort:** Quick
**Risk:** Low —— 3 份原子 commit，每份独立 build+test+git revert；新增一个 `app/apple-icon.tsx` 文件 + 一个 `preload: false` 字段 + `tests/qa/visual-qa.mjs` 扩展；改动面全部在 `app/` + `tests/qa/`，零 npm 依赖。

**Decisions to sanity-check:** apple-icon 用 `next/og` `ImageResponse` 动态生成 PNG（TSX 而非静态二进制），保持项目 code-driven 风格；Geist_Mono 用 `preload: false`（而非把 import 搬出根 layout），保留设计系统的 CSS var `--font-mono` 语义；`/result` 保留 RSC（不折叠进 `/play`）。

Your next move: 批准这份 plan → 我派 momus 子代理做高精度复审 → 复审通过后你在独立 worker 会话跑 `$start-work` 执行。

---

> TL;DR (machine): Quick, Low. 3 份原子 commit（apple-icon + mono preload + visual-qa 扩展）落在 main。零 npm 依赖。改动文件 ⊆ {app/apple-icon.tsx, app/layout.tsx, tests/qa/visual-qa.mjs}。momus 高精度复审为强制步骤（在 worker 执行前）。

## Scope
### Must have
- 新增 `app/apple-icon.tsx`（Next.js 16 `apple-icon` 文件约定，仅 `.jpg`/`.jpeg`/`.png` 支持；用 `next/og` `ImageResponse` 动态生成 180x180 PNG）
  - 内容复用 `app/icon.svg` 的同色板：`#0b0f17` 底 / `#e2e8f0` 棋盘线 / `#22d3ee` 青色 X / `#f472b6` 粉色 O
  - 不写 emoji、不写 inline hex（在代码里复用 SVG 的字符串常量）
  - `export const size = { width: 180, height: 180 }` + `export const contentType = 'image/png'`
- 修改 `app/layout.tsx`：在 `Geist_Mono({...})` 调用中加 `preload: false`（保持 `subsets: ['latin']`、`variable: '--font-geist-mono'` 不变）
- 修改 `tests/qa/visual-qa.mjs`：在 `snapshot(page)` helper 里追加两个字段
  - `appleTouchIconHref`：`document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')` —— 期望非 null
  - `monoPreloadAbsent`：`!document.querySelector('link[rel="preload"][href*="797e433ab948586e"]')`（基于生产 HTML 已观察到的 mono 字体 hash 前缀；如 hash 改变需更新为新前缀）—— 期望 true
- 三份原子 commit 全部独立 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 全绿
- 三份 commit 都带 lore trailer + `Plan: .omo/plans/result-rsc-mobile-favicon-font-warnings.md` footer
- `node tests/qa/commit-audit.mjs --branch main` 0 violations
- `tests/qa/visual-qa.mjs` 在 `pnpm build && pnpm start` 之后跑（不能用 dev server），所有 stage 的 `appleTouchIconHref` 非 null + `monoPreloadAbsent === true`
- delivery 到 Vercel 生产后 `curl -s https://3t-tic-tac-toe.vercel.app/` 实测 HTML 头部含 `<link rel="apple-touch-icon" href="/apple-icon?<hash>">` + 不含 mono 字体的 `<link rel="preload">`

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 新增 npm 依赖（`next/og` 随 `next` 16 自带，`ImageResponse` 是内置 API）
- 修改 `lib/`、`db/`、`components/`、`app/api/`、`app/page.tsx`、`app/play/page.tsx`、`app/result/page.tsx`、`app/icon.svg`（保留作为 SVG icon 来源，apple-icon 复用其色板）、`app/globals.css`、`next.config.ts`、`tsconfig.json`、`eslint.config.mjs`、`vitest.config.ts`、`stryker.config.mjs`、`commitlint.config.cjs`
- 修改 `AGENTS.md`、`DESIGN.md`、`CONTRIBUTING.md`、`docs/operations.md`、`docs/verification-gauntlet.md`、`README.md`、`package.json`、`pnpm-lock.yaml`
- 删除 `app/result/` 目录或修改 `router.replace('/result')`
- 把 `Geist`（sans）也设 `preload: false`（sans 在所有页面都用，预加载有真实收益）
- 给 `/play` 加 `meta robots` / `canonical` / `og:image`（无 OG 图无意义，与本 plan 无关）
- 用 emoji 图标、内联 hex、Tailwind 原生色板、组件级 focus ring
- 在 `app/apple-icon.tsx` 内嵌入 SVG 字面量字符串（应抽取共享常量或直接 inline 节点，避免与 `app/icon.svg` 漂移）
- 把 `appleTouchIconHref` 探针断言写成必须等于某个具体 hash（应断言非 null；hash 是 Next.js 内置生成的）
- 在 `tests/qa/**` 新建 probe 文件（仅扩展现有 `visual-qa.mjs`）
- 用 `git commit --no-verify` 绕过 commit-msg hook
- 在 executor turn 内执行 `vercel --prod` 或任何 Vercel CLI/Dashboard 自动化操作
- 试图「消除」`/result` 的 RSC 请求（保留为零代码改动，是 App Router 模式演示窗口）

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + framework（vitest 不变，新增 vitest jsdom 探针通过 visual-qa.mjs；不动 vitest.config.ts / vitest.setup.ts / lib/** 测试）
- Evidence: `.omx/evidence/result-rsc-mobile-favicon-font-warnings/`
  - `task-{N}-build.log`：每 commit 后 `pnpm build` 输出
  - `task-{N}-vitest.log`：每 commit 后 `pnpm vitest run` 输出
  - `task-{N}-typecheck.log` + `task-{N}-lint.log`：每 commit 后两条命令输出
  - `task-{N}-commit-audit.log`：`node tests/qa/commit-audit.mjs --branch main` 输出
  - `visual-qa/qa-log.json`：扩展后 `node tests/qa/visual-qa.mjs` 输出的快照文件
  - `visual-qa/{0..N}-*.png`：5 张页面截图
  - `apple-touch-icon-link.txt`：`curl -s https://3t-tic-tac-toe.vercel.app/ | grep -o 'apple-touch-icon[^>]*' | head -1` 实测
  - `mono-preload-absent.txt`：`curl -s https://3t-tic-tac-toe.vercel.app/ | grep -c '797e433ab948586e'` 期望 0
- MOMUS 高精度复审：worker 执行前由 fresh-context `momus` 子代理复审 plan 文件，OKAY / ITERATE 两种结论

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

本 plan 2 份 commit 都是单文件改动 + visual-qa 1 份 commit 共 3 个 todo；waves 分布：
- **Wave 1（commit 1 apple-icon）** —— 1 todo，独立
- **Wave 2（commit 2 mono preload + commit 3 visual-qa 扩展）** —— 2 todo，可并行（commit 2 改 layout.tsx + commit 3 改 visual-qa.mjs，无重叠文件）
- **Wave 3（final verification wave）** —— F1/F2/F3/F4 全部并行
- **Pre-wave 0（MOMUS 高精度复审）** —— 在 worker 执行前，由 fresh-context `momus` 子代理对 `.omo/plans/result-rsc-mobile-favicon-font-warnings.md` 跑复审；OKAY → 进入 Wave 1，ITERATE → 修订 plan 后重跑

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 0. MOMUS 高精度复审 | 用户批准 plan | 1, 2, 3 | （独立前置） |
| 1. feat(icons): 自有 apple-icon | MOMUS OKAY | 4 (visual-qa 完整断言) | （与 2/3 文件不冲突，但视觉上 commit 1 先落、再 commit 3 才能加 appleTouchIconHref 断言 → 串行） |
| 2. fix(layout): 关 Geist Mono 预加载 | MOMUS OKAY | 3 (monoPreloadAbsent 断言依赖) | （与 1 文件不冲突，但与 3 视觉上串行） |
| 3. test(qa): visual-qa.mjs 扩展两字段断言 | 1, 2 | F1, F2, F3, F4 | （独立文件，但语义上需 1+2 先落） |
| F1. Plan compliance audit | 1, 2, 3 | （最终汇报） | F2, F3, F4 |
| F2. Code quality review | 1, 2, 3 | （最终汇报） | F1, F3, F4 |
| F3. Real manual QA | 1, 2, 3 | （最终汇报） | F1, F2, F4 |
| F4. Scope fidelity | 1, 2, 3 | （最终汇报） | F1, F2, F3 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

### Pre-wave (非 implementation todo): MOMUS 高精度复审（fresh-context subagent）

- [ ] PRE-MOMUS. MOMUS 高精度复审
  What to do / Must NOT do: 派一个 `momus` 角色子代理（用 `multi_agent_v1.spawn_agent({"message":"TASK: act as momus. DELIVERABLE: OKAY / ITERATE / REJECT verdict on the plan at .omo/plans/result-rsc-mobile-favicon-font-warnings.md, with specific line-level findings if ITERATE/REJECT. SCOPE: verify plan is executable as-written (paths exist, todos are startable, QA scenarios are concrete, no missing authority). VERIFY: re-read the plan file + sample 3 referenced source files (app/icon.svg, app/layout.tsx, tests/qa/visual-qa.mjs) + cross-check the dependency matrix + identify any silent gaps. EVIDENCE: structured verdict JSON saved to .omx/evidence/result-rsc-mobile-favicon-font-warnings/momus-verdict.json with {verdict, findings[], suggestions[], confidence}.","agent_type":"momus","fork_context":false})`）；等待 verdict；OKAY → 进入 Wave 1；ITERATE → 修订 plan 后重新派 momus；REJECT → 回退到 ulw-plan 阶段。
  Parallelization: Pre-wave | Blocked by: 用户批准 plan | Blocks: 1, 2, 3
  References: `.omo/plans/result-rsc-mobile-favicon-font-warnings.md`（本文件）
  Acceptance criteria: momus verdict OKAY，verdict JSON 落盘 `.omx/evidence/result-rsc-mobile-favicon-font-warnings/momus-verdict.json`
  QA scenarios: 父会话读取 verdict JSON，确认 verdict 字段 === 'OKAY' 且 findings 数组为空或仅含已采纳建议
  Commit: N

### Wave 1: apple-icon commit

- [ ] 1. feat(icons): 自有 apple-icon for iOS Safari/Chrome 主屏 + 标签
  What to do / Must NOT do: 新增文件 `app/apple-icon.tsx`，内容用 `next/og` `ImageResponse` 生成 180x180 PNG，复用 `app/icon.svg` 的色板（`#0b0f17` 背景 / `#e2e8f0` 棋盘线 / `#22d3ee` 青色 X / `#f472b6` 粉色 O）。必须导出 `size` + `contentType` + 默认函数返回 `ImageResponse`。**禁止**新增 npm 依赖、禁止写 emoji、禁止内联 hex（必须用色板常量或提取为顶部 const）、禁止在 `apple-icon.tsx` 内嵌 SVG 字符串字面量（应直接 inline React 节点）。**禁止**修改 `app/icon.svg`、`app/layout.tsx`、其它任何文件。**禁止**用 `git commit --no-verify`。
  Parallelization: Wave 1 | Blocked by: MOMUS OKAY (todo 0) | Blocks: 3（visual-qa 的 appleTouchIconHref 断言需 commit 1 先落）
  References: `app/icon.svg:1-9`（色板来源）；`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md:14-44`（Next.js 16 apple-icon 约束）；`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md:127-148`（ImageResponse + size + contentType 模式）；`node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md:216-228`（Favicons 章节）
  Acceptance criteria: `pnpm typecheck` exit 0；`pnpm lint` exit 0；`pnpm vitest run` exit 0（既有 88 个测试不变）；`pnpm build` exit 0 且 build 日志无新增 warning（warning 列表与 baseline 相比不扩大）；新文件 `app/apple-icon.tsx` 字数 ≤ 80 行
  QA scenarios: shell — `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build && git diff main~1 main -- app/apple-icon.tsx | grep -c '^+' | awk '$1<=80' && echo PASS` PASS；shell — `node tests/qa/commit-audit.mjs --message-file <(git log -1 --pretty=%B) && echo PASS` PASS；build 后 `find .next/server/app -name 'apple-icon*'` 应存在生成产物
  Evidence: `.omx/evidence/result-rsc-mobile-favicon-font-warnings/task-1-{typecheck,lint,vitest,build,commit-audit}.log`
  Commit: Y | `feat(icons): 自有 apple-icon for iOS Safari/Chrome 主屏 + 标签`

### Wave 2: mono preload commit + visual-qa commit（可并行）

- [ ] 2. fix(layout): 关 Geist Mono 预加载消除 'preloaded but not used' warning
  What to do / Must NOT do: 修改 `app/layout.tsx`，在 `Geist_Mono({...})` 调用对象中加 `preload: false`（一行改动）。**禁止**改 `subsets` / `variable` / 其它字段；**禁止**同时改 `Geist({...})`（sans）的任何字段；**禁止**改 `app/globals.css` 中的 `--font-mono` 定义；**禁止**把 `Geist_Mono` 移到 `components/StatsCard.tsx` 内（保留设计系统的全局 CSS var 语义）。**禁止**用 `git commit --no-verify`。
  Parallelization: Wave 2 | Blocked by: MOMUS OKAY (todo 0) | Blocks: 3（visual-qa 的 monoPreloadAbsent 断言需 commit 2 先落）
  References: `app/layout.tsx:12-17`（Geist_Mono 当前调用）；`app/globals.css:21`（`--font-mono` 定义）；`components/ui/StatsCard.tsx:13`（唯一使用 `font-mono` 的位置）；`app/play/page.tsx:1-95`（确认 /play 不渲染 StatsGrid 所以 mono 在 /play 不出现）；`node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md:184-194`（`preload: false` 语义）
  Acceptance criteria: `pnpm typecheck` exit 0；`pnpm lint` exit 0；`pnpm vitest run` exit 0；`pnpm build` exit 0；build 日志 warning 列表不扩大；`git diff main~1 main -- app/layout.tsx | grep -c '^+'` ≤ 5（净增 ≤ 5 行，仅 `preload: false` + 注释 + Plan 行 + trailer）
  QA scenarios: shell — `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build && git diff main~1 main -- app/layout.tsx | wc -l | awk '$1<=30 && /30$/ {exit 0} {exit 1}' && echo PASS` PASS；shell — `node tests/qa/commit-audit.mjs --message-file <(git log -1 --pretty=%B) && echo PASS` PASS
  Evidence: `.omx/evidence/result-rsc-mobile-favicon-font-warnings/task-2-{typecheck,lint,vitest,build,commit-audit}.log`
  Commit: Y | `fix(layout): 关 Geist Mono 预加载消除 'preloaded but not used' warning`

- [ ] 3. test(qa): visual-qa.mjs 扩展两字段断言（appleTouchIconHref + monoPreloadAbsent）
  What to do / Must NOT do: 修改 `tests/qa/visual-qa.mjs`，在 `snapshot(page)` helper 的返回对象里追加两个字段：`appleTouchIconHref`（`document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')`，期望非 null 字符串）和 `monoPreloadAbsent`（`!document.querySelector('link[rel="preload"][href*="797e433ab948586e"]')`，期望 `true`；如生产 hash 改变需更新 hash 前缀）。**禁止**新建 `tests/qa/*.mjs` probe 文件；**禁止**改 `tests/qa/launchQA` / `tests/qa/lib/browser.mjs` / 其它 probe；**禁止**改 vitest.config.ts / vitest.setup.ts（visual-qa 是独立 Playwright probe 不走 vitest）；**禁止**改 `app/` 任何文件（此 commit 仅扩展 probe）。**禁止**用 `git commit --no-verify`。
  Parallelization: Wave 2 | Blocked by: MOMUS OKAY (todo 0) | Blocks: F3（final verification 的真实手动 QA 读 visual-qa 输出）
  References: `tests/qa/visual-qa.mjs`（现有 snapshot helper 的结构）；`tests/qa/commit-audit.mjs`（commit message 校验器）；`tests/qa/lib/browser.mjs`（Playwright 启动器，不需修改但要确认可复用）
  Acceptance criteria: `pnpm typecheck` exit 0；`pnpm lint` exit 0；`pnpm vitest run` exit 0（vitest 不跑 visual-qa.mjs，所以即便改了 visual-qa.mjs 也不影响 vitest 结果）；`pnpm build && pnpm start &` 后 `node tests/qa/visual-qa.mjs` 跑完所有 5 个 stage，每个 stage 的 qa-log.json 含 `appleTouchIconHref`（非 null）和 `monoPreloadAbsent`（=== true）两个字段
  QA scenarios: shell — `pnpm build && pnpm start &` 启动生产服务；`node tests/qa/visual-qa.mjs` 跑完后 `jq '.stages[] | {url, appleTouchIconHref, monoPreloadAbsent}' .omx/evidence/visual-qa/qa-log.json` 应输出 5 行，每行 `appleTouchIconHref` 非 null + `monoPreloadAbsent === true`；shell — `node tests/qa/commit-audit.mjs --message-file <(git log -1 --pretty=%B) && echo PASS` PASS
  Evidence: `.omx/evidence/result-rsc-mobile-favicon-font-warnings/visual-qa/qa-log.json` + `visual-qa/{0..5}-*.png` 5 张截图 + `task-3-{typecheck,lint,vitest,build,visual-qa,commit-audit}.log`
  Commit: Y | `test(qa): visual-qa.mjs 扩展 appleTouchIconHref + monoPreloadAbsent 字段`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

### F1 具体口径
- 三 commit 各自独立 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 全绿
- `node tests/qa/commit-audit.mjs --branch main` 0 violations（lore trailer + Plan: footer 齐全）
- plan 文件存在：`.omo/plans/result-rsc-mobile-favicon-font-warnings.md` 与执行结果一致
- 末尾证据：`.omx/evidence/result-rsc-mobile-favicon-font-warnings/` 含 task-{1,2,3}-*.log + visual-qa/ 全部输出 + momus-verdict.json

### F2 具体口径
- `git diff main~3..main --stat` LOC ≤ 100、≤ 3 代码文件（`app/apple-icon.tsx` + `app/layout.tsx` + `tests/qa/visual-qa.mjs`），其它文件 0 改动
- commit 1 仅新增 `app/apple-icon.tsx`
- commit 2 仅改 `app/layout.tsx`（净增 ≤ 5 行）
- commit 3 仅改 `tests/qa/visual-qa.mjs`（净增 ≤ 30 行）
- 三 commit 顺序：apple-icon → mono preload → visual-qa 扩展
- 无新增 ESLint disable / `@ts-ignore` / `as any` / `console.log` / 调试器

### F3 具体口径
- `vercel --prod --yes` 部署到生产（由用户触发，不在 agent 射程内），部署成功后 `curl -s https://3t-tic-tac-toe.vercel.app/ | grep -o '<link rel="apple-touch-icon"[^>]*>'` 应输出一行
- `curl -s https://3t-tic-tac-toe.vercel.app/ | grep -c '/_next/static/immutable/media/797e433ab948586e'` 应输出 `0`（mono preload link 不存在；sans 字体仍然在）
- `.omx/evidence/result-rsc-mobile-favicon-font-warnings/visual-qa/qa-log.json` 5 个 stage 全部含 `appleTouchIconHref`（非 null）+ `monoPreloadAbsent`（=== true）
- 浏览器开发者工具 → Network → 加载任一路由 → 不应再看到 mono 字体的 `797e433ab948586e` 资源请求
- 浏览器开发者工具 → Console → 不应再看到 `The resource ... was preloaded using link preload but not used within a few seconds` 警告
- （可选 / 用户自验）iOS Safari 访问 https://3t-tic-tac-toe.vercel.app/ → 添加到主屏 → 主屏图标显示井字棋品牌；iPhone Chrome 同上

### F4 具体口径
- 改动文件集合 ⊆ `{app/apple-icon.tsx, app/layout.tsx, tests/qa/visual-qa.mjs}` = 3 个文件
- 0 lines changed in `lib/` / `db/` / `components/` / `app/api/` / `app/page.tsx` / `app/play/page.tsx` / `app/result/page.tsx` / `app/icon.svg` / `app/globals.css` / `next.config.ts` / `tsconfig.json` / `eslint.config.mjs` / `vitest.config.ts` / `stryker.config.mjs` / `commitlint.config.cjs` / `package.json` / `pnpm-lock.yaml` / `AGENTS.md` / `DESIGN.md` / `CONTRIBUTING.md` / `docs/operations.md` / `docs/verification-gauntlet.md` / `README.md` / `db/schema.ts`
- `/result` 路由 + `router.replace('/result')` + `app/result/page.tsx` 内容 0 改动
- 反模式审计：`grep -rn 'emoji' app/apple-icon.tsx` 必须 0 命中；`grep -rn '#[0-9a-fA-F]\{3,8\}' app/apple-icon.tsx` 只允许命中色板常量（`#0b0f17` / `#e2e8f0` / `#22d3ee` / `#f472b6`）；`grep -rn 'use client' app/apple-icon.tsx` 必须 0 命中（ImageResponse 是 server-side 渲染）
- DESIGN.md 视觉契约：apple-icon 与 `app/icon.svg` 色板完全一致（`#0b0f17` / `#e2e8f0` / `#22d3ee` / `#f472b6`），无视觉漂移
- 范围忠实性：未触碰除上述 3 文件外的任何文件；新文件存在 `app/apple-icon.tsx`；`app/layout.tsx` 唯一改动是 `preload: false` 一行

## Commit strategy
- **3 份原子 commit 落在 main**，每份独立 build + tests 全绿：
  1. `feat(icons): 自有 apple-icon for iOS Safari/Chrome 主屏 + 标签` —— 唯一改动：新增 `app/apple-icon.tsx`
  2. `fix(layout): 关 Geist Mono 预加载消除 'preloaded but not used' warning` —— 唯一改动：`app/layout.tsx` 加 `preload: false`（commit 顺序在 commit 1 之后，因为 commit 3 的 appleTouchIconHref 断言需 commit 1 先落；但 mono preload 与 apple-icon 互不依赖，故两个 commit 可并行实现，仅按顺序提交保证 git log 清晰）
  3. `test(qa): visual-qa.mjs 扩展 appleTouchIconHref + monoPreloadAbsent 字段` —— 唯一改动：`tests/qa/visual-qa.mjs` 在 `snapshot(page)` helper 里追加两个字段的断言
- 每份 commit 必须独立 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 全绿
- 每份 commit 必带完整 lore trailer（Constraint / Rejected / Confidence / Scope-risk / Directive / Tested / Not-tested）+ `Plan: .omo/plans/result-rsc-mobile-favicon-font-warnings.md` footer
- 三份 commit 的 `Not-tested:` 必显式声明 coverage / mutation / property 跳过原因（scope 不覆盖本次改动）：
  - Coverage: scope = `lib/**` + `db/**`，本次改动全在 `app/` + `tests/qa/`，跳过
  - Mutation: scope = `lib/game.ts` + `lib/db.ts` + `lib/store.ts` + `db/schema.ts`，本次改动不触及这 4 个文件，跳过
  - Property-based: scope = `lib/**/*.property.test.ts`，本次未新增纯函数文件，跳过
- commit 1 的 lore `Directive:` 段需写明：「iOS Safari/Chrome-on-iOS 仅识别 `apple-touch-icon`（PNG），不渲染 SVG favicon；SVG icon (`app/icon.svg`) 保留作为 `<link rel="icon">` 的来源以兼容桌面浏览器。任何后续 favicon 改动必须同时维护 SVG 和 apple-icon 两者，否则移动端会出现回退」
- commit 2 的 lore `Directive:` 段需写明：「`/result` 路由的 `_rsc=` 请求（`https://3t-tic-tac-toe.vercel.app/result?_rsc=jKAN-WMq0OtxauQd`）是 React tree 预取而非数据 fetch，是本项目刻意保留作为 Next.js 16 App Router 客户端导航 + 服务端组件的演示窗口；任何后续优化不应尝试消除该 RSC 请求」
- commit-msg 钩子由 `node tests/qa/commit-audit.mjs --message-file <(git log -1 --pretty=%B)` 兜底校验；不允许 `--no-verify`
- 不动 `main` 之外的分支；不动 `.omo/plans/favicon-analytics-warnings.md` 等历史 plan 的 footer

## Success criteria
- 浏览器打开 `https://3t-tic-tac-toe.vercel.app/` 后 `<head>` 含 `<link rel="apple-touch-icon" href="/apple-icon?<hash>" type="image/png">` + `<link rel="icon" href="/icon.svg?..." type="image/svg+xml">`（两者并存，桌面浏览器用 SVG、iOS 用 PNG）
- `pnpm build` warning 列表与 baseline 相比**未扩大**
- iOS Safari/Chrome-on-iOS 浏览器书签 / 主屏 / 地址栏显示品牌图标（青色 X / 粉色 O / 深色底），不再是 Next.js 默认 logo 或空白
- Chrome devtools 不再出现 `The resource https://3t-tic-tac-toe.vercel.app/_next/static/immutable/media/797e433ab948586e-*.woff2 was preloaded using link preload but not used within a few seconds` 警告
- `tests/qa/visual-qa.mjs` 跑完后 qa-log.json 的 5 个 stage 全部含 `appleTouchIconHref`（非 null）+ `monoPreloadAbsent`（=== true）两个新字段
- `node tests/qa/commit-audit.mjs --branch main` 0 violations
- `git log main -3 --format=%s` 三个主题前缀分别是 `feat(icons):` / `fix(layout):` / `test(qa):`，每个 `git log -1 --pretty=%b` 含完整 lore + Plan: footer
- `/result` 路由、`router.replace('/result')`、`app/result/page.tsx` 内容 0 改动（保留 RSC 请求作为 App Router 演示窗口）
- 0 新增 npm 依赖（`next/og` 随 next 16 自带）
- 改动文件 ⊆ `{app/apple-icon.tsx, app/layout.tsx, tests/qa/visual-qa.mjs}` = 3 个文件
- 无 ESLint disable / 无 `@ts-ignore` / 无 `as any` / 无 `console.log` / 无调试器
- MOMUS 高精度复审 verdict === OKAY，verdict JSON 落盘 `.omx/evidence/result-rsc-mobile-favicon-font-warnings/momus-verdict.json`
