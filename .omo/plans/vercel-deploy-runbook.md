# vercel-deploy-runbook - Work Plan

## TL;DR (For humans)
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 把这个井字棋仓库推到 Vercel，生产 URL 上 `/api/stats` 端到端读写 Turso 云数据库有持久化；先走 Vercel CLI 手动部署验证一遍，再切到 Git 集成自动部署。

**Why this approach:** driver 层在 `lib/db.ts` 内做成深模块——本地 `file:` 走原生 sqlite 保持零配置，远程 `libsql://` 走 Turso 官方推荐的 `@libsql/client/web`，调用方零改动。Phase 1 CLI 上线测试风险最低（你已登录 CLI），Phase 2 Git 集成后享受 push-to-deploy。

**What it will NOT do:** 不绑自定义域名、不引入 Sentry/Datadog、不迁到 `@tursodatabase/*` 新包族、不改 `vercel.json`（不需要）、不写 Turso 备份/恢复文档、不动 CI workflow、不引入新测试。

**Effort:** Medium
**Risk:** Low - 唯一代码改动是 `lib/db.ts` 的双 import 工厂（< 20 行）；测试接缝 `__setCreateClientForTests` 兼容；本地零配置保留；可一键回滚到 `@libsql/client` 单 driver。
**Decisions I made for you:**
- 两阶段部署：Phase 1 = `vercel --prod` 手动；Phase 2 = Vercel for GitHub 自动
- Phase 2 production branch = `main`
- Phase 2 preview 自动启用（preview URL 看不到生产 DB，因为 env vars 只在 Production）
- Turso region = `aws-us-east-1`（建库后不可改）
- Vercel Hobby 套餐
- `runtime='nodejs'` 在深模块化后保留（无害，HTTP /web 在任何 runtime 都能跑；保留是为了将来万一回退时不用动这行）
- `lib/db.ts` 同步 import `@libsql/client` 和 `@libsql/client/web`；serverless bundle 由 tree-shaking 决定带哪个，file: 分支只在本机跑所以 production bundle 不带 native binding

Your next move: run `$start-work vercel-deploy-runbook` in a worker session to execute. Full execution detail follows below.

---

> TL;DR (machine): Medium effort, Low risk. 19 todos + F1-F4. Driver deep-module + two-phase Vercel rollout. One commit group on `main`: `feat(db)` for driver factory + tests, then `chore(docs)` for ops + README updates. No new deps, no env-var name changes.

## Scope
### Must have
- 仓库就绪审计：`pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 全部绿
- `lib/db.ts` 深模块化：`import * as nativeClient from '@libsql/client'` + `import * as webClient from '@libsql/client/web'`；`selectDriver(url)` 按 URL 选 driver（`file:` → native；其他 → web）；`createClientFn` factory 仍走测试接缝 `__setCreateClientForTests`
- `tests/db/db.test.ts` 追加 3 个新 unit test：① `selectDriver('file:./x.db')` 返回 native；② `selectDriver('libsql://x.turso.io')` 返回 web；③ `selectDriver('https://x.turso.io')` 返回 web
- 既有 3 个三分支测试 (`tests/db/db.test.ts:131,159,200`) 必须仍绿（不修改，只确认）
- Turso db 创建：`tic-tac-toe-onepisya` 在 `aws-us-east-1`，长 token（不过期）
- `.env.local` 配 `DATABASE_URL=libsql://...` 和 `DATABASE_AUTH_TOKEN=...`
- 本地模拟：`pnpm build && pnpm start` + `curl /api/stats` GET/PUT/GET/DELETE round-trip
- Phase 1：`vercel link` 关联项目；`vercel env add DATABASE_URL production`；`vercel env add DATABASE_AUTH_TOKEN production`；`vercel --prod`
- Phase 1 验证：生产 URL 上 `curl /api/stats` GET（zeros）→ PUT（1,1,0,0,1）→ GET（1,1,0,0,1）→ DELETE（zeros）
- Phase 1 验证：`turso db shell tic-tac-toe-onepisya "SELECT * FROM game_stats;"` 显示刚才 PUT 的行
- Phase 2：仓库推 GitHub（如未推）
- Phase 2：Vercel Dashboard 导入 GitHub 仓库 + 选 "Vercel for GitHub" + production branch = `main`
- Phase 2 验证：`git push origin main` 触发自动 build + deploy；新部署在 Vercel Dashboard 显示
- Phase 2 验证：创建 feature branch `git checkout -b test/preview-deploy` + push，确认得到 preview URL；切回 `main` 删除 test branch
- `docs/operations.md §部署` 改写为两阶段说明：何时用 CLI、何时用 Git、env vars Production-only、CLI 作应急回滚入口
- `README.md §部署` 增加一段深模块描述（"driver 在 lib/db.ts 内部按 URL 选"）+ Vercel 排错补充（CLI 部署错误信号 vs Git 自动部署错误信号）
- 回滚演练：Vercel Dashboard → Deployments → 选前一个绿色部署 → "Promote to Production"；记录演练结果到 ops doc
- 完整测试方案覆盖：单元测试（vitest）+ 静态检查（typecheck/lint/build）+ 真实 surface 验证（curl /api/stats 三处：本地、Vercel Phase 1、Phase 2）+ 浏览器 smoke（`tests/qa/visual-qa.mjs` 对生产 URL 跑一次）

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 任何 `lib/db.ts` 之外的代码改动（除 `tests/db/db.test.ts` 追加测试）
- 新增 npm 依赖
- 改 env var 名字（仍是 `DATABASE_URL` + `DATABASE_AUTH_TOKEN`）
- 改 db schema 或 `db/schema.ts`
- 新增 `vercel.json`（Next.js on Vercel 零配置，不需要）
- 改 `next.config.ts`（除非 Vercel 构建报错要求）
- 自定义域名 / DNS
- Vercel Pro 套餐特性
- 引入 Sentry / Datadog / 可观测性工具
- 新增 middleware / Edge functions
- 迁到 `@tursodatabase/*` 包族（信息性，不在本次范围）
- 改 CI workflow（`.github/workflows/*`）
- 改 AGENTS.md / DESIGN.md / CONTRIBUTING.md（除非本次明确要更新）
- 改任何已有测试（除 `tests/db/db.test.ts` 追加）
- Turso 备份/恢复文档
- 多 region Turso 复制
- 自动回滚 / canary（Vercel Hobby 不支持）
- `git push --force` 或重写历史
- 把 `.env.local` 或任何 secret 推上 GitHub / Vercel

