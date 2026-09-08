# 操作手册（Operations）

> 人类可读的日常操作入口。环境变量、命令、DB、QA、提交规范速查与排错。

## 前置

- pnpm（包管理）、Node.js ≥ 20、Playwright 浏览器（`pnpm exec playwright install`）
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

- 本机：留 `DATABASE_URL` 默认值，`pnpm start` 即可。
- Vercel + Turso：设 `DATABASE_URL=libsql://<db>.turso.io` 与
  `DATABASE_AUTH_TOKEN=<jwt>`，详见 README.md §部署。**不要**在 Vercel 上保留
  `file:` URL——容器 fs 是临时的，重启即丢。

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
