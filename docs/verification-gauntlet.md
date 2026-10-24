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
| Property-based | fast-check 4 已装；`pnpm test:property = vitest run property`（substring 过滤命中 `lib/{game,store,db}.property.test.ts`） | ✅ 已配 | ⚠️ on-demand：commit 新增 `lib/X.ts` 纯函数时必跑 + 配套 `lib/X.property.test.ts`（当前 3 文件 15 条不变量：game 5 / store 5 / db 5）；**已进 CI**（2026-10-08 前从未进 CI——ci.yml `test` job 原仅 `pnpm test`；票 10 接线后该 job 增跑 `pnpm test:property` step，Plan: `.omo/plans/ulw-verification-infra-roadmap-20261007.md` §七票 10） | ❌ AGENTS.md §验证门禁未列；AGENTS.md 也未提及 `pnpm test:property` |

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
6. **探针 / CI job 触发面覆盖的结构性盲区（2026-09-30 验证波新增）**：CI 自
   2026-09-15 移除 push trigger 起仅 `pull_request` 触发（ci.yml 历史可查），dev push 不
   触发任何 CI job——凡不产生 PR 的改动面，CI 触发面语境下六层中依赖 CI 实跑的门禁全部静默
   （⑤commit-audit 系本地 hook、①tests ②typecheck ③lint 另有每 commit 本地纪律跑，本地执行
   不受影响；2026-10-04 表述精确化）。实证：rooms-race 探针 job
   漏传 `BASE_URL`，自进 CI 起约 6.3 天从未绿过（`e1ea4b1` 09-24 进 CI →
   `a2a667d` 10-01 单行修复），直至 PR #18 首跑红才现形。是否立项「dev push 触发 CI」待主公裁决（机械化候选 C6，未裁决不
   实施）；本波验证实践增补见文末「2026-09-30 验证实践补充」，生产设施操作边界属
   [`docs/operations.md`](./operations.md) §部署辖域，完整复盘见
   [`.omo/research-verification-trust-20260930.md`](../.omo/research-verification-trust-20260930.md)；反模式侧记 L1-32 见
   [`docs/anti-patterns.md`](./anti-patterns.md)（同源互链，2026-10-04 补回指——b5a3299 互链实为单向）。
   触发面豁免显式清单见 §5.1（票 4 · ✅D14 对本盲区的显式化收口——豁免不翻案，
   C6 悬置口径不变）。

## 5. CI 触发面豁免清单与「五必绿 ↔ 11 job」对账（票 4 · ✅D14 · 2026-10-08）

> 真源：`.omo/decisions-20261001.md` ✅D14 卡；验证基建路线图队列票 4（Plan: `.omo/plans/ulw-verification-infra-roadmap-20261007.md` §七）。机械断言载体：`tests/qa/ci-contract.test.ts`（BASE_URL 契约／豁免条目在档／对账表↔ci.yml job 集合双向一致／run_attempt=1 首跑绿口径在档，挂层①vitest）。

### 5.1 CI 触发面豁免清单（显式化）

| 豁免对象 | 现状（实测口径） | 纪律替代（本地侧） | 教训锚 | 解豁免通道 |
| --- | --- | --- | --- | --- |
| dev push | ci.yml `on:` 仅 `pull_request → main`，dev 直推零 CI——凡不产生 PR 的改动面，CI 侧全静默 | 六层本地每 commit 纪律跑（本文 §1＋[docs/commands.md](./commands.md) 验证六层） | L1-32：rooms-race 漏传 `BASE_URL` 约 6.3 天静默（§3.6） | 机械化候选 C6——主公裁决档，未裁决不翻案；本清单只显式化现状，不立项亦不驳回 |

### 5.2 「五 CI 必绿」↔ 11 job 对账表

「五 CI 必绿」系 [docs/branching.md](./branching.md) main-gate 措辞的历史口径（五门＝lint／typecheck／test／build／visual-qa）；main-gate ruleset 实测（2026-10-08 `gh api` rulesets，B 档外取通道）`required_status_checks` 已列 **11 contexts**＝ci.yml 全部 11 job（2026-09-25 T-L2 五 BR 探针 job 入 CI 时同步扩列，见 `tests/qa/probe-reconciliation.test.ts` 注记）。对账以本表为准；branching.md 措辞修订不属票 4 范围（记档不代改）。