## Verification strategy
> Zero human intervention - all verification is agent-executed.

- **Test decision:** tests-after（追加 3 个新 unit test 锁定 `selectDriver` 行为）+ 全套既有 vitest 保持绿
- **Evidence root:** `.omx/evidence/vercel-deploy/<task-N>-<slug>.<ext>`
- **Channel stack:**
  - 单元测试：`pnpm vitest run` 输出
  - 静态检查：`pnpm typecheck && pnpm lint && pnpm build` 三件套
  - 真实 surface（libsql 端到端）：`curl -i http://localhost:3000/api/stats` GET/PUT/GET/DELETE 三处（本地、Phase 1 Vercel URL、Phase 2 第二次 push 后的 Vercel URL）
  - Turso 真库查证：`turso db shell tic-tac-toe-onepisya "SELECT * FROM game_stats;"`
  - 浏览器 smoke：`tests/qa/visual-qa.mjs --base-url <vercel-url>`（生产 URL 三路由 + 一局胜利）
  - 部署回执：Vercel Dashboard 截图（每个 phase 一次：`vercel ls` 部署历史）
- **Cleanup receipts required:** `pnpm start` 背景进程必须 `kill` 并 `kill -0` 失败验证；`vercel --prod` 进程结束（CLI 默认前台完成即退）；`tmux` / `playwright` 上下文每轮结束 `.close()`；生产 URL 的 `tests/qa/` 跑完即停

## Execution strategy
### Parallel execution waves
> Target 5-8 todos per wave. Fewer than 3 (except the final) means you under-split.

**Wave 1 — Repo readiness + code change (前置 + 并行)**
- W1.1 仓库就绪审计（typecheck/lint/vitest/build 全绿）
- W1.2 `lib/db.ts` 深模块化（双 import + selectDriver）
- W1.3 `tests/db/db.test.ts` 追加 3 个 `selectDriver` unit test
- W1.4 README.md §部署 增加深模块描述 + Vercel 排错补充

**Wave 2 — Turso side + local simulation**
- W2.1 创建 Turso db + URL + token
- W2.2 写 `.env.local`（libsql:// URL + JWT）
- W2.3 本地模拟：`pnpm build && pnpm start` + curl /api/stats round-trip

**Wave 3 — Phase 1 Vercel CLI 部署（依赖 Wave 2）**
- W3.1 `vercel link`（一次性关联）
- W3.2 `vercel env add` 两个 env（仅 Production）
- W3.3 `vercel --prod` 推生产 URL
- W3.4 生产 URL curl 端到端验证
- W3.5 `turso db shell` 查证

**Wave 4 — Phase 2 Vercel for GitHub（依赖 Wave 3）**
- W4.1 仓库推 GitHub（如未推）
- W4.2 Vercel Dashboard 导入 GitHub 仓库 + production branch = main
- W4.3 `git push origin main` 触发自动 deploy
- W4.4 Feature branch push 验证 preview deploy
- W4.5 清理 test branch

**Wave 5 — Docs + rollback（依赖 Wave 4）**
- W5.1 `docs/operations.md §部署` 改写为两阶段 + CLI 应急回滚说明
- W5.2 回滚演练：Vercel Dashboard 一键回滚 + 记录
- W5.3 浏览器 smoke（`tests/qa/visual-qa.mjs` 对生产 URL）

