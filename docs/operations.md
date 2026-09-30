# 操作手册（Operations）

> 人类可读的日常操作入口。环境变量、命令、DB、QA、提交规范速查与排错。

## 前置

> 适用：本仓库 main 分支、Node.js 24（与 engines / .nvmrc / CI 一致）、pnpm ≥ 10、Turso CLI ≥ 0.100。

- pnpm ≥ 10（包管理）、Node.js 24（与 engines / .nvmrc / CI 一致）、Turso CLI ≥ 0.100、Playwright 浏览器（`pnpm exec playwright install`）
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
node tests/qa/hydration-check.mjs           # 无 hydration 警告 + 全流程
node tests/qa/audio-probe.mjs               # 真实 AudioContext 振荡器计数 ≥12
node tests/qa/audio-cheer.mjs               # win→cheer 360ms 时序 + C5-E5-G5-C6-E6
node tests/qa/audio-confetti-qa.mjs         # 音效开关 + confetti canvas + 战绩持久化
node tests/qa/ux-qa.mjs after               # 9 场景截图 + qa-log.json（UX_STRICT=1 加合约断言）
node tests/qa/visual-qa.mjs                 # 三路由 + 一局胜利 + API 校验
node tests/qa/commit-audit.mjs              # 提交消息审计（钩子同款规则）
# T-L2 triage (2026-09-25) 新增 — 非 BR 绑定但仍有活场景的探针：
node tests/qa/anonymous-first-game-qa.mjs    # W4/W5 anonymous-first-game 全链路（无预设房名）
node tests/qa/offline-result-qa.mjs          # /result?room= SSR 三分支（无名 fallback/有名无行 404/有名有行）
node tests/qa/one-screen-qa.mjs              # W3 移动端 viewport 单屏合约 A6/A7/sticky
node tests/qa/result-celebration-qa.mjs      # W-A F1-F5 confetti 触发与不重放（reload/书签直达/平局/reducedMotion）
node tests/qa/result-fresh-qa.mjs            # W-F W-F1/W-F2 胜局/平局首帧战绩新鲜度
node tests/qa/confetti-origin-qa.mjs         # 桌面内聚起点 ≥1280px / 较小视口边缘起点
node tests/qa/pwa-sw-cache-qa.mjs            # P3 SW dual-layer：manifest 二次 fetch 经 SW 命中
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