| # | ci.yml job id | CI 实报 check 名（job `name:`） | ruleset required context（gh 实测） | 必绿档位 | 六层对应 |
| --- | --- | --- | --- | --- | --- |
| 1 | lint | Lint (ESLint) | Lint (ESLint) ✅ | 五必绿 | ③ |
| 2 | typecheck | Typecheck (tsc) | Typecheck (tsc) ✅ | 五必绿 | ② |
| 3 | test | Test (Vitest) | Test (Vitest) ✅ | 五必绿 | ① |
| 4 | build | Build (Next.js) | Build (Next.js) ✅ | 五必绿 | ④ |
| 5 | visual-qa | Visual QA (Playwright probe) | Visual QA (Playwright probe) ✅ | 五必绿 | ⑥ |
| 6 | rooms-race | Rooms-race QA (Playwright probe) | Rooms-race QA (Playwright probe) ✅ | 追加 BR 探针 | ⑥ |
| 7 | home-return-qa | Home-return QA (Playwright probe) — BR-1/2/3/5 | Home-return QA (Playwright probe) — BR-1/2/3/5 ✅ | 追加 BR 探针 | ⑥ |
| 8 | offline-mode-qa | Offline-mode QA (Playwright probe) — BR-4 | Offline-mode QA (Playwright probe) — BR-4 ✅ | 追加 BR 探针 | ⑥ |
| 9 | offline-qa | Offline QA / pure-local (Playwright probe) — BR-4 | Offline QA / pure-local (Playwright probe) — BR-4 ✅ | 追加 BR 探针 | ⑥ |
| 10 | online-direct-qa | Online-direct QA (Playwright probe) — BR-2/8 | Online-direct QA (Playwright probe) — BR-2/8 ✅ | 追加 BR 探针 | ⑥ |
| 11 | room-reset-qa | Room-reset QA (Playwright probe) — BR-7 | Room-reset QA (Playwright probe) — BR-7 ✅ | 追加 BR 探针 | ⑥ |

对账发现（2026-10-08，票 4 实测；第三列 ⚠️ 系 10-08 时点旧态，10-21 已修复，见下）：

- **命名错位（✅ 已于 2026-10-21 修复，方案 a）**：6 个 BR 探针 job 的 ruleset context 按 job id（小写）登记，而 CI 实报 check 名＝job `name:` 显示名（PR #18 head `1b80a99` 实测：`Rooms-race QA (Playwright probe)` 等）——required checks 按精确字符串匹配（GitHub 语义，inferred），该 6 contexts 与实报名不重合，ruleset 侧此 6 项形同虚设。
  **修复回执（2026-10-21，主公令「先修复」，随 PR #22 发版波执行）**：repo ruleset（id 23195249）`required_status_checks` 六 context 由 job id 改列 CI 实报显示名——新名单自 ci.yml `name:` 字段机械提取（零转抄），五必绿五项本就一致未动；PUT 写回实测 11 contexts 全部与实报名重合，PR #22 `mergeStateStatus` 当即 BLOCKED→CLEAN。改名防漂移无静态断言可拦（GitHub 侧配置面），对账依赖本表第 3/4 列人工或 gh api 复核。
- **行数对账**：本表 11 行＝`grep -cE "^  [a-z0-9-]+:$" .github/workflows/ci.yml`＝11；`tests/qa/ci-contract.test.ts` 持续断言表行 job id 集合与 ci.yml job id 集合双向相等，防 job 增删后本表漂移。

### 5.3 BASE_URL 契约（动作③）

每个探针 job 的探针 step 必须显式携带 `BASE_URL=http://localhost:<port>`，且端口与本 job 起 server 的 `PORT`（或裸 `pnpm start` 的 Next.js 默认 3000）一致——教训：rooms-race job 漏传 `BASE_URL`（server :3101／探针默认 :3000）自进 CI 起约 6.3 天未绿（`a2a667d` 修复，L1-32）。本票将 visual-qa step 补齐显式 `BASE_URL=http://localhost:3000`（与其探针默认值同值，行为零变），契约对全部 7 个探针 job 统一、无「默认端口例外」分支——默认值耦合正是 a2a667d 事故类。

### 5.4 EVIDENCE_DIR 三态核验——✅ 已终判＝「展开」并断言定版（2026-10-21）