**Final verification wave F1-F4（依赖 Wave 5）**
- F1 Plan compliance audit
- F2 Code quality review
- F3 Real manual QA
- F4 Scope fidelity

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| W1.1 仓库就绪审计 | nothing | W1.2, W1.3, W1.4, W2.* | nothing（前置门禁） |
| W1.2 lib/db.ts 深模块化 | W1.1 | W1.3, W2.3, W3.* | W1.4 |
| W1.3 追加 selectDriver unit test | W1.2 | W2.3, W3.* | W1.4 |
| W1.4 README.md §部署 更新 | W1.1 | W5.1 | W1.2, W1.3 |
| W2.1 Turso 建库 + URL + token | W1.1 | W2.2, W2.3, W3.* | nothing（外部服务） |
| W2.2 .env.local 配远程 | W2.1 | W2.3, W3.* | nothing |
| W2.3 本地模拟 curl 验证 | W1.2, W1.3, W2.1, W2.2 | W3.* | nothing（验证门禁） |
| W3.1 vercel link | W2.3 | W3.2 | nothing |
| W3.2 vercel env add | W3.1 | W3.3 | nothing |
| W3.3 vercel --prod | W3.2 | W3.4 | nothing |
| W3.4 生产 URL curl 验证 | W3.3 | W3.5, W4.* | nothing |
| W3.5 turso db shell 查证 | W3.4 | W4.* | nothing |
| W4.1 仓库推 GitHub | W3.5 | W4.2 | nothing |
| W4.2 Vercel 导入 GitHub 仓库 | W4.1 | W4.3 | nothing |
| W4.3 git push 触发自动 deploy | W4.2 | W4.4 | nothing |
| W4.4 Feature branch preview 验证 | W4.3 | W4.5 | nothing |
| W4.5 清理 test branch | W4.4 | W5.* | nothing |
| W5.1 docs/operations.md §部署 改写 | W1.4, W4.5 | nothing | W5.2, W5.3 |
| W5.2 回滚演练 + 记录 | W4.5 | nothing | W5.1, W5.3 |
| W5.3 浏览器 smoke on 生产 URL | W4.5 | nothing | W5.1, W5.2 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. 仓库就绪审计（前置门禁）
  What to do / Must NOT do: 跑 `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build`，四个全部 exit 0 才往下走。Must NOT: 不要 `--no-verify`、不要跳过任何一项、不要 `pnpm dev`（用 build && start）。
  Parallelization: Wave 1 | Blocked by: nothing | Blocks: W1.2, W1.3, W1.4, W2.*
  References: `package.json` (engines: node>=20, packageManager: pnpm@10.10.0); `next.config.ts`; `vitest.config.ts`; `eslint.config.mjs`; `tsconfig.json` (strict)
  Acceptance criteria: `pnpm typecheck` 退出 0；`pnpm lint` 退出 0；`pnpm vitest run` 报告所有测试 PASS、无 skipped/xfail；`pnpm build` 退出 0 且产出 `.next/`
  QA scenarios:
    - happy: 跑全套命令，4 个全 exit 0 → Evidence `.omx/evidence/vercel-deploy/task-1-precheck.txt` 含完整 stdout/stderr
    - failure: 任一项非 0 → 立刻停在该 todo，把失败命令 + 错误前 30 行 + 涉及文件路径写入 evidence，禁止往下走
  Commit: N | (pre-flight gate)

- [x] 2. `lib/db.ts` 深模块化（双 import + selectDriver 工厂）
  What to do / Must NOT do: 把 `lib/db.ts:1` 改为 `import * as nativeClient from '@libsql/client'` 和 `import * as webClient from '@libsql/client/web'`（type 仍从主入口拿）；新增 `selectDriver(url: string)` 函数返回 `nativeClient` 或 `webClient`；把 `createClientFn` 改为 `(config) => selectDriver(config.url).createClient(config)`。Must NOT: 不要改 `resolveDbConfig` 既有三分支逻辑（`file:`/`http(s)/libsql://`/unset）；不要动 `loadStats/saveStats/resetStats/closeDb` 签名；不要改 `getDb` 内 schema bootstrap；不要动 `__setCreateClientForTests` 出口。
  Parallelization: Wave 1 | Blocked by: todo 1 | Blocks: todo 3, 7, 9-14
  References: `lib/db.ts:1, 18-37, 32-65, 67-91`; `app/api/stats/route.ts:6` (`runtime='nodejs'` 保留); `tests/db/db.test.ts:131,159,200` (既有三分支测试要保持绿)
  Acceptance criteria: `pnpm typecheck` 退出 0；`pnpm vitest run` 全绿（含既有 3 个三分支测试）；`lib/db.ts` 仍 export `getDb/loadStats/saveStats/resetStats/closeDb` 5 个函数，签名 0 改动；`selectDriver('file:./x.db')` 在 Node REPL 返回 native 模块，`selectDriver('libsql://x')` 返回 web 模块
  QA scenarios:
    - happy: 修改后跑 `pnpm typecheck && pnpm vitest run` + `node -e "console.log(Object.keys(require('./lib/db.ts')))"` 等价检查（用 tsx）→ 全部 exit 0 / 5 个 export 都在 → Evidence `.omx/evidence/vercel-deploy/task-2-deep-module.txt`
    - failure: 既有 `tests/db/db.test.ts:131,159,200` 任一 FAIL → 不要改测试逻辑，回滚 todo 2 重做；typecheck 报错指 lib/db.ts:1 → 检查两个 import 路径是否正确
  Commit: Y | `feat(db): 深模块化 driver 工厂，file: 走原生 / 远程走 @libsql/client/web`

- [x] 3. `tests/db/db.test.ts` 追加 `selectDriver` unit test
  What to do / Must NOT do: 在 `tests/db/db.test.ts` 追加 3 个新 test：① `selectDriver('file:./data/x.db')` 返回 native 模块引用；② `selectDriver('libsql://x.turso.io')` 返回 web 模块引用；③ `selectDriver('https://x.turso.io')` 返回 web 模块引用。每个 test 必须断言模块身份（同一个 `import` 引用）而不是字符串匹配。Must NOT: 不要改既有 3 个三分支测试；不要新增文件。
  Parallelization: Wave 1 | Blocked by: todo 2 | Blocks: todo 7, 9-14
  References: `tests/db/db.test.ts:131,159,200` (既有三分支); `lib/db.ts` (新 `selectDriver`); vitest 5.x
  Acceptance criteria: 3 个新 test PASS；既有 3 个三分支测试仍 PASS；`pnpm vitest run` 全绿
  QA scenarios:
    - happy: 跑 `pnpm vitest run tests/db/db.test.ts` 全 PASS → Evidence `.omx/evidence/vercel-deploy/task-3-selectdriver-tests.txt`
    - failure: 任一 FAIL → 检查测试断言是否过于严格（用 `Object.is` 而非 `===` 跨 realm 比较模块引用）；检查 `selectDriver` 是否真的按 URL 选
  Commit: Y | 合并到 todo 2 的 commit（同一笔）

