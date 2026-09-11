# 井字棋 (tic-tac-toe)

> 适用：本仓库 main 分支、Node.js ≥ 20、pnpm ≥ 10、Turso CLI ≥ 0.100。

<p align="left">
  <a href="LICENSE"><img alt="License MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="https://www.typescriptlang.org"><img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178C6.svg"></a>
  <a href="https://nextjs.org"><img alt="Next.js 16" src="https://img.shields.io/badge/Next.js-16-000.svg"></a>
  <a href="https://react.dev"><img alt="React 19" src="https://img.shields.io/badge/React-19-149eca.svg"></a>
  <a href="https://eslint.org"><img alt="ESLint" src="https://img.shields.io/badge/code%20style-ESLint-4B32C3.svg"></a>
  <a href="https://vitest.dev"><img alt="Vitest" src="https://img.shields.io/badge/tested%20with-Vitest-6E9F18.svg"></a>
</p>

两人同设备 pass-and-play 的井字棋小游戏，自动记录战绩。Web app，桌面优先，
暗色克制工程师感 (Linear + Vercel 风)。

技术栈：Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4
+ Zustand + Drizzle ORM + @libsql/client（本地 file: sqlite / Vercel 走
Turso HTTP）。

## Quick start

1. `git clone <this-repo> && cd tic-tac-toe`
2. `pnpm install`
3. `pnpm dev` → http://localhost:3000
4. 完成——本地开发不需要 `.env.local`、不需要任何 env vars；战绩自动持久化
   到本地 sqlite：`data/tic-tac-toe.db`。

## Features

- 🎯 **Pass-and-play**：两人同设备轮流下；战绩需网络持久化（见 FAQ）。
- 💾 **战绩持久化**：胜 / 负 / 平 / 连胜通过单行 game_stats 表落盘，本地走
  file: sqlite，Vercel 走 Turso HTTP（@libsql/client）。
- 🌒 **暗色优先**：基于 Tailwind v4 设计令牌，桌面优先，移动端可用但非目标。
- ⌨️ **键盘优先**：棋盘使用 roving focus，落子、回车、回溯全部键控可触。
- 🔇 **音效懒加载**：AudioContext 仅在用户首次手势后创建，默认关闭且持久化。
- ✨ **彩纸无障碍**：`prefers-reduced-motion` 下走无动效路径，data-testid 稳定。
- 🧪 **Gauntlet 测试栈**：vitest + fast-check（属性）+ Stryker（突变）+ commitlint
  + commit-audit，强制单测 80% 行 / 70% 分支。
- 🚀 **Vercel-ready**：`@libsql/client` 的 http(s) 分支在 Vercel serverless 上
  直接连 Turso，零原生模块、零 fs 依赖。

## 路由

| Route | 说明 |
| --- | --- |
| `/` | 首页：战绩卡片 + 开始游戏 + 重置战绩 |
| `/play` | 游戏页：3x3 棋盘 + 当前玩家指示 + 重新开局 |
| `/result` | 结算页：胜负结果 + 再来一局 + 返回首页 + 重置战绩 |
| `GET /api/stats` | 读战绩 (Node runtime) |
| `PUT /api/stats` | 写战绩 seed / admin（@deprecated；客户端走 POST outcome） |
| `DELETE /api/stats` | 重置战绩 |
| `POST /api/stats/outcome` | 客户端落局：body `{outcome:'X'\|'O'\|'draw'}` → 200 `{stats:GameStats}` |

## 本地开发

```bash
pnpm install
pnpm dev              # http://localhost:3000
pnpm build && pnpm start
```

默认 `DATABASE_URL=file:./data/tic-tac-toe.db`，数据落在 `data/tic-tac-toe.db`。
**首次 clone 后不需要建 `.env.local`** — `lib/db.ts` 默认走
`file:./data/tic-tac-toe.db` 嵌入式 sqlite（`@libsql/client` 自带）。
`.env.example` 仅在你切到 Turso 或自定义路径时才需要复制。
HTTP 部署详见下方"部署"章节。

想用真实 Turso 库联调？参见 [本地联调 Turso 指南](docs/local-turso-setup.md)。

## Gauntlet 工具链

| 层 | 工具 | 命令 |
| --- | --- | --- |
| 单元 / 属性测试 | vitest + fast-check | `pnpm test` |
| 类型检查 | tsc (strict) | `pnpm typecheck` |
| Lint | eslint (next) | `pnpm lint` |
| Coverage | v8 (per-file) | `pnpm test:coverage` |
| Mutation | Stryker (scoped to `lib/` + `db/`) | `pnpm test:mutation` |
| 构建 | Next.js 16 (Turbopack) | `pnpm build` |
| E2E 视觉 | Playwright (vs `pnpm start`) | `node tests/qa/visual-qa.mjs` |

