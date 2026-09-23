# Repo Map

> 来源：AGENTS.md §概览（行 21–23）+ §结构（行 25–35）+ §查找入口（行 37–49）

## 概览

一局棋两版本（offline 单机 / online 在线，pass-and-play 同设备对战）+ RESTful API + schema.org 词汇对齐的井字棋：「房间」是这台设备上这组人的战绩账本标识（W3 D-3 御定术语迁移）。首页是引导页，offline 完全离线、本地账本、唯一网络写是合并弹框；online 需 roomName、`StartGameButton` + `RoomGateDialog` 按需收名（无名点 CTA 弹框收名）、战绩实时上服服务端权威累加、`/result?room=` RSC 实时成绩单。技术栈是 Next.js 16 App Router、React 19、strict TypeScript、Tailwind v4 设计令牌、Zustand、Drizzle ORM 和 @libsql/client（本地 file: sqlite / Vercel 走 Turso HTTP）。

详细产品模型见 [.omo/plans/ulw-one-game-two-versions.md](../.omo/plans/ulw-one-game-two-versions.md) 与 [.omo/plans/ulw-room-migration-home-landing.md](../.omo/plans/ulw-room-migration-home-landing.md)。

## 目录结构

```
.
├── app/               # 引导页 / online / offline / result 四路由 + RESTful API 5 端点（/api/rooms/*）+ JSON-LD
├── components/        # 棋盘、合并弹框、房间弹框、战绩客户端组件，ui/ 基础组件
├── lib/               # 纯规则、客户端 store、浏览器效果、SQLite I/O、RFC 9457 helper、房间白名单
├── db/                # Drizzle schema：game_stats 单行表（room TEXT UNIQUE，W1 列名从 name 改名）
├── tests/qa/          # 面向生产服务的 Playwright 探针（含 offline-qa / one-identity-qa 整合探针）
├── docs/              # 面向人的测试、运维和经验记录
├── .omo/plans/        # 非平凡提交必需的设计记录
└── data/              # 已忽略的 SQLite 运行数据库
```

## 查找入口

| 任务 | 位置 | 说明 |
| --- | --- | --- |
| 路由或 API 行为 | app/ | 客户端四页路由 + Node runtime RESTful 五端点（`POST /api/rooms` + `GET /api/rooms/[room]/stats` + `POST /api/rooms/[room]/stats/merge` + `POST /api/rooms/[room]/stats/outcomes` + `POST /api/rooms/[room]/stats/reset`，W3 D-3 一波迁移 + W-R 增 reset） |
| 规则、战绩、持久化 | lib/game.ts、lib/store.ts、lib/db.ts、db/schema.ts | 纯规则不依赖 React/DOM；lib/db.ts 是 service 层，零 HTTP 上下文 |
| RESTful 浏览器薄壳 | lib/game-net.ts | postRoomSession / fetchRoomStats / postMerge / postOutcome / postResetRoomStats + 8s AbortController |
| RFC 9457 problem+json | lib/api-problem.ts | problemResponse + ProblemSlug + typeUriFor |
| 视觉和无障碍契约 | DESIGN.md、app/globals.css、components/ | 设计令牌与全局 focus 所有权是契约 |
| 领域术语与歧义裁决 | CONTEXT.md | 语言契约：命名对齐先查此表，产出物禁用其 `_Avoid_` 别名；收录/晋升门槛见 .omo/plans/glossary-context-md.md |
| 浏览器验证 | tests/qa/ | 先 pnpm build && pnpm start (`:3101`)，不要用 dev server |
| 提交策略 | docs/commit-policy.md | tests/qa/commit-audit.mjs 和 Git hook 共同强制 |
| 既有设计理由 | .omo/plans/*.md | 非平凡提交必须引用 Plan footer |
| 反模式与硬约束 | docs/anti-patterns.md | L0/L1/L2 反模式全集 |
| 符号地图（中心度） | docs/code-symbols.md | 14 行大表，覆盖 lib + components + tests/qa |
| 命令清单 | docs/commands.md | dev/build/test/lint + 端口约定 |