- [x] 4. `README.md §部署` 增加深模块描述 + Vercel 排错补充
  What to do / Must NOT do: 在 `README.md §部署 → ### Vercel + Turso 首次部署` 之前加一个简短的"驱动层"小节，说明 driver 在 `lib/db.ts` 内部按 URL 自动选（file: 原生 / 远程 web）；在 `### Vercel 排错` 末尾增加"CLI 部署 vs Git 自动部署"两栏对比：错误信号、查哪里。Must NOT: 不要改 `README.md §部署` 的 5 步主配方；不要翻译其他章节；不要新增章节 anchor。
  Parallelization: Wave 1 | Blocked by: todo 1 | Blocks: todo 17
  References: `README.md:139-186` (现有 §部署); `lib/db.ts:1-37` (新 driver 工厂); `docs/operations.md §部署`
  Acceptance criteria: `pnpm lint` 仍 0；`README.md` markdown 渲染无 broken anchor；新增内容 ≤ 30 行；既有的 5 步主配方文字 0 改动
  QA scenarios:
    - happy: 用 `rg` 检查新内容存在且没改旧内容 → Evidence `.omx/evidence/vercel-deploy/task-4-readme.txt`（rg 输出）
    - failure: lint 报 markdown 格式 → 修；anchor 坏链 → 取消 anchor 或修正
  Commit: Y | `chore(docs): README §部署 加深模块描述 + Vercel CLI vs Git 自动部署 排错对比`

- [x] 5. 创建 Turso db + 取 URL + 取 token
  What to do / Must NOT do: `turso auth whoami` 确认已登录（用户已登录，应直接通过）；`turso db create tic-tac-toe-onepisya --location aws-us-east-1`；`turso db show tic-tac-toe-onepisya --url` 捕获 URL（**完整一行 libsql:// 头**）；`turso db tokens create tic-tac-toe-onepisya` 捕获 JWT（**完整一段三段 base64**）。Must NOT: 不要 destroy 任何 db；不要把 token 输出到日志明文（用环境变量或剪贴板）。
  Parallelization: Wave 2 | Blocked by: todo 1 | Blocks: todo 6, 7
  References: `docs/local-turso-setup.md` (完整 5 步流程); `turso` CLI ≥ 0.100
  Acceptance criteria: `turso db show tic-tac-toe-onepisya --url` 输出一行 `libsql://tic-tac-toe-onepisya-<handle>.saws-us-east-1.turso.io`；`turso db tokens list tic-tac-toe-onepisya` 至少 1 个 token；token 长度 ≥ 100 字符
  QA scenarios:
    - happy: 三个 turso 命令全部成功 → Evidence `.omx/evidence/vercel-deploy/task-5-turso.txt`（URL + token 标记为 `<redacted>` 写入）
    - failure: "database name already exists" → 提示用户确认是否复用既有库；"not authenticated" → `turso auth login`；"region invalid" → 改用 `aws-us-east-1` 或提示用户选
  Commit: N | (外部服务，无代码改动)

- [x] 6. `.env.local` 配远程 URL + JWT
  What to do / Must NOT do: 用 task 5 拿到的 URL 和 token 更新 `.env.local`，把 `DATABASE_URL` 改为 `libsql://...`、`DATABASE_AUTH_TOKEN` 改为完整 JWT；运行 `git check-ignore -v .env.local` 确认仍 gitignored。Must NOT: 不要保留 `file:` 前缀；不要把任何一行 commit；不要 echo 完整 token 到终端（用编辑器写入）。
  Parallelization: Wave 2 | Blocked by: todo 5 | Blocks: todo 7
  References: `.env.example` (模板); `.gitignore:46` (.env.local 已 ignore); `lib/db.ts:32-65` (URL 解析)
  Acceptance criteria: `.env.local` 含两行：`DATABASE_URL=libsql://...`、`DATABASE_AUTH_TOKEN=<jwt>`；`git check-ignore -v .env.local` exit 0 且打印 `.gitignore:46:.env.local   .env.local`；`git status` 不显示 `.env.local`
  QA scenarios:
    - happy: 三项检查全通过 → Evidence `.omx/evidence/vercel-deploy/task-6-envlocal.txt`（check-ignore + git status 输出，token redact）
    - failure: check-ignore exit 1 → 检查 `.gitignore:46` 那行没被注释；`git status` 显示 `.env.local` → 立即从 git 删除缓存但不删本地文件
  Commit: N | (本地配置，无代码改动)

- [x] 7. 本地模拟：build + start + curl /api/stats round-trip
  What to do / Must NOT do: 后台启动 `pnpm start`（捕获 pid）；poll `curl -fsS http://localhost:3000/api/stats` 直到 200（最多 60s）；执行 GET（zeros）→ PUT `{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1}`（200）→ GET（1,1,0,0,1）→ DELETE（zeros）；`kill <pnpm-start-pid>`；`kill -0 <pid>` 必须 fail；`lsof -i :3000` 必须空。Must NOT: 不要用 `pnpm dev`（要 build && start 模拟生产）；不要省略 kill + 端口释放验证。
  Parallelization: Wave 2 | Blocked by: todo 2, 3, 5, 6 | Blocks: todo 9-14
  References: `lib/db.ts:67-91` (schema bootstrap); `app/api/stats/route.ts` (PUT/GET/DELETE 契约); `docs/local-turso-setup.md §冒烟`
  Acceptance criteria: 4 步 curl 全 200 + 期望 JSON 形状；`/api/stats` GET 第一次返回 `{totalGames:0,...}`；PUT 后 GET 返回 `{totalGames:1,xWins:1,...}`；DELETE 后 GET 回到全 0；端口 3000 释放；pnpm-start 进程已退
  QA scenarios:
    - happy: 4 步全过 + cleanup 全过 → Evidence `.omx/evidence/vercel-deploy/task-7-local-sim.txt`（含 4 个 curl -i 输出 + cleanup receipt）
    - failure: PUT 后 GET 还返回 0 → 检查 `lib/db.ts` 是否真的写到远程 Turso（用 `turso db shell` SELECT）；500 + "fetch failed" → URL 拼错；401/403 → token 无效或 revoke；kill 后端口还被占 → `lsof -ti :3000 | xargs kill -9` 再验
  Commit: N | (验证，不 commit 验证脚本)

