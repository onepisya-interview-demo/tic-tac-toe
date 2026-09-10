# 验证门禁（6 层 Gauntlet + on-demand 规则）

> 这是仓库内 6 层验证体系的 **single source of truth**。AGENTS.md §验证门禁 只
> 列「每 commit 必跑」那 3 层（tests / types / lint）+ build + commit-audit +
> browser QA；本文承担完整对照表 + on-demand 触发规则 + Gap 清单，并定义两个
> 文档（本文与 `docs/operations.md` §部署）的边界。

## 1. 6 层 Gauntlet 现状对照

| 层 | 工具 | 项目状态 | 跑吗 | 在 AGENTS.md §验证门禁吗 |
| --- | --- | --- | --- | --- |
| Tests | vitest 5 + jsdom 30（84→88 例）`pnpm test = vitest run` | ✅ 已配 | ✅ 在 commit 1/2/3 各跑一次 | ✅「pnpm vitest run 100% 通过」 |
| Types | tsc 5 strict `pnpm typecheck = tsc --noEmit` | ✅ 已配 | ✅ 在 commit 1/2/3 各跑一次 | ✅「pnpm typecheck 通过」 |
| Lint | eslint 9 + eslint-config-next/core-web-vitals + typescript，`pnpm lint = eslint`（不传参；等价于 `eslint .` 由 `eslint.config.mjs` 默认 targets + `globalIgnores(['tests/qa/**', ...])` 共同决定） | ✅ 已配 | ✅ 在 commit 1/2/3 各跑一次 | ✅「pnpm lint 通过」 |
| Changed-line coverage | vitest --coverage（v8 provider，scope = `lib/**` + `db/**`，thresholds: lines 80 / functions 80 / branches 70 / statements 80） | ⚠️ 部分配 | ❌ 本计划所有 commit **不跑**（scope 不覆盖 app/ + tests/qa/ + docs/，详见 §2 on-demand 规则）；未来 commit 触及 `lib/db` 时必跑 | ❌ AGENTS.md §验证门禁未列；只在「命令」段 |
| Mutation | Stryker 10 + vitest-runner（scope = `lib/game.ts` + `lib/db.ts` + `lib/store.ts` + `db/schema.ts`，break: null 信息性） | ✅ 已配 | ❌ 本计划所有 commit **不跑**（scope 不覆盖本次改动）；未来 commit 触及 4 个文件时必跑 | ❌ AGENTS.md §验证门禁未列；只在「命令」段 |
| Property-based | fast-check 4 已装；`pnpm test:property = vitest run property`（substring 过滤命中 `lib/game.property.test.ts`） | ✅ 已配 | ⚠️ on-demand：commit 新增 `lib/X.ts` 纯函数时必跑 + 配套 `lib/X.property.test.ts`（当前 `lib/game.property.test.ts` 5 条不变量） | ❌ AGENTS.md §验证门禁未列；AGENTS.md 也未提及 `pnpm test:property` |

## 2. On-demand 触发规则

下面三条规则定义「覆盖 scope 之外」的 commit 何时必须跑非默认的三层（coverage /
mutation / property）。本计划所有 commit 不命中任何一条，所以 Not-tested trailer
统一声明「scope 不覆盖本次改动」即可。

### Coverage 触发

- **条件**：commit 修改 `lib/**` 或 `db/**` 下任意文件。
- **启用步骤**：`pnpm test:coverage` 必须满足 vitest v8 thresholds（lines 80 /
  functions 80 / branches 70 / statements 80）。不满足即视为改动面破了覆盖阈值，
  不准提交。
- **Tested trailer 模板**：`Tested: pnpm test:coverage PASS (lines ≥ 80 / functions
  ≥ 80 / branches ≥ 70 / statements ≥ 80)`，并在 lore 里说明触发原因（本次触及
  `lib/<scope>`，见 diff）。

### Mutation 触发

- **条件**：commit 修改 4 个 Stryker scope 文件任一个：`lib/game.ts` / `lib/db.ts`
  / `lib/store.ts` / `db/schema.ts`。
- **启用步骤**：`pnpm test:mutation`（仓库已配置 vitest-runner + pnpm patches 适配
  Vitest 5）。Stryker 默认 `break: null`（信息性，不会失败），但 mutated score 显著
  退化（如从 80% 跌到 50%）必须人工判定。
- **Tested trailer 模板**：`Tested: pnpm test:mutation PASS (mutation score ≥ N%,
  scope 文件 4 项均被覆盖)`。

### Property-based 触发

- **条件**：commit 新增 `lib/X.ts` 纯函数（非 React 组件、非副作用模块）。
- **启用步骤**：新增 `lib/X.property.test.ts`（命名遵循 `*.property.test.ts` 即可，
  `pnpm test:property` 用 vitest substring 过滤 `property` 命中），用 `fast-check`
  的 `fc.assert(fc.property(...))` 形式写出至少一条不变量；`pnpm test:property`
  必须通过。当前仓库代表：`lib/game.property.test.ts`（5 条不变量）。
- **Tested trailer 模板**：`Tested: pnpm test:property PASS (新增 lib/X.ts 配套
  lib/X.property.test.ts，覆盖 ≤ N 条不变量)`。

