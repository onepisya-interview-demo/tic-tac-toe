<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:project-contribution-guidelines -->
总是使用中文进行回复。

# 项目知识库（Router）

> 每个会话都必需的金训内联；高频契约路由化；按需读外化文件。详见 `docs/repo-map.md`。设计记录：`Plan: .omo/plans/ulw-agents-md-router-20260922.md`

## L0 硬约束（漏则破契约）

- 路径别名 `@/*` → 仓库根；规则放 `lib`，schema 放 `db`，UI 组合放 `components`。
- Server Component 默认；只有交互/浏览器 API 才加 `'use client'`。
- 路由命名：`/online` + `/offline` + `/result`；不引入 `solo` / `ranked` / `singleplayer` / `multiplayer`（schema.org 词汇对齐）。
- 不引入新 UI / 路由 / 动画 / 数据访问 / 表单库。
- **service / transport 分离**：service 函数返回纯数据 + 状态标记；transport 唯一决定 status code。详见 `docs/anti-patterns.md` §L0。
- 不在 SSR 首帧读 localStorage；先渲染安全默认值 + `useEffect` 同步。
- 不 `--no-verify` 绕过任何钩子（commit-msg／pre-push 等）；契约要求生产构建时不在 dev 跑浏览器 QA。
- 永不自动 push：任何 push（常规/force/tag/远程分支删除）必须主公明令后以 MASTER_PUSH_DECREE=1 执行；机械防线 .git/hooks/pre-push
- `// BR:` 头注释（前 20 行内）不可动：`docs/business-rules.md` 探针列登记文件的头是契约载体（R6 双向校验，branch/range 审计面＋远程 commit-audit job（advisory）；误删不在提交时被挡，故靠此条守住）。
- 依赖新增政令（主公 2026-10-26 立，2026-11-09 修订）：两档制——①产品上线打包类（机械判据：`dependencies`，进生产包/bundle）必须主公判断并审批后才可添加；②改造环境／改进验证／增加人类对 agent 信任类（机械判据：`devDependencies`，不进产品包）豁免＝自决可加。共同义务：不是禁依赖是禁无用依赖——只加有效依赖（写明现有方案／内置能力为何不够）＋克制＋台账留痕。

## L1 路由指针（一行式 digest + 完整文档）

- 仓库结构与查找入口：[`docs/repo-map.md`](docs/repo-map.md)
- 文档状态总图（哪个计划实现了没）：[`.omo/doc-status-map-20260927.md`](.omo/doc-status-map-20260927.md)
- 代码符号地图：[`docs/code-symbols.md`](docs/code-symbols.md)
- 约定与命名（含注释规范：删/留/转化分诊矩阵＋四条归格规则）：[`docs/conventions.md`](docs/conventions.md)
- 视觉与无障碍：[`docs/style.md`](docs/style.md)
- 命令与端口：[`docs/commands.md`](docs/commands.md)
- 反模式全集：[`docs/anti-patterns.md`](docs/anti-patterns.md)
- 调试者备注：[`docs/notes.md`](docs/notes.md)
- 调度者职责与派发纪律（Session 单一事则 / 正交性矩阵 / wayfinder 地图接线与试点复盘 / 多票波派单复盘）：[`docs/dispatcher-playbook.md`](docs/dispatcher-playbook.md)
- 验证门禁（六层）：[`docs/verification-gauntlet.md`](docs/verification-gauntlet.md)
- 提交策略：[`docs/commit-policy.md`](docs/commit-policy.md)
- herdr session 协议：[`docs/herdr-session-hygiene.md`](docs/herdr-session-hygiene.md)
- 需求对齐协议：[`docs/requirement-intake.md`](docs/requirement-intake.md)
- 业务规则清单（decree + 正反面场景 + 探针映射）：[`docs/business-rules.md`](docs/business-rules.md)
- 运行时能力边界：[`.omo/plans/agent-runtime-boundaries.md`](.omo/plans/agent-runtime-boundaries.md)
- 调度者四层职责（设计记录）：[`.omo/plans/dispatcher-roles-retrospective.md`](.omo/plans/dispatcher-roles-retrospective.md)

## 注释写作纪律（两条，对齐 Anthropic 官方提示模板）

- 不给未改动的代码加注释。
- 只在 logic 不自明处加注释。

## 验证六层一行式

① vitest ② typecheck ③ lint ④ build ⑤ commit-audit ⑥ 浏览器探针（详见 [`docs/commands.md`](docs/commands.md)）。

## commit-msg hook

`.git/hooks/commit-msg` 调 `node tests/qa/commit-audit.mjs --message-file "$1"`；不合规失败；禁 `--no-verify`。策略真源 [`tests/qa/commit-audit.mjs`](tests/qa/commit-audit.mjs) + [`docs/commit-policy.md`](docs/commit-policy.md)。
<!-- END:project-contribution-guidelines -->