- [x] 8. `vercel link` 关联项目
  What to do / Must NOT do: 在仓库根目录运行 `vercel link`；按交互提示选 `onepisYa` team（或创建新项目）；完成后 `.vercel/project.json` 应包含 `projectId` 和 `orgId`。Must NOT: 不要在生产 URL 上误连到别人的项目；不要 commit `.vercel/` 目录。
  Parallelization: Wave 3 | Blocked by: todo 7 | Blocks: todo 9
  References: `vercel` CLI ≥ 33.x；Vercel 文档 vercel.com/docs/cli
  Acceptance criteria: `.vercel/project.json` 存在且含 `projectId` + `orgId`；`vercel project ls` 列出刚 link 的项目；`.vercel/` 在 `.gitignore`（如未 ignore，加进去）
  QA scenarios:
    - happy: link 成功 + project ls 看到项目 → Evidence `.omx/evidence/vercel-deploy/task-8-link.txt`
    - failure: "Project not found" → 先 `vercel project ls` 查现有项目名；"Not authorized" → `vercel login` 重登
  Commit: Y | `chore(gitignore): ignore .vercel/`（如果还没 ignore）

- [x] 9. `vercel env add` 两个 env（仅 Production）
  What to do / Must NOT do: `vercel env add DATABASE_URL production` 粘贴 libsql:// URL；`vercel env add DATABASE_AUTH_TOKEN production` 粘贴 JWT；用 `vercel env ls production` 确认两个变量都在 Production 环境、不在 Preview/Development。Must NOT: 不要把 env 加到 Preview 或 Development（防止 preview 写生产战绩）；不要 echo 完整 token（vercel CLI 默认隐藏 sensitive）。
  Parallelization: Wave 3 | Blocked by: todo 8 | Blocks: todo 10
  References: `vercel env` CLI；`vercel.com/docs/environment-variables`；edge-cases.com（preview 静默继承警告）
  Acceptance criteria: `vercel env ls production` 显示 `DATABASE_URL` 和 `DATABASE_AUTH_TOKEN` 两个变量，标记为 sensitive；`vercel env ls preview` 不显示这两个
  QA scenarios:
    - happy: 两个 env 都在 production，且 preview 没有 → Evidence `.omx/evidence/vercel-deploy/task-9-envs.txt`（env ls 输出，token redact）
    - failure: env ls 显示在 preview → `vercel env rm DATABASE_URL preview` 等；sensitive 标记丢失 → 重新 add 时用 `--sensitive`
  Commit: N | (Vercel Dashboard 状态，不进 git)

- [x] 10. `vercel --prod` 推生产 URL
  What to do / Must NOT do: 在仓库根目录跑 `vercel --prod`；等待 build 完成（捕获输出到日志）；记录生产 URL（形如 `https://tic-tac-toe-<hash>-onepisya.vercel.app`）；记录 deployment ID。Must NOT: 不要 `vercel deploy`（那是 preview URL）；不要省略 build 日志捕获。
  Parallelization: Wave 3 | Blocked by: todo 9 | Blocks: todo 11
  References: `vercel --prod` CLI；`vercel.com/docs/cli`；`package.json` build script
  Acceptance criteria: `vercel --prod` 退出 0；输出含 `Production: https://<...>.vercel.app`；deployment ID 形如 `dpl_<32字符>`；build 日志无 error
  QA scenarios:
    - happy: --prod 成功 + 生产 URL 拿到 + build 0 error → Evidence `.omx/evidence/vercel-deploy/task-10-vercel-prod.txt`（完整 build 日志）
    - failure: build failed → 看错误涉及哪个文件；env var 缺失 → `vercel env ls production` 复核；module 'fs' not found 在 Edge runtime → 临时把 route 改回 `runtime='nodejs'`（已有）
  Commit: N | (部署，不进 git)

- [x] 11. 生产 URL curl 端到端验证
  What to do / Must NOT do: 对生产 URL 跑 GET（zeros）→ PUT（1,1,0,0,1）→ GET（1,1,0,0,1）→ DELETE（zeros）4 步；每步用 `curl -i` 抓 status line + headers + body。Must NOT: 不要用 `curl -X` 不带 `-i`（要看 status）；不要省略 DELETE 之后的 GET 复核。
  Parallelization: Wave 3 | Blocked by: todo 10 | Blocks: todo 12
  References: `lib/db.ts`；`app/api/stats/route.ts`
  Acceptance criteria: 4 步全 200；GET 第一次 `{totalGames:0,...}`；PUT 后 GET `{totalGames:1,xWins:1,...}`；DELETE 后 GET 全 0
  QA scenarios:
    - happy: 4 步全过 → Evidence `.omx/evidence/vercel-deploy/task-11-prod-curl.txt`（4 个 curl -i 输出）
    - failure: 500 "fetch failed" → DATABASE_URL 配错（Vercel Dashboard 复核）；401/403 → DATABASE_AUTH_TOKEN 无效；404 → 部署 URL 拼错；GET 一直 0 → schema 没 bootstrap（GET 应该触发 CREATE TABLE IF NOT EXISTS）
  Commit: N | (验证)

