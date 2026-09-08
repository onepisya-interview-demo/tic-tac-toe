# Plan — docs 同步：@libsql/client 描述与测试计数

Intent: 把 commit d718b94 切到 @libsql/client 后遗漏的两条文档字面量与实际代码对齐，避免 contributor guide 和测试规模继续陈旧。

## 范围

- `AGENTS.md` §备注：`WAL SQLite` → `@libsql/client + Drizzle ... libsql 客户端`
- `docs/testing.md` §当前规模：`vitest：78 例` → `vitest：84 例`

## 不动

- 不改 schema / route / db.ts / package.json / tests；纯文档同步。
- 不删 .omo/plans/turso-libsql-http.md；它仍是 d718b94 的设计记录。

## 验证

- `pnpm vitest run` 84/84 绿。
- `pnpm typecheck` 0。
- `pnpm lint` 0。
- `pnpm build` 0；路由数不变。
- `commit-audit` 0 violation。

Constraint: 与 d718b94 同一迁移语义，纯文档同步。
Rejected: 整段删除 AGENTS.md §备注那条 | 项目反模式要求保留测试隔离 + closeDb 描述。
Rejected: 把测试计数改成 "82" | 实际跑 `pnpm vitest run --reporter=verbose` 是 84。
Confidence: high
Scope-risk: narrow
Directive: 后续驱动/测试规模变更时同步检查 AGENTS.md §备注 与 docs/testing.md §当前规模。
Tested: vitest 84/84、typecheck、lint、build
Not-tested: 无行为变化
