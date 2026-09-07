# 井字棋 (tic-tac-toe)

两人同设备 pass-and-play 的井字棋小游戏，自动记录战绩。
Web app, 桌面优先, 暗色克制工程师感 (Linear + Vercel 风)。

技术栈: Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4 + Zustand + Drizzle ORM + better-sqlite3。

## 路由

| Route | 说明 |
| --- | --- |
| `/` | 首页: 战绩卡片 + 开始游戏 + 重置战绩 |
| `/play` | 游戏页: 3x3 棋盘 + 当前玩家指示 + 重新开局 |
| `/result` | 结算页: 胜负结果 + 再来一局 + 返回首页 + 重置战绩 |
| `GET/PUT/DELETE /api/stats` | 战绩读写 (Node runtime) |

## 本地开发

```bash
pnpm install
pnpm dev              # http://localhost:3000
pnpm build && pnpm start
```

数据落在 `data/tic-tac-toe.db`, 通过 `DATABASE_URL` 环境变量可改路径 (默认 `file:./data/tic-tac-toe.db`)。

## Gauntlet 工具链

| 层 | 工具 | 命令 |
| --- | --- | --- |
| 单元/属性测试 | vitest + fast-check | `pnpm test` |
| 类型检查 | tsc (strict) | `pnpm typecheck` |
| Lint | eslint (next) | `pnpm lint` |
| Coverage | v8 (per-file) | `pnpm test:coverage` |
| Mutation | Stryker (scoped to `lib/` + `db/`) | `pnpm test:mutation` |
| 构建 | Next.js 16 (Turbopack) | `pnpm build` |
| E2E 视觉 | Playwright (vs `pnpm start`) | `node tests/qa/visual-qa.mjs` |

阈值在 `vitest.config.ts` 里: lines/functions/statements 80%, branches 70%。

## 目录结构

```
app/                  App Router 路由 + API route handler
  layout.tsx          字体 (Geist / Inter / JetBrains Mono) + 暗色基底
  page.tsx            首页 (Client)
  play/page.tsx       游戏页 (Client)
  result/page.tsx     结算页 (Client)
  api/stats/route.ts  /api/stats (GET/PUT/DELETE)
  globals.css         @theme tokens, 暗色基底
components/           Board + ui/* (Button/Card/Cell/StatsCard/StatusBar)
db/schema.ts          Drizzle schema (game_stats 单行表)
lib/
  game.ts             纯函数: 棋盘/胜负/可用格/先手随机/战绩累计
  game.test.ts        单元 + fast-check 属性测试 (同目录)
  db.ts               better-sqlite3 + Drizzle 封装
  store.ts            Zustand store: phase/board/currentPlayer + /api/stats 同步
data/                 SQLite 文件 (gitignored)
reports/mutation/     Stryker html + json 报告 (gitignored)
coverage/             v8 coverage html 报告 (gitignored)
tests/                集成测试 + visual QA
```

## 文档导航

| 文档 | 内容 |
| --- | --- |
| [DESIGN.md](DESIGN.md) | 设计契约：色彩/字体/间距/动效/可访问性 token |
| [AGENTS.md](AGENTS.md) | AI 代理与贡献规范：commit 约定、门禁、验证 gate |
| [docs/testing.md](docs/testing.md) | 测试思路：分层策略、阈值、RED-first、QA 探针设计 |
| [docs/operations.md](docs/operations.md) | 操作手册：日常命令、DB、QA、提交规范速查、排错 |
| [docs/learnings.md](docs/learnings.md) | 学习笔记：踩坑记录与版本相关事项 |

## 部署

直接 push 到 Vercel 即可, SQLite 文件需替换为 Turso/LibSQL (better-sqlite3 在 Vercel serverless 上无法持久化)。当前默认是单机开发目标。