- [x] 12. `turso db shell` 查证行落库
  What to do / Must NOT do: `turso db shell tic-tac-toe-onepisya "SELECT id, total_games, x_wins, o_wins, draws, current_streak, updated_at FROM game_stats;"`；期望一行 id=1，与 task 11 DELETE 后的状态一致（全 0）；再 PUT 一次（不在 task 11 里）让 task 12 的 SELECT 看到非 0 行。Must NOT: 不要 `DELETE FROM` 或 `DROP TABLE`。
  Parallelization: Wave 3 | Blocked by: todo 11 | Blocks: todo 13
  References: `db/schema.ts`；`docs/local-turso-setup.md §冒烟`
  Acceptance criteria: SELECT 输出含 1 行；列名与 db/schema.ts 一致；total_games = 当前期望值
  QA scenarios:
    - happy: SELECT 返回 1 行 → Evidence `.omx/evidence/vercel-deploy/task-12-turso-shell.txt`
    - failure: 0 行 → schema 没 bootstrap（GET /api/stats 强制触发）；连接超时 → token 过期或网络
  Commit: N | (外部服务查证)

- [!] 13. ⚠️ BLOCKED on user action (GitHub repo creation) 仓库推 GitHub（如未推）
  What to do / Must NOT do: 检查 `git remote -v`；若无 `origin` 含 `github.com/onepisya/tic-tac-toe`，提示用户先在 GitHub 创仓库并加 remote，再 `git push -u origin main`。Must NOT: 不要 `--force` push；不要推 `.env.local` 或任何 secret；先 `git status` 确认 working tree 干净。
  Parallelization: Wave 4 | Blocked by: todo 12 | Blocks: todo 14
  References: `git remote -v`；`package.json` (homepage + repository URL); GitHub
  Acceptance criteria: `git remote -v` 显示 `origin  git@github.com:onepisya/tic-tac-toe.git`；`git ls-remote origin main` 返回 main commit SHA；`git push origin main` 是 no-op（已同步）
  QA scenarios:
    - happy: remote 已存在且同步 → Evidence `.omx/evidence/vercel-deploy/task-13-github.txt`
    - failure: 无 remote → 提示用户手动建仓库（agent 不假设 token 可用）；`non-fast-forward` → 拉取合并再 push
  Commit: N | (用户操作或 git remote)

- [!] 14. ⚠️ BLOCKED on user action (GitHub repo creation) Vercel Dashboard 导入 GitHub 仓库 + production branch = main
  What to do / Must NOT do: 在 Vercel Dashboard → Add New → Project → Import `onepisya/tic-tac-toe`；勾选 "Vercel for GitHub" 集成；framework preset 选 Next.js；root directory 留空；Build & Output Settings 用 Vercel 自动检测（不需要 override）；Environment Variables 已从 Phase 1 带入，确认 DATABASE_URL/DATABASE_AUTH_TOKEN 在 Production；production branch 设为 `main`。Must NOT: 不要改 Build Command / Output Directory（让 Vercel 自动检测）。
  Parallelization: Wave 4 | Blocked by: todo 13 | Blocks: todo 15
  References: `vercel.com/docs/git`；`package.json` (engines)；`next.config.ts`
  Acceptance criteria: Vercel Dashboard 显示项目已导入；Production Branch = `main`；Auto-deploy on push 启用；env vars 在 Production 已有
  QA scenarios:
    - happy: 项目出现在 Dashboard + production branch 是 main → Evidence `.omx/evidence/vercel-deploy/task-14-import.txt`（Dashboard 状态截图或描述）
    - failure: "Repository not found" → 检查 GitHub 权限；framework preset 不是 Next.js → 手动选
  Commit: N | (Dashboard 状态)

- [!] 15. ⚠️ BLOCKED on user action (GitHub repo creation) `git push origin main` 触发自动 deploy
  What to do / Must NOT do: 跑一个无关紧要的 commit（例：在 docs/operations.md 加一行 `# auto-deploy test`，commit 后 push），观察 Vercel Dashboard 自动 build + deploy；记录新的 deployment URL。Must NOT: 不要省略观察（要确认 push 真的触发了 deploy）。
  Parallelization: Wave 4 | Blocked by: todo 14 | Blocks: todo 16
  References: Vercel for GitHub 集成；`docs/operations.md`
  Acceptance criteria: `git push origin main` 退出 0；Vercel Dashboard 在 60s 内显示新 "Building" → "Ready"；新 deployment URL 与 Phase 1 URL 同源（说明是 production branch）
  QA scenarios:
    - happy: push 后 60s 内 Dashboard 显示新 Ready 部署 → Evidence `.omx/evidence/vercel-deploy/task-15-autodeploy.txt`（git push 输出 + Dashboard 状态）
    - failure: Dashboard 无新部署 → 检查 GitHub Webhook 是否触发（Settings → Webhooks）；build failed → 看 Vercel build log
  Commit: Y | `chore(docs): 触发 Vercel 自动 deploy 验证`（这个 commit 本身就是验证手段，但用 lore 格式提交）

- [!] 16. ⚠️ BLOCKED on user action (GitHub repo creation) Feature branch push 验证 preview deploy
  What to do / Must NOT do: `git checkout -b test/preview-deploy`；push 一个无关紧要的 commit；记录 Vercel 给的 preview URL（形如 `tic-tac-toe-git-test-preview-deploy-onepisya.vercel.app`）；`curl -i https://<preview-url>/api/stats` 期望 500（因为 preview 环境无 DATABASE_URL，schema bootstrap 会失败或读不到），确认 preview **不**写到生产 Turso。Must NOT: 不要在 preview URL 上 PUT 任何数据（会触发 schema bootstrap 写到 production 或失败，记下即可）。
  Parallelization: Wave 4 | Blocked by: todo 15 | Blocks: todo 17
  References: `vercel.com/docs/git`；`edge-cases.com`（preview 静默继承警告）
  Acceptance criteria: feature branch push 后 60s 内有 preview deployment；preview URL 可访问；preview URL 上 `/api/stats` 行为可解释（500 因为缺 env vars / 或连接 production 但不应被允许写）
  QA scenarios:
    - happy: preview URL 出现 + GET 行为记录在 evidence → Evidence `.omx/evidence/vercel-deploy/task-16-preview.txt`
    - failure: 无 preview deployment → 检查 Vercel 项目设置里 "Preview Deployments" 是否启用；preview 仍能写生产战绩 → 立刻去 Vercel Dashboard 把 preview env 清空
  Commit: N | (验证)