阈值在 `vitest.config.ts` 里：lines / functions / statements 80%，branches 70%。

## 目录结构

```
app/                  App Router 路由 + API route handler
  layout.tsx          字体 (Geist / Geist Mono) + 暗色基底
  page.tsx            首页 (Client)
  play/page.tsx       游戏页 (Client)
  result/page.tsx     结算页 (Client)
  api/stats/route.ts  /api/stats (GET/PUT/DELETE, await lib/db)
  globals.css         @theme tokens, 暗色基底
components/           Board + ui/* (Button/Card/Cell/StatsCard/StatusBar)
db/schema.ts          Drizzle schema (game_stats 单行表)
lib/
  game.ts             纯函数: 棋盘/胜负/可用格/先手随机/战绩累计
  game.test.ts        单元 + fast-check 属性测试 (同目录)
  db.ts               @libsql/client + Drizzle 封装（file:/http(s): 自适应）
  store.ts            Zustand store: phase/board/currentPlayer + /api/stats 同步
data/                 本地 SQLite 文件 (gitignored)
reports/mutation/     Stryker html + json 报告 (gitignored)
coverage/             v8 coverage html 报告 (gitignored)
tests/qa/             Playwright 视觉 + 提交审计
public/               静态资源 (logo / favicon)
```

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [DESIGN.md](DESIGN.md) | 设计契约：色彩 / 字体 / 间距 / 动效 / 可访问性 token |
| [AGENTS.md](AGENTS.md) | AI 代理与贡献规范：commit 约定、门禁、验证 gate |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 提交流程与本地开发 quick start |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Contributor Covenant 3.0 |
| [SECURITY.md](SECURITY.md) | 私有漏洞披露渠道 |
| [docs/testing.md](docs/testing.md) | 测试思路：分层策略、阈值、RED-first、QA 探针设计 |
| [docs/operations.md](docs/operations.md) | 操作手册：日常命令、DB、QA、提交规范速查、排错 |
| [docs/learnings.md](docs/learnings.md) | 学习笔记：踩坑记录与版本相关事项 |

## FAQ

**怎么切到 Vercel 持久化？** 默认 `DATABASE_URL=file:./...` 在 Vercel serverless
上是临时 fs，不会持久。把 `DATABASE_URL` 改成 `https://<db>.turso.io`（或
`libsql://<db>.turso.io`），并设置 `DATABASE_AUTH_TOKEN=<turso-issued-token>`。
`lib/db.ts` 会自动走 http(s) 分支，不再碰文件系统和原生 sqlite。详见下方"部署"。

**离线能玩吗？** 走棋可以（前端规则不依赖网络），但战绩落库需 `POST /api/stats/outcome`；
离线时玩的一局战绩会丢，下次上线 PUT/DELETE 不补。Vercel Analytics 噪声
（POST 到 `5376560351325243/view`）无法消除，是 Vercel 平台侧注入的 beacon。

**怎么清战绩？** 首页"重置战绩"按钮调用 `DELETE /api/stats`，单行表 id=1
会被清零；本地 UI 状态不依赖服务端响应也能保持正确。

**暗色模式能切浅色吗？** 当前不提供。Tailwind v4 设计令牌收敛在 `dark` 色板，
新增浅色需要重新画一整套 token 并同步 DESIGN.md，本期不在范围。

**测试为什么要 RED-first？** 任何行为变更必须先有失败用例，否则 commit-audit
无法区分"新增了真测试"与"复制粘贴"——详见 `docs/testing.md` §RED-first。

**Stryker / Playwright 跑不过怎么办？** 本地不强制 CI 之外的突变与 E2E，
PR 评审以 vitest + 浏览器 QA 探针为准。跑挂时优先排查 `docs/operations.md`
排错章节。

## 部署

### 单机 / 本地

`DATABASE_URL` 不设或设成 `file:./data/tic-tac-toe.db`，数据落在仓库下
`data/tic-tac-toe.db`，不需要任何 token。

### 驱动层（深模块）

`lib/db.ts` 把 driver 选型封在文件内部：同时 import `@libsql/client`（原生 sqlite）
和 `@libsql/client/web`（HTTP 客户端），由 `selectDriver(url)` 工厂按
`DATABASE_URL` 自动选：

| URL 形态 | 走的 driver | 适用 |
| --- | --- | --- |
| `file:...` | `@libsql/client` 原生 | 本地 / CI / 单机；自带嵌入式 sqlite，零配置 |
| `http://` / `https://` / `libsql://` | `@libsql/client/web` | Vercel serverless / Edge；走 Turso HTTP，避开原生 binding |

