# 操作手册（Operations）

> 人类可读的日常操作入口。环境变量、命令、DB、QA、提交规范速查与排错。

## 前置

> 适用：本仓库 main 分支、Node.js ≥ 20、pnpm ≥ 10、Turso CLI ≥ 0.100。

- pnpm ≥ 10（包管理）、Node.js ≥ 20、Turso CLI ≥ 0.100、Playwright 浏览器（`pnpm exec playwright install`）
- @libsql/client 的 file: 分支依赖原生 sqlite（由包内 os 分发，自动安装）；切 Node 大版本
  后只需 `pnpm install` 重新拉链。

## 环境变量

复制 .env.example 为 .env.local（已 gitignore）：

- `DATABASE_URL` — 默认 `file:./data/tic-tac-toe.db`；lib/db.ts 自动建目录/建表。
  - `file:./path/to.db` — 本地 sqlite（dev / CI / 单机部署）。
  - `http://`、`https://`、`libsql://` — Turso 远程 HTTP client；需配 `DATABASE_AUTH_TOKEN`。
- `DATABASE_AUTH_TOKEN` — 仅 http(s)/libsql URL 必填；file: 路径下忽略。

真实 Turso 库联调流程（建库、取 URL、取 token、冒烟）参见 [本地联调 Turso 指南](local-turso-setup.md)。

## 日常命令

| 目的 | 命令 |
| --- | --- |
| 安装 | pnpm install |
| 开发 | pnpm dev → http://localhost:3000 |
| 生产构建/启动 | pnpm build && pnpm start |
| 单元/属性/集成 | pnpm test（watch: pnpm test:watch） |
| 覆盖率 | pnpm test:coverage |
| 变异测试 | pnpm test:mutation（输出在 reports/mutation/，已 gitignore） |
| 类型/Lint | pnpm typecheck && pnpm lint |
| DB 迁移 | pnpm db:generate / db:push / db:studio |

## 浏览器 QA（tests/qa/*.mjs）

先 `pnpm build && pnpm start`（:3000），再逐个运行：

```bash
node tests/qa/hydration-check.mjs      # 无 hydration 警告 + 全流程
node tests/qa/audio-probe.mjs          # 真实 AudioContext 振荡器计数 ≥12
node tests/qa/audio-cheer.mjs          # win→cheer 360ms 时序 + C5-E5-G5-C6-E6
node tests/qa/audio-confetti-qa.mjs    # 音效开关 + confetti canvas + 战绩持久化
node tests/qa/ux-qa.mjs after          # 9 场景截图 + qa-log.json（UX_STRICT=1 加合约断言）
node tests/qa/visual-qa.mjs            # 三路由 + 一局胜利 + API 校验
node tests/qa/commit-audit.mjs         # 提交消息审计（钩子同款规则）
```

可选 env：BASE_URL（默认 http://localhost:3000）、EVIDENCE_DIR（默认 .omx/evidence/<script>）、
UX_STRICT=1（启用 ux 合约断言）、DATABASE_URL（覆盖默认 file: 路径，跑完即删）。
证据目录已 gitignore。

## 部署