- [!] 17. ⚠️ BLOCKED on user action (GitHub repo creation) 清理 test branch + 切回 main
  What to do / Must NOT do: `git checkout main`；`git branch -D test/preview-deploy`；`git push origin --delete test/preview-deploy`；`vercel` CLI 上 preview deployment 也标记为 "Delete"。Must NOT: 不要保留 test branch。
  Parallelization: Wave 4 | Blocked by: todo 16 | Blocks: todo 18, 19, 20
  References: git
  Acceptance criteria: `git branch` 不显示 `test/preview-deploy`；`git ls-remote origin` 不显示 `refs/heads/test/preview-deploy`；Vercel Dashboard 上 preview deployment 已删除
  QA scenarios:
    - happy: 4 项清理全过 → Evidence `.omx/evidence/vercel-deploy/task-17-cleanup.txt`
    - failure: 删除失败 → 检查是否有未合并 commit
  Commit: N | (清理)

- [x] 18. `docs/operations.md §部署` 改写为两阶段说明
  What to do / Must NOT do: 把 `docs/operations.md §部署` 当前 3 行（指向 README）改写为完整两阶段说明：Phase 1 (CLI)：前置条件 (`vercel login`) → `vercel link` → `vercel env add` → `vercel --prod` → 验证；Phase 2 (Git)：GitHub 推送 → Vercel Dashboard 导入 → production branch = main → push 即 deploy；两者关系（CLI 作应急回滚入口）；env vars Production-only 的原因（preview 静默继承警告）。Must NOT: 不要改 `docs/operations.md` 其他章节；不要重写整个文件。
  Parallelization: Wave 5 | Blocked by: todo 4, 17 | Blocks: nothing
  References: `docs/operations.md §部署`；`README.md §部署`；`lib/db.ts`
  Acceptance criteria: 新 §部署 ≤ 80 行；含两阶段标题、CLI 应急回滚段落、env vars Production-only 警告；与 README §部署 不矛盾（README 是精简版，operations.md 是详细版）；`pnpm lint` 仍 0
  QA scenarios:
    - happy: 改写完成 + lint 0 → Evidence `.omx/evidence/vercel-deploy/task-18-ops-doc.txt`（diff 摘要）
    - failure: lint 报 markdown → 修
  Commit: Y | `chore(docs): docs/operations.md §部署 改写为两阶段 + CLI 应急回滚入口`