补充（**历史叙述**，W1-W2 已退役）：`/api/stats` 用 `runtime='nodejs'` + `dynamic='force-dynamic'`，build 走
`pnpm build && pnpm start`；本地冒烟用同一个 build（dev server 不行——见
[README §部署排错](README.md#vercel-排错)）。

### 当前部署示例（截至 2026-09-09 runbook 完成时）

- **项目名**：`tic-tac-toe`（Vercel projectId `prj_MOOcP0A5uSKcqkARJdR1XXGarMaA`，team `onepisYa`）
- **生产 URL**：`https://3t-tic-tac-toe.vercel.app/`（项目级 verified domain，自动 follow 当前 production deployment）
- **canonical alias（Vercel 自动）**：`https://tic-tac-toe-onepisyas-projects.vercel.app/`（跟 project name 走，删不掉；公开入口仍是 3t-tic-tac-toe）
- **runtime**：`nodejs`（Vercel Node.js runtime。Next.js 16 弃用 Edge runtime；Vercel Node 跑在 CDN 边缘节点，RESTful 端点用 `@libsql/client` native sqlite 需要 node built-ins 故不能回 Edge；HTTP 分支走 `@libsql/client/web`，详情见 README §驱动层）
- **历史 deployment 状态**：所有非当前 production 的旧 deployment 已**主动 DELETE**——`dpl_<deployment-id>` 之前累计 5 个 production deployment（`cv4bm77sb` / `js86rmjay` / `5s4zst0o5` / `ckjo377il` / `i7y25w108`）全部 `state: DELETED`；对应 URL（`tic-tac-cv4bm77sb-onepisyas-projects.vercel.app` 等）一律返回 `404 DEPLOYMENT_NOT_FOUND`
- **过期策略**：Vercel Hobby plan 默认 30-day retention 自动保留最近 10 个 production deployment + 所有 aliased deployment（https://vercel.com/changelog/hobby-projects-now-default-to-30-day-deployment-retention）；本项目只有 6 个 production history 都在 10 个以内，30-day retention 不会自动 GC，所以手动 DELETE 实现"用户唯一访问到一份"。Password Protection 是 Enterprise 或 Pro + Advanced Deployment Protection add-on 才支持，Hobby plan 不可用——保护通过删除实现而非 password gate
- **`ulw-demo.vercel.app` 状态**：`404 DEPLOYMENT_NOT_FOUND`（project-level domain 与 deployment-level alias 均已清理）
- **本地目录**：`<repo-root>`（2026-09-10 从 `ulw-demo` 改名，与项目名一致）
- **Turso db**：`tic-tac-toe-onepisya`（aws-us-east-1，region 建库后不可改）
- **并发写实测边界（T-L4，2026-09-24）**：远程 Turso 的 `transaction('write')` 由服务端串行化——双连接裸并发 30/30、单连接互斥 60/60、双连接重试 20/20 全部终值精确、0 锁泄漏（file: 模式的丢更新与文件锁泄漏在远程均不出现）。写路径三步保持单事务内即多实例不丢更新；平台语义演进不在承诺内。细节：`.omo/evidence/turso-race/T-L4-remote-turso-race-report.md`，复跑锚 `tests/db/turso-remote-race-feasibility.test.ts`（TURSO_RACE_EXPERIMENT=1 双门跳过）
- **部署方式**：Vercel CLI（Phase 1）。Phase 2（Vercel for GitHub）待 GitHub 仓库创建后启用。
- **回滚**：`vercel rollback` 或 Dashboard → Deployments → "Promote to Production"。

历史 `ulw-demo-*` / `tic-tac-5s4zst0o5-*` 等 deployment URL 全部 404；新部署只走
`3t-tic-tac-toe.vercel.app` / `tic-tac-arkhtecz7-onepisyas-projects.vercel.app`。

生产部署验证（2026-09-10 起 ranked 单行历史）：`curl -i https://3t-tic-tac-toe.vercel.app/api/stats` 返回
`200 application/json` + 当前战绩；6 步 curl round-trip 全过——`GET` 当前
`{totalGames:6,xWins:4,oWins:2,draws:0,currentStreak:2}` → `PUT` 临时值
`{99,50,40,9,7}` → `GET` 验证 PUT 生效 → `DELETE` 清零 → `PUT` 还原真实值
`{6,4,2,0,2}` → `GET` 验证还原。期间用户战绩未破坏。**W1-W2 后改 RESTful 四端点**：参考 README §RESTful API 参考 + `.omo/plans/ulw-one-game-two-versions.md` §2。

### 已解决部署警告（代码侧）

最近一轮部署日志里两条 Node engines / pnpm build scripts warning 已通过 commit
落地解决，对应文件与 commit 可在 `git log --grep="build(vercel)\|feat(layout)\|feat(analytics)"` 锚定：

| 警告 | 解决方案 | 提交 / 文件 |
| --- | --- | --- |
| Node engines 自动升级 | `engines.node` pin 到 major（与 .nvmrc 22 对齐，vitest 5 fork pool 校验一致） | `cd47efb` `package.json#engines.node` |
| pnpm Ignored build scripts | `pnpm.onlyBuiltDependencies` 白名单 better-sqlite3 + esbuild | `cd47efb` `package.json#pnpm.onlyBuiltDependencies` |
| 浏览器 tab 显示 Next.js 默认 logo | 删除 `app/favicon.ico`，新增 `app/icon.svg`（与 `public/logo.svg` 字节一致） | `955b24d` `app/{favicon.ico,icon.svg}` |
| 移动端 chrome 地址栏色条跟随 OS | Next.js 16 `viewport.themeColor` 导出 + 字面量 `#0A0A0A` 镜像 `--color-bg-base` | `955b24d` `app/layout.tsx` |
| 缺 metadataBase 导致相对路径 metadata 解析为 localhost | `metadata.metadataBase` 用生产域名 | `955b24d` `app/layout.tsx` |
| 缺 Vercel Analytics 真实访问数据 | `<Analytics />` 挂载 + visual-qa 探针扩展 `analyticsScript` 字段 | `e7100e6` `app/layout.tsx` + `tests/qa/visual-qa.mjs` |

### 待人工操作（Vercel Dashboard）

下面 5 项是 Vercel Dashboard 推送的部署警告，**当前 executor turn 无法触达**（需要用户登录 Dashboard 操作，或需 Pro / Enterprise 计划 / GitHub Connect），列为人工清单；未来跟进此清单时按行号定位。

| 项 | 决定 | 一句话理由 | Dashboard 配置入口 |
| --- | --- | --- | --- |
| Build Multiple Deployments Simultaneously | skip | Hobby plan 限定 1 concurrent build，升级 Pro 才解锁；本项目 traffic 量级不需要并发 build | https://vercel.com/docs/builds/build-queues |
| Prevent Frontend-Backend Mismatches（Skew Protection） | skip | 仅支持 Next.js 14+ 多版本部署共存场景，本项目是单页 Next.js 应用无需 skew 防护 | https://vercel.com/docs/skew-protection |
| Secure Preview Deployments | out-of-scope | Password Protection 需 Enterprise 或 Pro + Advanced Deployment Protection add-on，Hobby plan 不可用 | https://vercel.com/docs/security/deployment-protection |
| Deployment Protection | out-of-scope | 同上，Hobby plan 不支持 Password Protection / Trusted IPs | https://vercel.com/docs/security/deployment-protection |
| Preview Deployment（每 push 自动 preview URL） | **out-of-scope（最高优先级）** | 当前 GitHub 仓库还没 Connect，导致 Vercel 完全不发 preview URL，是 deployment warning 的最大来源；Project Settings → Git → Connect GitHub Repository → 选 `onepisya/tic-tac-toe` → production branch = `main` 即可一键启用 | https://vercel.com/docs/deployments/environments#preview-environment-pre-production |

注：「决定」列含义：`do` = 在 Dashboard 已配置；`skip` = 主动决定不开；`out-of-scope` =
executor 不可触达，等用户登录 Dashboard 操作。本表是稳态锚点，下次有人跟进时按 Dashboard
入口 URL 直接定位，无需再调研 warning 来源。



## 运维·TTL 自动回收（plan ulw-room-lifecycle-20260924 §二 T-N3）

> Turso 免费额度现实 + 孤儿账本兜底：服务端每日凌晨 3 点（UTC）跑一次
> `purgeStaleRooms(30)`，删除 `updated_at < now - 30 天` 的房间账本。
> 30 天不活跃的账本视为孤儿，不复活、不迁移、不可导出——纯删。

### Vercel Cron 配置（部署后人工操作）

1. 在 Vercel Dashboard → Project → Settings → Cron Jobs 确认
   `0 3 * * *` → `/api/maintenance/purge` 任务已注册（vercel.json
   `crons` 字段入 commit 后自动同步，**首次部署后仍需人工去 Dashboard
   确认**任务列表里能看到这一行）。
2. 在 Vercel Dashboard → Project → Settings → Environment Variables
   配 `CRON_SECRET`（任意 32+ 字节随机串，例如 `openssl rand -hex 32`），
   **Production only**——不要勾 Preview / Development。
   **值不入仓不入探针不入任何 tracked file**。如不慎写入，立即在 Dashboard
   rotate 一份新值并从 git 历史里清除。
3. Vercel Cron 触发请求自动带 `Authorization: Bearer ${CRON_SECRET}`
   header（Hobby plan 用 GET，Pro plan 也用 GET）；端点接受 POST + GET
   同 handler，按 Bearer 比较鉴权（`app/api/maintenance/purge/route.ts`
   `authorize()`，constant-time 防时序泄漏）。

### 手动触发（运维低频通道）

不依赖 Vercel Cron 时直接 curl：

```bash
PROD=https://<project>-<hash>-<team>.vercel.app
SECRET=$(vercel env pull --environment=production --yes 2>/dev/null \
  | grep -E '^CRON_SECRET=' | cut -d= -f2-)
# 或者从密码管理器取
curl -i -X POST -H "Authorization: Bearer $SECRET" \
  $PROD/api/maintenance/purge
# 期望：HTTP/1.1 200 application/json
# {"deletedCount":<n>,"cutoffDays":30}
```

返回的 `deletedCount` 是本次删除的房间账本数；`cutoffDays` 固定 30
（与 `purgeStaleRooms(30)` 默认参数对齐）。

### TTL 语义与不动清单

- **TTL = 30 天不活跃**（`updated_at` 口径）。主公如需改默认值，仅改
  `lib/db.ts:purgeStaleRooms` 默认参数一处——所有调用方（route handler
  + 计划文档）以默认值落地。
- **按 `updated_at` 严格小于 cutoff 删，等于不删**——边界在
  `tests/db/db.test.ts: purgeStaleRooms 边界` 一组 case 锁定。
- **与 reset / delete-room 的语义边界**：
  - `POST /api/rooms/{room}/stats/reset` 是用户主动清零（保留 room 身份）；
  - `DELETE /api/rooms/{room}` 是用户主动销户（删行，可重建为空账本）；
  - TTL 是运维兜底（孤儿账本回收，不可重建原数据）。
- **不动清单**（plan §二 T-N3 负面清单）：不碰用户侧五个端点
  （`/api/rooms`、`/api/rooms/{room}/stats/*`）；不在 `package.json`
  加手动 trigger 脚本（curl 足够）；不改 cron schedule（默认 `0 3 * * *`
  落在 Turso 免费额度窗口外）。


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