仓库用 Next.js 16 + @libsql/client + Turso，driver 由 `lib/db.ts` 内 `selectDriver(url)`
按 `DATABASE_URL` 自动选：`file:` 走原生 sqlite，其他走 `@libsql/client/web`（HTTP，
serverless/Edge 友好）。详细 driver 说明见 [README §驱动层（深模块）](README.md#驱动层深模块)。
本节只讲**怎么把代码推上线**。

部署分两阶段，CLI 优先于 Git：

### Phase 1 · Vercel CLI 手动部署（首次上线 / 应急回滚入口）

适用：首次把仓库部署到 Vercel；或者 Git 自动部署链路挂掉时作为应急入口。

前置（一次性）：

- `pnpm install`
- `turso auth whoami` 确认 Turso CLI 已登录；按 [本地联调 Turso 指南](local-turso-setup.md)
  建库 + 取 URL + 拿 token，写进 `.env.local`（已 gitignore）。
- `vercel login` 确认 Vercel CLI 已登录。
- **新项目注意**：Vercel 默认开启 Vercel Authentication，curl / 浏览器都会被
  401/302 重定向。**首次部署后立刻**关掉：
  ```bash
  vercel project protection disable --sso
  ```

部署流程：

1. **关联项目**（一次性）：

   ```bash
   vercel link --yes
   # 会在 .vercel/project.json 写 projectId + orgId；非生产文件，已 gitignore
   ```

2. **写环境变量到 Production**（一次性；env 只在 Production，不在 Preview/Development，
   否则 preview 静默继承生产变量、可能误写战绩）：

   ```bash
   URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)
   TOKEN=$(grep '^DATABASE_AUTH_TOKEN=' .env.local | cut -d= -f2-)
   vercel env add DATABASE_URL production --value "$URL" --yes
   vercel env add DATABASE_AUTH_TOKEN production --value "$TOKEN" --sensitive --yes
   vercel env ls production   # 确认两个都在
   vercel env ls preview      # 应该空
   ```

3. **推 production**：

   ```bash
   vercel --prod --yes
   # 记录输出的 Production URL（形如 https://<project>-<hash>-<team>.vercel.app）
   ```

4. **端到端验证**（详见下方"生产 URL 验证"小节）。

### Phase 2 · Vercel for GitHub 自动部署（push 即 deploy）

适用：开发迭代；每次 `git push origin main` 触发自动 build + 部署到 production URL。

前置（一次性）：

- GitHub 仓库存在（默认名 `onepisya/tic-tac-toe`、public、默认分支 `main`）。
  本地加 remote 并首推：
  ```bash
  git remote add origin git@github.com:onepisya/tic-tac-toe.git
  git push -u origin main
  ```
- Vercel Dashboard → Add New → Project → Import `onepisya/tic-tac-toe` →
  勾选 **Vercel for GitHub** 集成 → framework preset 选 Next.js →
  **Production Branch = `main`** → Deploy。
- env vars 已从 Phase 1 带入；如未带，回 Phase 1 step 2。

日常：

```bash
git commit -m "feat: ..."
git push origin main        # Vercel Dashboard 60s 内出现 "Building" → "Ready"
```

非 main 分支 push 自动得到 preview URL（preview 环境**没有** `DATABASE_URL`，
所以 preview 写不进生产战绩；如果想开 preview db 走单独 token，需要先在
`vercel env add ... preview` 显式开，并在 Dashboard 关闭 preview 写生产）。

### 两阶段的关系 / 何时用哪个

- **日常迭代用 Phase 2**（push 即 deploy，省 CLI 步骤）。
- **CLI 应急**：Git 自动部署挂掉（GitHub Webhook 失败、main branch 误删、
  Dashboard 临时维护）时，`vercel --prod` 仍可独立推 production；不依赖
  GitHub / Vercel for GitHub 集成。
- **回滚用 Dashboard**：Deployments → 选前一个绿色 → "Promote to Production"，
  立刻把旧版本切回 production；两种部署方式产生的 deployment 互相可见，
  可跨阶段回滚。

### 生产 URL 验证（两阶段共享）

部署成功后跑 4 步 curl（用实际生产 URL 替换占位）：

```bash
PROD=https://<project>-<hash>-<team>.vercel.app
curl -i $PROD/api/stats                    # GET → 200, 全 0
curl -i -X PUT -H 'content-type: application/json' \
  -d '{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1}' \
  $PROD/api/stats                          # PUT → 200
curl -i $PROD/api/stats                    # GET → 200, 1,1,0,0,1
curl -i -X DELETE $PROD/api/stats          # DELETE → 200, 全 0
turso db shell <db-name> \
  "SELECT id, total_games, x_wins FROM game_stats;"  # 1 行，确认落库
```

补充：`/api/stats` 用 `runtime='nodejs'` + `dynamic='force-dynamic'`，build 走
`pnpm build && pnpm start`；本地冒烟用同一个 build（dev server 不行——见
[README §部署排错](README.md#vercel-排错)）。

### 当前部署示例（截至 2026-09-09 runbook 完成时）

- **项目名**：`tic-tac-toe`（Vercel projectId `prj_MOOcP0A5uSKcqkARJdR1XXGarMaA`，team `onepisYa`）
- **生产 URL**：`https://3t-tic-tac-toe.vercel.app/`（项目级 verified domain，自动 follow 当前 production deployment）
- **canonical alias（Vercel 自动）**：`https://tic-tac-toe-onepisyas-projects.vercel.app/`（跟 project name 走，删不掉；公开入口仍是 3t-tic-tac-toe）
- **runtime**：`nodejs`（Vercel Node.js runtime。Next.js 16 弃用 Edge runtime；Vercel Node 跑在 CDN 边缘节点，`/api/stats` 用 `@libsql/client` native sqlite 需要 node built-ins 故不能回 Edge）
- **历史 deployment 状态**：所有非当前 production 的旧 deployment 已**主动 DELETE**——`dpl_F3hNTBne76c7mRTYNuHe2stTQtcS` 之前累计 5 个 production deployment（`cv4bm77sb` / `js86rmjay` / `5s4zst0o5` / `ckjo377il` / `i7y25w108`）全部 `state: DELETED`；对应 URL（`tic-tac-cv4bm77sb-onepisyas-projects.vercel.app` 等）一律返回 `404 DEPLOYMENT_NOT_FOUND`
- **过期策略**：Vercel Hobby plan 默认 30-day retention 自动保留最近 10 个 production deployment + 所有 aliased deployment（https://vercel.com/changelog/hobby-projects-now-default-to-30-day-deployment-retention）；本项目只有 6 个 production history 都在 10 个以内，30-day retention 不会自动 GC，所以手动 DELETE 实现"用户唯一访问到一份"。Password Protection 是 Enterprise 或 Pro + Advanced Deployment Protection add-on 才支持，Hobby plan 不可用——保护通过删除实现而非 password gate
- **`ulw-demo.vercel.app` 状态**：`404 DEPLOYMENT_NOT_FOUND`（project-level domain 与 deployment-level alias 均已清理）
- **本地目录**：`/private/tmp/tic-tac-toe`（2026-09-10 从 `ulw-demo` 改名，与项目名一致）
- **Turso db**：`tic-tac-toe-onepisya`（aws-us-east-1，region 建库后不可改）
- **部署方式**：Vercel CLI（Phase 1）。Phase 2（Vercel for GitHub）待 GitHub 仓库创建后启用。
- **回滚**：`vercel rollback` 或 Dashboard → Deployments → "Promote to Production"。

历史 `ulw-demo-*` / `tic-tac-5s4zst0o5-*` 等 deployment URL 全部 404；新部署只走
`3t-tic-tac-toe.vercel.app` / `tic-tac-arkhtecz7-onepisyas-projects.vercel.app`。

生产部署验证（2026-09-10）：`curl -i https://3t-tic-tac-toe.vercel.app/api/stats` 返回
`200 application/json` + 当前战绩；6 步 curl round-trip 全过——`GET` 当前
`{totalGames:6,xWins:4,oWins:2,draws:0,currentStreak:2}` → `PUT` 临时值
`{99,50,40,9,7}` → `GET` 验证 PUT 生效 → `DELETE` 清零 → `PUT` 还原真实值
`{6,4,2,0,2}` → `GET` 验证还原。期间用户战绩未破坏。


## 提交规范速查

- Conventional subject（中文描述可），≤100 字符。
- 正文 WHAT / WHY / HOW 三段（prose，非列表）。
- trailer 键名英文：Confidence: / Scope-risk:（必填），Constraint / Rejected / Directive / Tested / Not-tested 按需。
- 非平凡提交页脚 Plan: .omo/plans/<slug>.md（设计记录先写）。
- .git/hooks/commit-msg 会跑 tests/qa/commit-audit.mjs 拦截违规；独立校验可用
  `pnpm exec commitlint --edit <file>`。禁止 --no-verify 绕过。

## 排错（详见 docs/learnings.md）

- 刷新 /result 战绩为空 → store 模块加载时会自动 hydrateStats（见 lib/store.ts 尾部）。
- hydration mismatch → 任何读 localStorage 的 UI 必须默认值首渲 + useEffect 后同步（SoundToggle 模式）。
- 音频无声 → 用户手势后才 lazy 建 AudioContext；QA 加 --autoplay-policy=no-user-gesture-required。
- commit 被拒 → 看钩子输出的规则编号（R1 subject / R3 WHAT-WHY-HOW / R4 trailers / R5 Plan）。
- 变异分数异常低/大量假存活 → 先确认 Stryker×Vitest 兼容补丁仍被 pnpm 安装，再重跑
  `pnpm test:mutation`；升级 Stryker 或 Vitest 后检查上游是否已改用 Vitest 5 兼容的 test name 过滤。
- Vercel 上战绩每次冷启动丢数据 → 检查 DATABASE_URL 是否还带 file: 前缀；必须改成
  libsql:// 或 https://，并设 DATABASE_AUTH_TOKEN。