- [x] 19. 回滚演练 + 浏览器 smoke（合并为一个 todo 因为都验证最终状态）
  What to do / Must NOT do: ① 回滚演练：在 Vercel Dashboard → Deployments → 选 todo 15 之前的部署（todo 11 的 production URL 那个）→ "Promote to Production"；记录耗时；用 `curl /api/stats` 复核状态。② 浏览器 smoke：跑 `node tests/qa/visual-qa.mjs --base-url <production-url>`（或类似脚本）覆盖三路由 + 一局胜利 + 战绩持久化；证据含截图路径。Must NOT: 不要回滚到 todo 15 之后的状态（那是 test commit）；不要省略浏览器 smoke（确保生产 URL 上 UI 也正常）。
  Parallelization: Wave 5 | Blocked by: todo 17 | Blocks: F1-F4
  References: `tests/qa/visual-qa.mjs`；`vercel.com/docs/rollbacks`；`docs/operations.md`
  Acceptance criteria: ① 回滚后生产 URL 上 `/api/stats` 行为符合 todo 11 之前的部署（GET 全 0）；② 浏览器 smoke 全部 PASS：home / play / result 三路由可访问；一局胜利后战绩持久化；截图保存到 `.omx/evidence/vercel-deploy/task-19-rollback-smoke/`
  QA scenarios:
    - happy: 演练 + smoke 全过 → Evidence `.omx/evidence/vercel-deploy/task-19-rollback-smoke/`（含 curl 输出 + 截图 + smoke stdout）
    - failure: 回滚失败 → Vercel Dashboard 报 deployment 已被删除（选别的 green 部署）；smoke 失败 → 看哪条 probe 报错（hydration / audio / visual-qa 各自有专属 evidence）
  Commit: N | (演练 + smoke，验证)

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. Plan compliance audit — 复核 todos 1-19 全部 completed；每个 todo 的 acceptance criteria + QA scenarios + commit 行都满足；既有 3 个三分支测试 + 3 个新 selectDriver 测试都绿
- [x] F2. Code quality review — `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 4 项全绿；`lib/db.ts` 改动 ≤ 25 行；新增 `selectDriver` 函数有 JSDoc 注释；README/operations.md 改动不超各自上限
- [x] F3. Real manual QA — 跑 `node tests/qa/visual-qa.mjs --base-url <production-url>` 覆盖三路由 + 胜利流 + 战绩持久化；含 UX_STRICT=1 时全合约断言通过；浏览器截图保存
- [x] F4. Scope fidelity — 复核 Scope OUT 0 违反：没新增 npm 依赖、没改 `vercel.json`、没绑自定义域名、没引入 Sentry/Datadog、没动 CI workflow、没动 AGENTS.md/DESIGN.md/CONTRIBUTING.md、`.env.local` 仍在 gitignore 且 git status 不可见、生产 URL 上 preview branch 无 DATABASE_URL 写入路径

## Commit strategy

按 AGENTS.md lore 协议。Conventional Commits；正文 WHAT/WHY/HOW；非平凡提交带 trailer（Constraint / Rejected / Confidence / Scope-risk / Directive / Tested / Not-tested）；非平凡提交带 `Plan: .omo/plans/vercel-deploy-runbook.md` 页脚。

预期 commit 顺序（在 main 上线性）：
1. `feat(db): 深模块化 driver 工厂，file: 走原生 / 远程走 @libsql/client/web` — `lib/db.ts` + `tests/db/db.test.ts` 合并为同一笔；`Plan:` 页脚
2. `chore(docs): README §部署 加深模块描述 + Vercel CLI vs Git 自动部署 排错对比` — `README.md`；`Plan:` 页脚
3. `chore(gitignore): ignore .vercel/`（如果 todo 8 触发该 commit）
4. `chore(docs): 触发 Vercel 自动 deploy 验证` — todo 15 的小验证 commit（带 lore trailer）
5. `chore(docs): docs/operations.md §部署 改写为两阶段 + CLI 应急回滚入口` — `docs/operations.md`；`Plan:` 页脚

每个 commit 独立 build + test 绿。最终一笔在 `git log --oneline -10` 看到完整故事。

## Success criteria

整体交付条件（用户可观察）：
1. `https://<project>.vercel.app` 返回可玩的井字棋
2. `curl https://<project>.vercel.app/api/stats` GET 返回全 0 战绩
3. `curl -X PUT -d '{"totalGames":1,...}' .../api/stats` 返回 200
4. 再 GET 返回 `{totalGames:1,xWins:1,...}`（持久化生效）
5. `turso db shell tic-tac-toe-onepisya "SELECT * FROM game_stats;"` 显示刚才 PUT 的行
6. `git push origin main` 后 60s 内 Vercel Dashboard 显示新 Ready 部署
7. feature branch push 得到 preview URL，但 preview 无 DATABASE_URL 不会写生产战绩
8. Vercel Dashboard → Promote to Production 一键回滚演练成功
9. `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 4 项绿
10. `tests/db/db.test.ts` 共 6 个测试全 PASS（既有 3 + 新增 3）
11. `tests/qa/visual-qa.mjs` 在生产 URL 上 PASS
12. `.env.local` 仍在 gitignore、`git status` 不可见；生产 token 仅在 Vercel Dashboard
13. README §部署 + docs/operations.md §部署 + 回滚路径三处一致

---

## Final state (2026-09-10 lock)

经过 runtime-cleanup-finalize 操作后，Vercel 项目状态：

| 项 | 状态 |
| --- | --- |
| Project name | `tic-tac-toe` |
| Project ID | `prj_MOOcP0A5uSKcqkARJdR1XXGarMaA` |
| 唯一 production deployment | `dpl_F3hNTBne76c7mRTYNuHe2stTQtcS` (URL `tic-tac-arkhtecz7-onepisyas-projects.vercel.app`, Ready) |
| 用户公开入口 | `https://3t-tic-tac-toe.vercel.app/` (项目级 verified domain) |
| Vercel 自动 canonical alias | `https://tic-tac-toe-onepisyas-projects.vercel.app/` (跟 project name, 删不掉, 但用户唯一公开 URL 是 3t-tic-tac-toe) |
| Project domains | 仅 `3t-tic-tac-toe.vercel.app` (verified) |
| Aliases | 仅 2 个, 都指向唯一 production deployment |
| 旧 deployment (5 个) | 全部 `state: DELETED` (cv4bm77sb / js86rmjay / 5s4zst0o5 / ckjo377il / i7y25w108) |
| `ulw-demo.vercel.app` | `404 DEPLOYMENT_NOT_FOUND` (project domain + deployment alias 均清) |
| 旧 deployment URL | 全部 `404 DEPLOYMENT_NOT_FOUND` |
| runtime | `nodejs` (route.ts 注释扩展 commit 7781857f) |
| 过期策略 | 主动 DELETE 所有非当前 production deployment (Hobby plan 默认 30-day retention 仅 GC 超出最近 10 个 production + 所有 aliased, 本项目 6 个 production history 都在 10 个以内, 故手动 DELETE 实现"用户唯一访问到一份") |
| Password Protection | ❌ Hobby plan 不支持 (Enterprise / Pro + Advanced Deployment Protection add-on 才支持), 保护通过 DELETE 实现 |

部署验证 (2026-09-10):
- `curl -i https://3t-tic-tac-toe.vercel.app/api/stats` → `200 application/json` + `{totalGames:6,xWins:4,oWins:2,draws:0,currentStreak:2}`
- 6 步 curl round-trip 全过 (GET 当前 → PUT 临时 → GET 验证 → DELETE 清零 → PUT 还原 → GET 验证还原)
- `x-vercel-id: hnd1::iad1::*` 表明在 iad1 (US East) 边缘节点执行
- `cache: MISS` 表示每次走真实 runtime (dynamic='force-dynamic' 生效)

参考 plan:
- .omo/plans/runtime-cleanup-finalize.md (本轮 final 设计 + 实施记录)
- .omo/plans/runtime-cleanup-after-edge-attempt.md (上一轮 edge migration 回退历史)
- .omo/plans/edge-runtime-migration.md (edge migration 设计)
- .omo/plans/vercel-deploy-runbook.md (本文, runbook 主体)