## 3. Gap 清单（不在本次范围内，作为 follow-up anchor）

1. ~~**AGENTS.md §验证门禁只列了 3 层（test/typecheck/lint）+ build + commit-audit +
   browser QA**~~ —— 已 follow-up commit 解决：AGENTS.md §验证门禁 末尾追加 9 行 inline
   6 层摘要（Tests / Types / Lint / Build / Commit-audit / Browser QA 每 commit + 
   Coverage / Mutation / Property-based on-demand 三层），本文仍是 single source of 
   truth（thresholds / scope 数组 / 启用步骤 / Tested trailer 模板 / 其余 Gap 仍以本文为准）。
2. **Coverage / mutation / property 三层 scope 都不覆盖 `app/`、`components/`、
   `tests/qa/`**。本次 favicon-analytics-warnings 计划改动恰好命中这三个目录的
   边缘，所以三层在本计划所有 commit 主动跳过并在每个 commit 的 lore `Not-tested:`
   trailer 里写清。如未来想做 changed-line 覆盖守护，需要在 `vitest.config.ts` 里扩
   `coverage.include`、`stryker.config.mjs` 里扩 `mutate` 数组——这又是单独的 plan。
3. **`pnpm eslint .` 与 `pnpm lint` 的语义差**：本项目 `pnpm lint = eslint`（不传参），
   等价于 `eslint .` 由 `eslint.config.mjs` 默认 targets + `globalIgnores(['tests/qa/**',
   ...])` 共同决定；用户表里写的 `npx eslint .` 与 `pnpm lint` 在本项目结果一致，
   **不需要改命令**。
4. ~~**`pnpm test:property` 是空跑脚本**~~ —— 已 follow-up commit 解决：
   把 `lib/game.test.ts` 里的 fast-check describe 块（5 条不变量）搬到新建
   `lib/game.property.test.ts`，并把 `package.json#scripts.test:property` 从
   `vitest run lib/**/*.property.test.ts`（vitest 不识别 shell glob）改为
   `vitest run property`（vitest substring 过滤）；`pnpm test:property` 现在
   输出 Test Files 1 passed / Tests 5 passed。仓库首次出现 `*.property.test.ts`
   文件（`lib/game.property.test.ts`），未来新增 `lib/X.ts` 纯函数时按
   `lib/X.property.test.ts` 同模板配套。
5. **`package.json#engines.node` 与 CI `.github/workflows/*.yml` Node 版本不严格对齐**——
   当前 engines.node = `24.x`、CI `.nvmrc=22` / `setup-node@v4 node-version: 22`
   跑 Node 22，Vercel project Node.js Version = `24.x`。三方不是严格对齐：
   engines.node pin 到 24.x 时 Vercel 不报 Detected engines 警告且 build cache
   复用，但 CI 跑 Node 22 不在 engines.node 范围内（`24.x` ⊄ `>=22`，但 22 < 24
   严格违反 semver）—— 当前 CI 任务只跑 lint / typecheck / vitest 不打 Node
   原生模块，所以实际上没踩坑，但严格说 engines.node 24.x 应该跟 CI 一起升到
   Node 24 或 engines.node 放回 >=22 + 接受 Vercel 警告。本次保留 engines.node=24.x
   + CI Node=22 的「实际工作但语义不一致」状态，并把详细对位关系写到
   `AGENTS.md §验证门禁 末尾`（最近一次 follow-up commit 加的 inline 段落）。
   完整对位状态：engines.node = `24.x` ↔ Vercel project default = `24.x` ↔ 
   CI Node = `22`（`.nvmrc=22`）↔ vite-plus shim 当前解析到 `24.21.0`（shim
   不同 session 可能切到 22.23.2 / 24.21.0）。任何 commit 修改 engines.node 时
   必须实测 (1) pnpm vitest run 验证本地 fork pool；(2) vercel --prod 验证 build
   log 同时 0 条 Detected engines + 0 条 Skipping build cache；(3) CI workflow 
   Node 版本若冲突需要同步更新。

## 4. 与 `docs/operations.md` §部署 的边界

两文分工明确，避免双处真相互相打架：

- **`docs/operations.md` §部署** 关注部署告警的解决方案（favicon / viewport /
  metadataBase / Analytics 挂载）+ Vercel Dashboard 5 项人工清单（Build Multiple
  Deployments Simultaneously / Skew Protection / Secure Preview Deployments /
  Deployment Protection / Preview Deployment）。本文件「已解决部署警告（代码侧）」
  表里引用本文 §2 + §3，引用 on-demand 触发规则做覆盖率 / 变异 / 性质三层的一致性
  对齐。
- **`docs/verification-gauntlet.md`**（本文）关注代码层验证规则——6 层 gauntlet
  对照表 + on-demand 触发规则 + Gap 清单 + 与 operations.md 的边界。本文件「与
  docs/operations.md §部署 的边界」一节明确说本文不重复部署告警解决方案。
- 两文不重复同一份事实：当某条规则在两处都出现时，必须能在一文里找到另一文的引用
  链接（本文 §4 引 operations.md，operations.md「已解决部署警告」表引本文）。
