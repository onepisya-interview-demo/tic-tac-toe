# Notes

> 来源：AGENTS.md §备注（行 194–198）

## lib/db.ts 客户端缓存

`lib/db.ts` 通过 `@libsql/client` + Drizzle 初始化并缓存 libsql 客户端；测试通过 `DATABASE_URL`/临时目录隔离，并调用 `closeDb()`。

## 战绩表是 per-room 单行族

战绩表是 per-room 单行族（`room TEXT UNIQUE`，W1 列名从 name 改名），不是单行 `id=1`。即使 POST 失败，本地 UI 状态仍保持正确。

## next-env.d.ts 是已跟踪的生成文件

`next-env.d.ts` 是已跟踪的生成文件；切换构建模式时，它的引用发生变化是合理的（常见 diff：`./.next/types/routes.d.ts` ↔ `./.next/dev/types/routes.d.ts`，这是 `next dev` ↔ `next build` 的产物路径切换，不应手动 fix）。

## vitest jsdom 环境创建开销（优化线索，2026-09-26 记）

vitest 提示：jsdom 环境被创建 47 次、约占 tracked time 56%（两计划波后 540 测试规模实测）。若测试时长未来成为瓶颈，候选方向是 `pool: 'vmThreads'`（保 per-file 隔离）或 `isolate: false`（共享环境，需评估隔离代价）。现为线索非行动项，未裁决不动。

## 交叉引用

- DB schema 与 reconcile 约束 → [docs/anti-patterns.md §L2-7](./anti-patterns.md#l2-按需读--agents-md-完全外化)
- 浏览器探针范式与 BASE_URL → [docs/commands.md](./commands.md)
