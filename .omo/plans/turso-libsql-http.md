# Plan — Turso/LibSQL HTTP 持久化（lib/db.ts 替换）

Intent: 把 `lib/db.ts` 从 better-sqlite3 切到 `@libsql/client`（HTTP/Turso），让战绩在 Vercel serverless 上持久化；保持本地开发 + CI 继续用 file: URL 跑。范围：lib/db.ts + tests/db/db.test.ts + app/api/stats/route.ts + package.json + .env.example + README.md + docs/* + AGENTS.md + lib/AGENTS.md + .github/copilot-instructions.md。

## 现状

- `lib/db.ts` 用 `better-sqlite3` + `drizzle-orm/better-sqlite3`，DATABASE_URL 默认 `file:./data/tic-tac-toe.db`。
- better-sqlite3 是原生模块、且在 Vercel serverless 上文件系统是只读 / 临时的，无法持久化。
- README / AGENTS / docs/learnings 已经把"Vercel 需换 Turso/LibSQL"写进契约，但代码未落地。
- 测试 `tests/db/db.test.ts` 内部用 better-sqlite3 readonly 打开 db 文件做 PRAGMA 物理列断言；切到 libsql 后该断言需改成走 libsql 客户端 execute。

## 设计

### 1. URL 协议 + 环境变量

继续使用 `DATABASE_URL` 作为 URL 入口（项目原约定，README / .env.example 同步）；新增 `DATABASE_AUTH_TOKEN` 作为远程 client 的鉴权 token。`@libsql/client` 自行按 scheme 分流：

- `file:./path/to.db` → 本地 sqlite（dev / CI / 单机部署）；自动 `fs.mkdirSync(dir, { recursive: true })`。
- `http://...` / `https://...` → Turso HTTP client；带 `DATABASE_AUTH_TOKEN` 时注入 `authToken`。
- `libsql://...` → 等价于 `https://...`，由 libsql client 自身识别。

### 2. 异步化

`@libsql/client` 是异步 API。`loadStats` / `saveStats` / `resetStats` / `getDb` / `closeDb` 全部改为 `Promise<...>`。唯一调用方 `app/api/stats/route.ts` 改成 `await`。Next.js route handler 本身就是 async，没有外部 API 变化。

### 3. 测试 seam

`lib/db.ts` 暴露 `__setCreateClientForTests(fn)`：默认 `createClient`，测试可以替换成捕获 `(config)` 的 spy。这样可以**不真正请求 Turso**就断言 http 分支把 `{ url, authToken }` 传到了 `createClient`，对 file 分支用真 tmpdir 路径走原生 sqlite。

### 4. Schema bootstrap

保留 `CREATE TABLE IF NOT EXISTS game_stats (...)`，改成在 `getDb()` 里 `await client.execute(...)`。先 bootstrap，再 `drizzle(client, { schema })`。libsql 客户端的 SQL 是参数化 prepared statement，避免字符串拼接。

### 5. 依赖

- 移除：`better-sqlite3`、`@types/better-sqlite3`。
- 新增：`@libsql/client@^0.18.0`（drizzle-orm 0.45.2 已经把它列为可选 peer，无需调整 drizzle）。
- `drizzle-kit`、`drizzle-orm` 保持；`drizzle.config.ts` 不动（dialect 仍是 sqlite，URL 仍是 DATABASE_URL）。

### 6. 文档

- `README.md`：FAQ 第一条改为说明默认是 file: 即可单机使用，部署到 Vercel 时设置 `DATABASE_URL=https://...turso.io` + `DATABASE_AUTH_TOKEN=<token>`，并新增"部署"小节列出 Turso 建库 / 拿 token / Vercel 环境变量步骤。
- `.env.example`：注释改为"远程 Turso 时把 DATABASE_URL 换成 https://...turso.io 并设置 DATABASE_AUTH_TOKEN"。
- `docs/operations.md`：环境变量 + dev/CI 仍然 file:，prod 走 Turso；删除 `pnpm rebuild better-sqlite3` 排错条目。
- `docs/learnings.md`：补一条"Drizzle + LibSQL（Vercel-ready）"版本行；旧的"Drizzle + better-sqlite3 → Vercel 需换 Turso/LibSQL（README 已注明）"条目转成历史。
- `docs/testing.md`：L3 行把工具从 vitest + better-sqlite3 改成 vitest + @libsql/client（真本地 sqlite file：往返 + spy http 分支）。
- `AGENTS.md`：项目反模式 + 依赖 + 备注中提到 better-sqlite3 / sqlite 的字眼同步。
- `lib/AGENTS.md`：边界表 db.ts 一行的"better-sqlite3 + Drizzle"改为"@libsql/client + Drizzle"；契约条款里"WAL 模式"改成"异步 client"。
- `.github/copilot-instructions.md`：技术栈行里的 better-sqlite3 改为 @libsql/client (Turso on Vercel)；删去"`pnpm rebuild better-sqlite3`"风格的提醒。

## 验证门禁

1. `pnpm vitest run` 100% 绿（重点：tests/db/db.test.ts 改写后全绿）。
2. `pnpm typecheck` 0。
3. `pnpm lint` 0。
4. `pnpm build` 0；路由文件不增减。
5. `node tests/qa/commit-audit.mjs --message-file <draft>` 0 violations。
6. 一次手动 smoke：`DATABASE_URL=file:$(mktemp -d)/x.db pnpm vitest run tests/db/db.test.ts` 通过。
7. （可选）跑一次 `tests/qa/visual-qa.mjs`：build + start，stats 写读一致；本仓库现有 dev 默认也是 file:。

## 不可触碰

- 不动 commitlint / commit-audit / commit-msg hook 策略。
- 不动现有 commit history；本次提交按 lore protocol 拆 2 个 commit（deps + 重写）或 1 个 commit（lib/db + tests + docs 同步），按 1 commit 取最小变更宽度。
- 不引入新工具链、不改 better-sqlite3 / libsql 之外的运行时依赖。
- 不删除 `data/tic-tac-toe.db`（gitignore，不入历史）。
- 不为 PROSE 文档加字数 / 关键词测试；文档由 commit-audit 真实验证。

## 风险

- drizzle-orm/libsql 的 `eq(gameStats.id, ...)` 等查询形态跟 better-sqlite3 路径等价，已用 ts 编译器兜底。
- libsql 0.18 是最新发布（published 6 days ago），peer 范围 ≥0.10；行为稳定。
- Vercel 上 file: 路径写入会落到 /tmp，每次冷启动丢数据 — README 必须明示 dev 用 file:、prod 必须用 https URL，否则用户踩坑。
- `closeDb` 现在变 `async`；tests/db 用 `await closeDb()` 兜底，行为等价。

Constraint: Vercel serverless 文件系统只读 / 临时；@libsql/client 的 file: 分支不能在 Vercel 持久化，必须走 http(s)。
Rejected: 保留 better-sqlite3 + 上 Vercel 时改 serverful 部署 | 与项目 Vercel-ready 目标冲突。
Rejected: 自实现 libsql REST 而不用 @libsql/client | 重复造轮子、与 README 既有契约不一致。
Rejected: 把所有 store/db 操作推到 client | 路由层 `runtime='nodejs'` 已是项目契约，不能下放。
Confidence: high
Scope-risk: moderate（跨 lib + tests + route + 6 份文档；行为对外等价）
Directive: 后续维护者不要再把 better-sqlite3 加回 package.json；任何想换回本地原生的尝试都先核对 Vercel 部署说明。
Tested: vitest typecheck lint build commit-audit
Not-tested: 真实 Turso 远端往返（无 Turso 凭证，跑不起）；Vercel 部署验证（无 Vercel 项目）。