- **疑点起点**：ci.yml 各探针 job `env.EVIDENCE_DIR: ${RUNNER_TEMP}/<name>` 系 shell 风格字面量；GitHub Actions 的 env 映射层不做 shell 展开（探针拿到字面 `${RUNNER_TEMP}/...` 串作相对路径用）。
- **10-08 判定＝「不展开」**（决定性证据：run 36748001707 运行时 `process.env.EVIDENCE_DIR` 字面含 `${RUNNER_TEMP}`；两条防误判教训：artifact 上传成功≠env 已展开、`##[group]Set up job` 回显段永远字面量不可作判据）。
- **初版修复 c451ee5 写法非法**：把 7 处改到 job 级 env `${{ runner.temp }}`，而 job 级 env 不允许 runner 上下文——整个 ci.yml 被判 invalid workflow（push 报 0s 失败 run 38509360622「Unrecognized named-value: 'runner'」×7、pull_request 静默不建 run；10-09~10-21 期间 CI 对新 PR 全盲，PR #22 首发现）。修正案 d9c608b＝EVIDENCE_DIR 下挪探针 step 级 env（step 级 runner 合法）。
- **2026-10-21 终判＝「展开」**：PR #22 run 39582362835，ci-verify 判据 [2] clean——env 已展开为 runner 真实绝对路径，锚行 `QA complete. … written to /home/runner/work/_temp/visual-qa`。D-1 至此闭环。
- **断言定版**：`tests/qa/ci-contract.test.ts` describe E（job 级 env 禁 runner——防 c451ee5 同型再犯）＋ describe F（探针 step 级 EVIDENCE_DIR 必须为 `${{ runner.temp }}/<name>` 写法——防丢失/回退 shell 字面量两态）。证据件：`.omo/evidence/ci-verify-20261021-pr22.md`（判据 [1][2][3] 全 clean）。

> 【2026-10-04 勘误补注】本条旧记「自进 CI 起 12 天从未绿过」系窗口错配——job 层（`e1ea4b1` 09-24 进 CI → `a2a667d` 10-01 修复）≈6.3 天；触发面盲区（`ca7e6ad` 09-15 移除 push trigger → PR #18 首跑红 09-30）≈15.9 天（粗值 15.6 系 UTC/本地混算，同日复核精确化）。verify 波实证更正，锚 .omo/verify-20261001-docs-wave.md:104-105/:186。

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

> 2026-10-09 层⑥验收语义记档（票 18 探针修复票清账）：⑥ 浏览器探针曾于 2026-10-08 票 2 走查首录 7 支存量过时红（入口漂移族 5 支、pwa 缓存名版本化、ux-qa dialog 相位）入 `scripts/verify-all.mjs` 的 KNOWN_STALE 基线——照跑照报 FAIL 不计 exit，语义对齐 ⑤ 层 commit-audit 的「历史豁免基线」；该豁免随票 18（2026-10-09，七支全修复、零退役）清账归零、机制随之移除，层⑥验收语义自此回到**「探针全绿」**：verify-all ⑥ 20/20 全 PASS，任一 FAIL 即 exit 1，新红零容忍。

> 2026-09-30 验证实践补充（验证信任沉淀波增补，六层框架不变，仅记三条实践要点）：
> ① **首跑绿收口判据**——rerun 绿与 admin bypass 混过不算数，`run_attempt=1` 首跑全绿才算收口（PR #18 流程实证，anti-patterns L1-33）；
> ② **本地复现定责法**——探针红先 `pnpm build` + 起 hermetic server（L0-8）本地三犯复现，区分「业务回归」与「探针过时」再动手（offline A2a/A2b → `1b80a99` 实证，anti-patterns L1-34）；
> ③ **生产边界实证两阶段**——生产设施操作须主公明示授权且 secret 值不回显；「生效」以状态迁移链 + 两态对照亲见为准；cron 类定时任务两阶段验证（今天手动验删除逻辑、明天 cron 验定时器）并预埋「必过线」造数行作为次日日志证据锚点。生产部署操作细节归 [`docs/operations.md`](./operations.md) §部署辖域（本注不重复其事实）；13 条经验全录与机械化候选 C6-C9 见 [`.omo/research-verification-trust-20260930.md`](../.omo/research-verification-trust-20260930.md)。两阶段验证已于 2026-10-02 fired 实证完结（cron 自动删除到期探针 id15/id8、余 6 行零漂移），判定梯子与 11-01 终验判据见同档 §六。