调用方（`app/api/stats/route.ts`、`lib/store.ts`）**零改动**——只 import
`loadStats / saveStats / resetStats / closeDb`，driver 选型完全藏在 db 模块里。

### Vercel + Turso 首次部署

1. [turso.tech](https://turso.tech) 建库：`turso db create <your-db-name>`。
2. 拿 libsql URL：`turso db show <your-db-name> --url`。
3. 拿 auth token：`turso db tokens create <your-db-name>` → JWT。
4. Vercel 项目 → Settings → Environment Variables，新增两条：

   | 变量 | 值 | 说明 |
   | --- | --- | --- |
   | `DATABASE_URL` | `libsql://<your-db-name>-<your-org>.turso.io` | `lib/db.ts` 把 `libsql://` 走 HTTP 分支 |
   | `DATABASE_AUTH_TOKEN` | 步骤 3 的 JWT | 只存 Vercel，不进 git |

   > **在第一次 push 之前配好**——否则首次部署就以未设 `DATABASE_URL` 的
   > 形态构建，战绩落进临时 fs。
5. `git push` 到 Vercel，`/api/stats` 自动用 Turso HTTP client 持久化。

**推之前先本地模拟**：把上面两条 env vars 写进 `.env.local`（已 gitignore），
`pnpm build && pnpm start` 后 `curl localhost:3000/api/stats` 确认读写正常，
通过再 push。

不要在 Vercel 上保留 `file:` URL——serverless 容器只有临时 fs，数据不会跨
请求保留。

### Vercel 排错

- **战绩被清零 / 过段时间没了**：Vercel 上残留了 `file:` URL。serverless fs
  是临时的，重启即丢；删掉该变量或换成 `libsql://`。
- **fetch failed**：`DATABASE_URL` 拼错（漏 `libsql://` 前缀或域名错误）。
  未知 scheme 会被 `lib/db.ts` 原样透传，由 client 报协议错。
- **401 / 403**：`DATABASE_AUTH_TOKEN` 缺失、过期或不属于这个库。重新
  `turso db tokens create <your-db-name>` 并更新 Vercel。
- **build 失败**：先核对两个变量名必须一字不差——`DATABASE_URL` 和
  `DATABASE_AUTH_TOKEN`，大小写和下划线都不能变。

- **CLI 部署 vs Git 自动部署（错误信号对照）**：

  本仓库支持两种部署方式：Phase 1 `vercel --prod` 手动，Phase 2 `git push` 触发。
  同一个项目可以混用——错误信号和查的位置不一样：

  | 现象 | CLI 部署（`vercel --prod`） | Git 自动部署（push 触发） |
  | --- | --- | --- |
  | 部署没启动 | 终端立即报错 + 非零退出码 | Dashboard 60s 内仍 "Queued" → 检查 GitHub Webhook |
  | build 失败 | stderr 里有失败 step + 文件路径 | Dashboard → Deployments → 点进 deployment 看 build log |
  | env var 缺失 | `vercel env ls production` 复核 | Dashboard → Settings → Environment Variables |
  | 部署成功但 5xx | curl + `vercel logs <deployment-url>` | Dashboard → Deployments → Runtime Logs |
  | 想回滚 | Dashboard → Deployments → "Promote to Production" | 同左（两种方式产生的 deployment 互相可见） |

  应急入口：当 Git 自动部署链路挂掉时，CLI 部署仍可独立推 production，
  不依赖 GitHub Webhook 状态。

### 生产 vs 开发的数据库选择

本仓库同一份 `lib/db.ts` 同时支持两种部署形态：`DATABASE_URL` 未设或为
`file:` 时走嵌入式本地 sqlite（`@libsql/client` 自带）；`libsql://` /
`http(s)://` 时走 Turso HTTP。切换形态只改环境变量，不改代码、不加依赖。

## License

[MIT](LICENSE) — Copyright (c) 2026 onepisYa.

## Publishing

This is a Next.js application, not a library. The npm package name
`tic-tac-toe` already exists on the npm registry, and there is no plan
to publish this codebase there. Do not run `npm publish` from this repo
without renaming + scoping first (e.g. `@<your-handle>/tic-tac-toe`) to
avoid E409 conflicts on the public registry.

## Funding

如果这个项目对你有用，欢迎在 [GitHub Sponsors](https://github.com/sponsors)
上支持长期维护；非必需，零功能差异。

## Related

- [AGENTS.md](AGENTS.md) — AI 代理契约与提交规范
- [DESIGN.md](DESIGN.md) — 设计令牌与无障碍契约
- [docs/testing.md](docs/testing.md) — 测试分层与探针设计
