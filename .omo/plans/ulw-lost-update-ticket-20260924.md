# ulw-lost-update-ticket-20260924 — 票 T-C：lost-update 产品修复

> **基线**：`ed25cb046ac4d40774fd7377890a2f422895dc94`
> **分支**：`fix/lost-update-mutex`
> **Worktree**：`/private/tmp/ttt-wt-20260924/lostupdate`
> **真源地图**：`.omo/plans/ulw-rooms-race-map-20260924.md` 票 T-C；实验证据 `tests/db/ta-transaction-feasibility.test.ts` @ `6f19527`（env 门控 `TA_RACE_EXPERIMENT=1` 可复跑）。
> **决策链**：T-A 实测毕业（D9）— 进程内互斥 + `transaction('write')` API = 零丢失零报错（E6）；裸 BEGIN/COMMIT 经 `execute()` 不可用（E2/E4 证伪）；失败回滚泄漏文件锁需客户端回收（E7 多实例残差事实）。

## 1. 目标

修复 `lib/db.ts` 的并发写丢失更新（lost-update）缺陷。两条写路径 `recordOutcomeForRoom` 与 `mergeRecordByRoom` 在同进程并发请求下，60/60 轮确定性丢失（实验 E1 真产品码）；文件头注释「单进程内三步串行执行，不会交错」被实测证伪，必须改写。本票采用 **D9 形态**：进程内互斥串行化（promise 链，per-process）为主、事务包裹（`drizzle` 暴露的 `db.transaction()`，其内部转调 `@libsql/client` 官方 `transaction('write')` API）为辅。

**Out of scope**：分布式一致性强保证（多区域多写者）；事件源化；schema 改动。

## 2. 改动清单（最小且互斥）

### 2.1 lib/db.ts

**新增（模块级互斥链）**：
```typescript
/**
 * Per-process writers chain. Each write that depends on the prior
 * read (load → mutate → upsert) chains onto this; failures do NOT
 * poison the chain (catch + reassign keeps subsequent calls queueable).
 * Eliminates the JS-layer interleave window between load/upsert
 * (refuted by E1 60/60 lost updates; tests/db/ta-transaction-feasibility.test.ts).
 */
let writeChain: Promise<unknown> = Promise.resolve();

function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn);
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}
```

**改造 `recordOutcomeForRoom`**：
- 外层加 `withWriteLock(...)` 串行化所有 caller；
- 内部用 `drizzle` 的 `db.transaction(async (tx) => { load; upsert })` 包裹（其自动 `client.transaction('write')` + `commit`/`rollback`，并复用 @libsql/client 的真锁语义 — E5 实证）；
- load 失败 / not-found 路径不写库；upsert 失败由 drizzle 事务自动回滚并向上抛。

**改造 `mergeRecordByRoom`**：同上形态（同 `load → accumulate → upsert`）。

**改造 `resetRecordByRoom`**：同上形态（同 `load → upsert(emptyStats())`）— 与 recordOutcome/mergeRecord 并发时仍需互斥，否则并发 reset + 局会写回旧值。

**未动**：
- `upsertRecordByRoom`：纯 upsert，无读，不入互斥（外层已是 write-then-load 的对立面，单调用天然安全；并发 upsert 走 SQLite UNIQUE 解决）。
- `loadRecordByRoom`：纯读。
- `ensureRecordByRoom` / `registerOrLoginRoom`：自具 catch-and-reread 兜底（UNIQUE 撞了就再读出表值），并发无需互斥。

**selectDriver 分流 / RecordOutcomeResult / ResetRecordResult 契约不动**（AC-5）。

### 2.2 lib/db.ts 文件头「行为契约」节 + :377 注释改写

**删除失实声明**：
> 单 Node 进程内 load → mutate → upsert 三步串行执行，不会交错。

