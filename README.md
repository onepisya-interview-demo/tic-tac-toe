# 井字棋 (tic-tac-toe)

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
+ Zustand + Drizzle ORM + better-sqlite3。

## Features

- 🎯 **Pass-and-play**：同设备轮流落子，零网络依赖，纯前端 + Node API。
- 💾 **战绩持久化**：胜 / 负 / 平 / 连胜通过 SQLite 单行表落盘，刷新即用。
- 🌒 **暗色优先**：基于 Tailwind v4 设计令牌，桌面优先，移动端可用但非目标。
- ⌨️ **键盘优先**：棋盘使用 roving focus，落子、回车、回溯全部键控可触。
- 🔇 **音效懒加载**：AudioContext 仅在用户首次手势后创建，默认关闭且持久化。
- ✨ **彩纸无障碍**：`prefers-reduced-motion` 下走无动效路径，data-testid 稳定。
- 🧪 **Gauntlet 测试栈**：vitest + fast-check（属性）+ Stryker（突变）+ commitlint
  + commit-audit，强制单测 80% 行 / 70% 分支。
- 🚀 **Vercel-ready**：构建产物经过 Turbopack 验证，SQLite 替换为 Turso/LibSQL
  即可直接上 Vercel serverless。

## 路由

| Route | 说明 |
| --- | --- |
| `/` | 首页：战绩卡片 + 开始游戏 + 重置战绩 |
| `/play` | 游戏页：3x3 棋盘 + 当前玩家指示 + 重新开局 |
| `/result` | 结算页：胜负结果 + 再来一局 + 返回首页 + 重置战绩 |
| `GET/PUT/DELETE /api/stats` | 战绩读写 (Node runtime) |

## 本地开发

```bash
pnpm install
pnpm dev              # http://localhost:3000
pnpm build && pnpm start
```

数据落在 `data/tic-tac-toe.db`，通过 `DATABASE_URL` 环境变量可改路径
（默认 `file:./data/tic-tac-toe.db`）。

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

**为什么不用 Vercel 默认部署？** 项目默认是单机开发目标，better-sqlite3 在
Vercel serverless 无法持久化。要上 Vercel 必须先把 `lib/db.ts` 切到
Turso/LibSQL HTTP 驱动，部署说明会随之更新。

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

直接 push 到 Vercel 即可，SQLite 文件需替换为 Turso/LibSQL（better-sqlite3
在 Vercel serverless 上无法持久化）。当前默认是单机开发目标。

## License

[MIT](LICENSE) — Copyright (c) 2026 onepisYa.

## Funding

如果这个项目对你有用，欢迎在 [GitHub Sponsors](https://github.com/sponsors)
上支持长期维护；非必需，零功能差异。

## Related

- [AGENTS.md](AGENTS.md) — AI 代理契约与提交规范
- [DESIGN.md](DESIGN.md) — 设计令牌与无障碍契约
- [docs/testing.md](docs/testing.md) — 测试分层与探针设计
