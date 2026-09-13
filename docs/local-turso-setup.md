# 本地联调 Turso 指南

把战绩从本地 sqlite 切到真实 Turso 库的 5 分钟操作手册。**Vercel 部署走的是同一条线路但配环境变量的地方不同**；那条放在 README §部署，本文档专注本机。

→ Vercel 部署详见 [README §部署](README.md#部署)。

> 适用：本仓库 main 分支、Node.js 24（与 engines / .nvmrc / CI 一致）、pnpm ≥ 10、Turso CLI ≥ 0.100。

## 前置

1. 安装 turso CLI（macOS）：

   ```bash
   brew install turso
   ```

   其他平台参考 [turso 安装文档](https://docs.turso.tech/cli/installation)。

2. 登录 Turso 账户（首次会打开浏览器走 OAuth）：

   ```bash
   turso auth login
   ```

   验证：

   ```bash
   turso auth whoami   # 应打印你的账户名 / email
   ```

3. 确认仓库里已有 `.env.local`（gitignored）。如果还没有：

   ```bash
   cp .env.example .env.local
   ```

   占位文件默认是 `file:./data/tic-tac-toe.db`，本指南接下来会把它替换成 Turso URL。

## 建库

```bash
turso db create tic-tac-toe-onepisya --location aws-us-east-1
```

- 库名 `tic-tac-toe-onepisya` 带你的 GitHub handle，辨识度高、撞名概率低；**创建后不能改**，要改只能 destroy + 重建。
- Region `aws-us-east-1` 离 Vercel 默认区域近；**创建后不可改**，只能迁库（destroy + restore），所以现在定。

预期输出形如：

```
Created database tic-tac-toe-onepisya in aws-us-east-1.
```

## 取 URL

```bash
turso db show tic-tac-toe-onepisya --url
```

输出是一行 libsql URL：

```
libsql://tic-tac-toe-onepisya-<yourname>.aws-us-east-1.turso.io
```

**完整复制这一行**（含 `libsql://` 头），下一步会用到。

## 取 token

```bash
turso db tokens create tic-tac-toe-onepisya
```

会输出一段很长的 JWT（点号分隔的三段 base64）。**完整复制**这段 JWT；它是这个 token 的唯一显示机会，关闭终端就看不到了。

> 想要过期时间（比如 7 天、30 天）可以加 `--expiration 7d`。本指南默认不过期，方便本地联调；想换过期 token 随时 `turso db tokens revoke <jwt>` 然后重跑这条。

## 写入 .env.local

打开仓库根的 `.env.local`，把占位符替换成真实值：

```bash
# 改之前
DATABASE_URL=libsql://<your-db-name>.turso.io
DATABASE_AUTH_TOKEN=<paste-your-turso-jwt-here>

# 改之后（示例，你的 URL 和 JWT 不同）
DATABASE_URL=libsql://tic-tac-toe-onepisya-onepisya.aws-us-east-1.turso.io
DATABASE_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9....(完整 JWT)...
```

**不要**保留 `file:` 前缀 —— serverless / Turso 模式下文件路径无效，会被 `lib/db.ts` 当成本地 sqlite 处理。

验证 `.env.local` 已被 gitignore（应该 exit 0 且不显示在 `git status` 里）：

```bash
git check-ignore -v .env.local
# 期望: .gitignore:46:.env.local   .env.local
```

## 冒烟

跑起来并验证三步持久化：

```bash
# 1. 起 dev server
pnpm dev
# 等待 http://localhost:3000 响应

# 2. 另一个终端：第一次 GET，应该是全 0
curl -s http://localhost:3000/api/stats
# 期望: {"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0}

# 3. PUT 一笔数据
curl -X PUT \
  -H 'content-type: application/json' \
  -d '{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1}' \
  http://localhost:3000/api/stats
# 期望: 200 OK + 回显的 JSON

# 4. 第二次 GET，应该看到刚才写入的值
curl -s http://localhost:3000/api/stats
# 期望: {"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1}

# 5. 直接查 Turso 侧确认行落库
turso db shell tic-tac-toe-onepisya "SELECT * FROM game_stats;"
# 期望: 一行数据，包含 total_games=1, x_wins=1 等
```

通过 = 本机联调 OK，可以放心 commit。失败参考下方"排错"。

## 拆除

只是临时验证、不想留库：

```bash
# 警告：destroy 会清空数据，且不可恢复
turso db destroy tic-tac-toe-onepisya
```

> 如果同时要清掉 token：
>
> ```bash
> turso db tokens list tic-tac-toe-onepisya   # 拿到 token id
> turso db tokens revoke <token-id>
> ```

## 排错

### `GET /api/stats` 返回 500 + "fetch failed" / "ENOTFOUND"

多半是 `DATABASE_URL` 配错：

- 不应该以 `file:` 开头 —— Turso 模式下会被 lib/db.ts 当成本地 sqlite 解析，然后 fs 失败
- 不应该缺协议头（`libsql://` / `https://` / `http://` 至少一个）

修：把 `.env.local` 里的 URL 改成 `turso db show ... --url` 输出的完整字符串。

### `GET /api/stats` 返回 401 / 403

`DATABASE_AUTH_TOKEN` 没配、过期、或者被 revoke 了：

```bash
turso db tokens list tic-tac-toe-onepisya   # 看现有 token
turso db tokens create tic-tac-toe-onepisya # 重新签发
```

把新 token 替换进 `.env.local` 即可。`pnpm dev` 会自动重载（Node 进程读 env var 是启动期一次性，但 Next.js dev server 的 RSC 每次请求都会重新读 `.env.local`，所以通常不用重启）。

### `turso db create` 报 "database name already exists"

库名撞了。换一个有辨识度的后缀（比如 `tic-tac-toe-onepisya-2`），然后把 `.env.local` 里的 URL 也改一致。

### 改了 `.env.local` 但行为没变

`pnpm dev` 是 Next.js 自带 dotenv：改了 `.env.local` 之后**保存即生效**，不用重启。`pnpm start`（生产 build）则需要重启进程。

### 跑过冒烟但 Turso 侧 `SELECT` 看不到行

多半是 schema bootstrap 没跑（`lib/db.ts:81-93` 在 `getDb()` 里 `CREATE TABLE IF NOT EXISTS`）。先 `curl /api/stats`（GET 会触发 `getDb`），再查 `turso db shell`。

### `git status` 看到了 `.env.local`

`gitignore` 没生效：

```bash
git check-ignore -v .env.local
```

应该 exit 0、打印 `.gitignore:46:.env.local .env.local`。如果 exit 1，说明 `.gitignore` 里 `.env.local` 那行被注释掉了或被覆盖规则排除了。

## 跟 CI / Vercel 的关系

- **CI（vitest）**：不读 `.env.local`，测试自己 stub `process.env.DATABASE_URL` / `DATABASE_AUTH_TOKEN`（`tests/db/db.test.ts:46-47, 131-133, 159-161`）。改 `.env.local` 不会影响 CI。
- **Vercel**：本指南不覆盖。Vercel 的环境变量在 Dashboard → Settings → Environment Variables 里配，**不要**把 `.env.local` 整个上传；只把两个 var 单独配进去即可。详见 `README.md` §部署。

## 相关文件

- `.env.example` — 仓库里提交的占位模板
- `lib/db.ts:41-65` — URL + token 解析逻辑（三个分支 + fallback）
- `app/api/stats/route.ts:8` — `runtime='nodejs'` 是有意保留（libsql http(s) 分支在 node runtime 上行为最稳）
- `tests/db/db.test.ts:131,159,200` — 三分支断言，env-var 契约的回归保护
- `docs/operations.md` — 日常操作 + 提交规范速查
- `.omo/plans/turso-local-onboarding.md` — 本指南对应的设计记录