**改写为**（事实陈述）：
> 每个 service 函数在 Node 单进程内通过 `withWriteLock` 把所有
> load → mutate → upsert 三步整体串行化（promise 链，每条链附
> 带 catch 防止单次失败毒化后续排队），并在 drizzle 的
> `db.transaction()` 包裹内执行（其内部转调 `@libsql/client` 的
> `client.transaction('write')` 真锁 API）。同进程并发
> `recordOutcomeForRoom` / `mergeRecordByRoom` /
> `resetRecordByRoom` 在 lib/db.ts 范围内不会丢失更新。多实例
> （Vercel + Turso HTTP）部署下的跨进程竞态由本仓 README「多实
> 例 last-write-wins」边界注承担，不在本服务实现承诺内；实测指
> 向 tests/db/ta-transaction-feasibility.test.ts 的 E6/E7（E6
> 实证修复形态零丢失零报错；E7 揭示失败回滚泄漏文件锁需客户端
> close 回收的运维事实）。

### 2.3 新增 tests/db/lost-update-mutex.test.ts（常规 vitest，非 env 门控）

参照 `tests/db/db.test.ts` 的 tmpdir + `DATABASE_URL` + `vi.resetModules` + `closeDb` 模式。

四个用例：
1. **`recordOutcomeForRoom` 双并发 10 轮采样** — 每轮先 reset 零局 → 两个 `recordOutcomeForRoom('X')` 并发 → 终值 `totalGames === 2 && xWins === 2 && currentStreak === 2`（修复前必丢；修复后零丢失）。
2. **`mergeRecordByRoom` 双并发累加** — 服务端起始 `(2X, 1O, 1D, streak +1)` → 两个 `mergeRecordByRoom(client, (3X, 2O, 1D, streak 0))` 并发 → 终值严格累加到 `(2+3+3, 1+2+2, 1+1+1, +1+0+0) = (8, 5, 3, 1)`。
4. **`recordOutcomeForRoom` + `resetRecordByRoom` 并发不丢并发不写回旧值** — 起始局已结束 `(1X, 0O, 0D, streak +1)`；并发 `recordOutcomeForRoom('X')` 与 `resetRecordByRoom`；终值要么 `(2, 1, 0, 0, +2)` 要么 `(0, 0, 0, 0, 0)`；**不允许出现任何其他值**（混态即丢更新）。
4. **异常路径不毒化互斥链** — 一个调用注入 reject → 紧接的下一个正常调用必须成功（终值 = 1 局，非挂起）。

### 2.4 交付物落 `.omo/evidence/lost-update-ticket/report.md`

含 AC-1 ~ AC-5 逐条 self-check（PASS / FAIL + 证据路径）+ 改动文件清单 + 六层门禁自跑结果 + 偏离任务书之处（如有则写明）。

## 3. 验收（AC）

- **AC-1**：新回归测试全绿；`pnpm vitest run tests/db` 全绿（含既有 ta-transaction-feasibility 默认 skip）。
- **AC-2**：`pnpm vitest run` 全库绿、总数 ≥ 506；`pnpm typecheck` exit 0；`pnpm lint` exit 0。
- **AC-3**：注释与行为一致；`lib/db.ts` 不再含「单进程内不会交错」失实声明。
- **AC-4**：diff 面仅含 `lib/db.ts`、`tests/db/lost-update-mutex.test.ts`、本 plan、evidence。
- **AC-5**：selectDriver 分流 / RecordOutcomeResult / ResetRecordResult / drizzle schema 不动。

## 4. 验证（六层门禁一线式）

① `pnpm vitest run` ② `pnpm typecheck` ③ `pnpm lint` ④ `pnpm build` ⑤ `node tests/qa/commit-audit.mjs --message-file <m>` ⑥ 不动 `lib/db`** 的产品码探针（无网络/浏览器改动，本票仅 vitest）。

## 5. commit 形态

参照 `6f19527` 实验票的格式（test + fix 同族可拆两 commit）：
- `fix(db): 进程内互斥 + 事务包裹堵住 lost-update 窗口（互斥链 + drizzle db.transaction 形态，E6 实证零丢失）`
- `test(db): 真产品码双并发回归用例——recordOutcome/mergeRecord/reset 互斥断言 + 异常路径不毒化链`

每个 commit 配齐 Constraint / Rejected / Confidence / Scope-risk / Directive / Tested + footer `Plan: .omo/plans/ulw-lost-update-ticket-20260924.md`。
