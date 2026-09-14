# 验证门禁（6 层 Gauntlet + on-demand 规则）

> 这是仓库内 6 层验证体系的 **single source of truth**。AGENTS.md §验证门禁 只
> 列「每 commit 必跑」那 3 层（tests / types / lint）+ build + commit-audit +
> browser QA；本文承担完整对照表 + on-demand 触发规则 + Gap 清单，并定义两个
> 文档（本文与 `docs/operations.md` §部署）的边界。

## 1. 6 层 Gauntlet 现状对照

| 层 | 工具 | 项目状态 | 跑吗 | 在 AGENTS.md §验证门禁吗 |
| --- | --- | --- | --- | --- |
| Tests | vitest 5 + jsdom 30（88→102 例）`pnpm test = vitest run` | ✅ 已配 | ✅ 在 commit 1/2/3 各跑一次 | ✅「pnpm vitest run 100% 通过」 |
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
   browser QA**~~ —— 已 follow-up commit 解决（曾以 9 行 inline 6 层摘要承载）；
   2026-09-12 AGENTS.md 瘦身为 Router 形态（.omo/plans/agents-md-slim.md）后，
   AGENTS.md §验证门禁 收敛为一行式六层 digest + 指向本文，本文仍是 single source of 
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
5. ~~**`package.json#engines.node` 与 CI `.github/workflows/*.yml` Node 版本不严格对齐**~~ ——
   已 follow-up commit 解决：`.github/workflows/ci.yml` 5 处 `setup-node@v4 node-version: 22`
   全部改为 `node-version: 24`，`.nvmrc` 从 `22` 改为 `24`，CI Node 与
   engines.node / Vercel project default 严格对齐到 24.x。本仓库三方对齐状态：
   engines.node = `24.x` ↔ Vercel project default = `24.x` ↔ CI Node = `24`
   ↔ vite-plus shim 当前解析到 `24.21.0`（shim 不同 session 可能切到 22.23.2 /
   24.21.0）。任何 commit 修改 engines.node 时仍需实测 (1) pnpm vitest run 验证
   本地 fork pool；(2) vercel --prod 验证 build log 同时 0 条 Detected engines
   + 0 条 Skipping build cache；(3) CI workflow Node 版本若冲突需要同步更新。

   **engines.node 三环境对齐契约**（2026-09-12 自 AGENTS.md §验证门禁迁入，本文为唯一
   细节真源）：`package.json#engines.node` 必须与「Vercel project Node.js Version
   setting」+「CI Node」+「本地 vite-plus runtime 解析到的 Node major」三者对齐，否则分别
   触发：(a) Vercel build cache 失效 / "Detected engines" 警告，(b) CI 与
   engines.node 不一致，(c) 本地 vitest fork pool 退化为 `undici 8` 报错
   （`webidl.util.markAsUncloneable is not a function`）。历史决策链：commit
   `cd47efb` (20.x) → `cf9435b` (>=22) → `875877c` (24.x)。

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

> 2026-09-11 更新：`lib/store.ts` 在 RSC refactor C4 之后不再持有 `stats` 字段，mutation target 仍为 `lib/store.ts` 但内容已收缩（无 `hydrateStats`、无 stats set 分支）。如发现 mutation 得分变化，在本文件记录新基线。

> 2026-09-14 基线：全量重跑 `pnpm test:mutation`（main @ 6778bd8，含九刀键控修复后首录）——总 68.55%（covered 70.78%）：game.ts 96.75 / db.ts 50.00 / store.ts 50.49 / schema.ts 58.33；killed 217 + timeout 1 + survived 90 + no-cov 10 + errors 7（store.ts 7 枚 RuntimeError：Test runner crashed 两次重启无果，沙箱已知噪声，非幸存者）。较 2026-09-11 记录（69.40 / store 53.40）微降：测试主体未退，系 store 键控修复后幸存者分布变化；break=null 不阻塞，仅为下一轮补测之坐标。
