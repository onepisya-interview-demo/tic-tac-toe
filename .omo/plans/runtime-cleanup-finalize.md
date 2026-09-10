# Runtime Cleanup Finalize — 砍测试接缝 + 单一入口 + 功能不变验证

## Context

- `b8e0a40` 把 `lib/db.ts` 重构为深模块，引入三件套：`selectDriver(url)` + `createClientFn` 闭包 + `__setCreateClientForTests` 接缝
- `selectDriver` 真有用：URL→driver 单一职责映射，深模块核心，**保留**
- `createClientFn` + `__setCreateClientForTests` 是测试接缝：runtime 里用 module-level 可变全局状态 + setter export 让测试注入 fake client
- 接缝代价（详见后文 §"接缝代价证据"）：
  1. runtime 多一个可变全局变量
  2. 测试与生产路径分叉（selectDriver 路径测试时不覆盖）
  3. 多一个公开 export（`__setCreateClientForTests`）
  4. 测试间状态需手动复位
- 用户最新指令："回归直接 import（更简单）"——指测试接缝那一坨
- **硬约束**：本地 file: 启动不变；线上 Turso HTTP 启动不变。改动必须**功能不变**，由显式验证保证
- Vercel 项目状态：旧 alias `ulw-demo.vercel.app` 还在 project domains list；最新 production `dpl_AToyuvD1HY7PakBw6KGKDNRMJ2v5` 还挂着 `tic-tac-toe-onepisyas-projects.vercel.app` canonical alias
- `3t-tic-tac-toe.vercel.app` 已是 verified project-level domain，自动 follow production deployment

## Goal

A. **代码简化（narrow refactor）**：`lib/db.ts` 移除 `createClientFn` 闭包 + `__setCreateClientForTests` 出口；**保留** `selectDriver`（深模块核心）；`getDb` 改为 `const driver = selectDriver(config.url); cachedClient = driver.createClient(config);`
B. **测试改写**：3 个 `selectDriver` identity 测试保留；5 个 `__setCreateClientForTests` 注入测试改为 `vi.spyOn(nativeClient, 'createClient')` / `vi.spyOn(webClient, 'createClient')`
C. **Vercel 单一入口**：保留 `3t-tic-tac-toe.vercel.app` 作为唯一公开 alias；删除 `ulw-demo.vercel.app` project domain；旧 deployment 加 protection + 30 天 expiration
D. **文档同步**：`docs/operations.md` 当前部署示例表更新；`route.ts` 注释扩展可单独 commit
E. **功能不变（hard guarantee）**：本地 `pnpm build && pnpm start` 启动后 `file:` URL 端到端可用；线上 `3t-tic-tac-toe.vercel.app` 用 `libsql://` 走 Turso HTTP 端到端可用

## 接缝代价证据（写在这里备查，不在 plan 里）

| 维度 | 现状 | 改造后 |
| --- | --- | --- |
| Module 可变状态 | `let createClientFn = defaultCreateClient` | 0 |
| 测试-生产路径 | 分叉（接缝绕过 selectDriver） | 统一（spy 拦截真实 webClient.createClient） |
| 公开 export | +`__setCreateClientForTests` | 同前（少 1 个） |
| 测试行数 | ~13 行 / 5 case | ~15 行 / 5 case |
| 覆盖率 | selectDriver 路径靠 3 个独立 test | selectDriver 路径在 loadStats/saveStats 流程中被自然覆盖 |

## Out of scope

- 不新增 npm 依赖
- 不改 `route.ts` runtime（保持 nodejs）
- 不动 `db/schema.ts`
- 不绑自定义付费域名
- 不写 Turso 备份文档
- 不引入 Sentry / Datadog
- 不动 `selectDriver`（深模块核心，保留）
- 不动 `getDb` / `loadStats` / `saveStats` / `resetStats` / `closeDb` 5 个 export 的签名

## Files changed

| 文件 | 改动 |
| --- | --- |
| `lib/db.ts` | 移除 `CreateClientFn` 类型、`defaultCreateClient`、`createClientFn` 闭包、`__setCreateClientForTests` 函数；`getDb` 改为 `const driver = selectDriver(config.url); cachedClient = driver.createClient(config);`；`selectDriver` 函数签名 + JSDoc 0 改 |
| `tests/db/db.test.ts` | 3 个 selectDriver identity 测试保留；5 个 `__setCreateClientForTests` 注入测试改用 `vi.spyOn(webClient, 'createClient')` / `vi.spyOn(nativeClient, 'createClient').mockImplementation((c: Config) => { seen.push(c); return fakeClient(); })`；4 个真实 sqlite file 测试保留；2 个 schema / bootstrap 测试保留 |
| `app/api/stats/route.ts` | 仅注释扩展（已存在 unstaged diff，独立 commit） |
| `docs/operations.md` | 当前部署示例表更新：production URL = `https://3t-tic-tac-toe.vercel.app/`；runtime = nodejs；旧 deployment 加 protect 30d expire；加"用户访问入口：仅 3t-tic-tac-toe.vercel.app"段 |
| `.omo/plans/vercel-deploy-runbook.md` | 末尾追加 "## Final state" 段 |
| `.omo/plans/runtime-cleanup-finalize.md` | 本文件 |

## Implementation steps

### Wave A — 代码简化（前置门禁）

1. **A1 仓库就绪审计**：`pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 四件 exit 0
2. **A2 简化 lib/db.ts**（严格按现状增量改，避免误删 `selectDriver` 或 `resolveDbConfig`）：
   - 删：`type CreateClientFn = ...`（13 行）
   - 删：`const defaultCreateClient: CreateClientFn = ...`（3 行）
   - 删：`// Test seam — replaced by tests...` 注释 2 行
   - 删：`let createClientFn: CreateClientFn = defaultCreateClient;`（1 行）
   - 删：`export function __setCreateClientForTests(...)`（3 行）
   - 改：`getDb` 内 `cachedClient = createClientFn(config);` → 改为：
     ```ts
     const driver = selectDriver(config.url);
     cachedClient = driver.createClient(config);
     ```
   - 改：`selectDriver` JSDoc 删 "Exported for tests; production callers should not need it." 这一句（避免歧义——它现在 production 路径也直接调用）
3. **A3 改写 tests/db/db.test.ts**：5 个 `__setCreateClientForTests` 注入测试用 `vi.spyOn` 改造。具体模式：
   ```ts
   process.env.DATABASE_URL = 'https://example.turso.io';
   process.env.DATABASE_AUTH_TOKEN = 'test-token';
   vi.resetModules();
   const webClientMod = await import('@libsql/client/web');
   const seen: Config[] = [];
   const spy = vi.spyOn(webClientMod, 'createClient').mockImplementation((c: Config) => {
     seen.push(c);
     return fakeClient() as unknown as Client;
   });
   const { loadStats, closeDb } = await import('@/lib/db');
   try {
     await loadStats();
     expect(seen).toHaveLength(1);
     expect(seen[0].url).toBe('https://example.turso.io');
     expect(seen[0].authToken).toBe('test-token');
   } finally {
     spy.mockRestore();
     await closeDb();
   }
   ```
   - `file:` URL 分支：`vi.spyOn(nativeClientMod, 'createClient')` 而不是 webClient
   - `default URL fallback`：`vi.spyOn(nativeClientMod, 'createClient')`
   - `default branch 自动 mkdir`：`vi.spyOn(nativeClientMod, 'createClient')`
   - 注意 `vi.resetModules()` 必须在 spy 设置**之前**——否则 spy 可能挂在 stale module 引用上
4. **A4 重跑 4 道关**：`pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build` 全绿；`node tests/qa/commit-audit.mjs` 0 violation
5. **A5 commit 1**：`refactor(db): 去掉 createClientFn / __setCreateClientForTests 测试接缝，保留 selectDriver 深模块核心`

### Wave B — 功能不变验证（依赖 A，必须通过才能进 Wave C）

> 用户硬约束：本地 file: + 线上 libsql:// 都要端到端可用。这 wave 是证明。

6. **B1 本地 file: 端到端**：
   - `unset DATABASE_URL DATABASE_AUTH_TOKEN`（确保走 default file: 分支）
   - 后台启动 `pnpm start`，捕获 pid
   - poll `curl -fsS http://localhost:3000/api/stats` 直到 200（最多 60s）
   - 跑 4 步 curl：GET（zeros）→ PUT（1,1,0,0,1）→ GET（1,1,0,0,1）→ DELETE（zeros）
   - 验证：`data/tic-tac-toe.db` 文件被创建；GET 第一次返回 `{totalGames:0,...}`；PUT 后 GET 返回 `{totalGames:1,...}`
   - cleanup：`kill <pid>` + `kill -0 <pid>` 必须 fail + `lsof -i :3000` 必须空
7. **B2 远程 libsql:// 端到端**（生产 URL 部署后做）：
   - `curl https://3t-tic-tac-toe.vercel.app/api/stats` GET（zeros）
   - PUT（1,1,0,0,1）
   - GET（1,1,0,0,1）
   - DELETE（zeros）
   - 4 步全 200 + 期望 JSON 形状
8. **B3 关键对照表**（写到 evidence）：
   | 路径 | URL 形态 | 走的 driver | 期望行为 | 实际行为 |
   | --- | --- | --- | --- | --- |
   | 本地 dev/start | `file:./data/tic-tac-toe.db`（default） | `@libsql/client` native | sqlite 文件读写 | （B1 验证） |
   | 线上 Vercel | `libsql://tic-tac-toe-onepisya-...` | `@libsql/client/web` | Turso HTTP 读写 | （B2 验证） |

### Wave C — Vercel 单入口（依赖 A，可与 B 并行准备但 deploy 必须 B1 绿之后）

9. **C1 部署新版本**：`vercel --prod --yes` → 拿到新 deployment ID（形如 `dpl_NEW...`）
10. **C2 验证 production URL 自动 follow**：`curl -i https://3t-tic-tac-toe.vercel.app/api/stats` GET 期望 200
11. **C3 跑远程 4 步 curl**（即 B2 的实施步骤）
12. **C4 删除旧 project domain**：`ulw-demo.vercel.app` → `DELETE https://api.vercel.com/v10/projects/{id}/domains/ulw-demo.vercel.app`
13. **C5 给所有旧 deployment 加 protection + expiration 30 day**：
    - 旧 production deployment：`dpl_AToyuvD1HY7PakBw6KGKDNRMJ2v5`
    - 早期 production deployment：`dpl_5F6CpuPqu8v7VFPc2KmmpGfzncTa`
    - 用 `vercel deployment protect <deployment-url>` 或 PATCH `/v13/deployments/{id}` API
14. **C6 抓 evidence**：新 deployment ID、production URL、4 步 curl 输出、domain list、protection 状态
15. **C7 commit 2**：`chore(route): runtime=nodejs 注释扩写（Next 16 Edge 弃用说明）`（route.ts 已存在 unstaged diff）

### Wave D — 文档更新（依赖 C）

16. **D1 docs/operations.md §当前部署示例** 表更新：
    - 生产 URL：`https://3t-tic-tac-toe.vercel.app/`（canonical alias，verified project-level domain）
    - runtime：nodejs
    - 旧 deployment（dpl_AToyuvD1HY7PakBw6KGKDNRMJ2v5、dpl_5F6CpuPqu8v7VFPc2KmmpGfzncTa）：已加 Vercel project protection，30 天后自动过期
    - 加"用户访问入口"段：仅 `https://3t-tic-tac-toe.vercel.app/`；旧 `ulw-demo-*` / `tic-tac-toe-onepisyas-projects.*` 30 天后自动失效；过期前 protected
17. **D2 .omo/plans/vercel-deploy-runbook.md** 末尾追加 "## Final state" 段，引用本 plan
18. **D3 commit 3**：`chore(docs): 更新当前部署示例与 runtime 状态（3t 单入口 + 旧 deployment 30d protect）`

### Final verification wave

- F1 Plan compliance audit — 全部 step 完成 + evidence 落盘
- F2 Code quality review — `pnpm typecheck/lint/vitest/build` 4 项绿 + `tests/qa/commit-audit.mjs` 0 violation
- F3 Real manual QA — `curl https://3t-tic-tac-toe.vercel.app/api/stats` 4 步全 200；浏览器打开首页 + 玩一局 + 战绩持久化
- F4 Scope fidelity — OUT 0 违反：无新依赖、runtime 保持 nodejs、`selectDriver` 保留、旧 deployment 已 protect、project domains 仅 `3t-tic-tac-toe.vercel.app`
- F5 **功能不变硬约束**：
  - 本地 file: B1 全过
  - 远程 libsql:// B2 全过
  - B3 对照表两个 cell 都是"✅ 期望 == 实际"

## Verification strategy

| 类别 | 命令 / 动作 | 期望 | Wave |
| --- | --- | --- | --- |
| 类型 | `pnpm typecheck` | exit 0 | A4 |
| Lint | `pnpm lint` | exit 0 | A4 |
| 单元 | `pnpm vitest run` | 11 个 db test + 全套 80+ 测试全 PASS | A4 |
| 构建 | `pnpm build` | exit 0；`/api/stats` 标 nodejs | A4 |
| Commit 审计 | `node tests/qa/commit-audit.mjs` | 0 violations | A4, C7, D3 |
| **本地 file:** | `pnpm start` + 4 步 curl | 200/200/200/200；DB 文件创建 | **B1** |
| **远程 libsql://** | `curl https://3t-tic-tac-toe.vercel.app/api/stats` 4 步 | 200/200/200/200 | **B2/C3** |
| 部署 | `vercel --prod --yes` | "Production: https://3t-tic-tac-toe.vercel.app/" | C1 |
| Domain | `GET /v10/projects/{id}/domains` | 仅 `3t-tic-tac-toe.vercel.app` | C6 |
| Protection | `GET /v13/deployments/{id}` (旧) | protection 字段非空；expiration 30d | C6 |

## Commit strategy

按 AGENTS.md lore 协议。3 个 commit：

1. **`refactor(db): 去掉 createClientFn / __setCreateClientForTests 测试接缝，保留 selectDriver 深模块核心`**
   - 改 `lib/db.ts`、`tests/db/db.test.ts`
   - WHAT: 移除 module-level 可变 createClientFn 闭包与 `__setCreateClientForTests` 出口，测试改用 `vi.spyOn`
   - WHY: 接缝在 runtime 里付出可变全局状态代价，且让 selectDriver 路径在测试时不覆盖；`vi.spyOn` 等价替代并消除覆盖率盲区
   - HOW: `getDb` 内 inline `selectDriver(config.url).createClient(config)`；spy 拦截真实 `webClient.createClient` / `nativeClient.createClient`
   - Constraint: `getDb/loadStats/saveStats/resetStats/closeDb` 5 个 export 签名 0 改；`selectDriver` 函数签名 0 改
   - Rejected: 完全删 selectDriver 让 db.ts 更"直接" | selectDriver 是深模块核心契约，identity 测试还在用，删了破坏封装
   - Confidence: high
   - Scope-risk: narrow
   - Directive: 未来如需更复杂 client mock（不只是 createClient），考虑在测试侧用 `vi.mock` 整个 module，不要在生产侧重新引入接缝
   - Tested: pnpm typecheck/lint/vitest/build + commit-audit 全绿；B1 本地 file: 端到端；B2 远程 libsql:// 端到端
   - Not-tested: 极端 corner case（e.g. 并发请求首次访问同时触发 schema bootstrap）——已有 schema/bootstrap 测试覆盖
   - Plan: .omo/plans/runtime-cleanup-finalize.md

2. **`chore(route): runtime=nodejs 注释扩写（Next 16 Edge 弃用说明）`**
   - 改 `app/api/stats/route.ts`
   - WHAT: 把"Force this route to run on the Node.js runtime"三行注释扩写为详细解释 Edge 弃用 + Vercel Node 跑在 CDN 边缘节点
   - WHY: runtime 决策的历史与理由应留在代码注释里
   - HOW: 纯注释改动，无逻辑变化
   - Confidence: high
   - Scope-risk: narrow
   - Tested: pnpm typecheck/lint/vitest/build + commit-audit
   - Plan: .omo/plans/runtime-cleanup-finalize.md

3. **`chore(docs): 更新当前部署示例与 runtime 状态（3t 单入口 + 旧 deployment 30d protect）`**
   - 改 `docs/operations.md`、`.omo/plans/vercel-deploy-runbook.md`
   - WHAT: 当前部署示例表更新到 3t 单入口 / nodejs / 旧 deployment protect 30d
   - WHY: 生产 URL 从 `tic-tac-toe-onepisyas-projects.vercel.app` 切到 `3t-tic-tac-toe.vercel.app`；旧 deployment 30d 后过期
   - HOW: 替换表格行；加"用户访问入口"段；runbook 末尾加 final state 段
   - Confidence: high
   - Scope-risk: narrow
   - Plan: .omo/plans/runtime-cleanup-finalize.md

## Success criteria

整体交付（用户可观察）：

**功能不变（硬约束）：**
1. ✅ 本地 `pnpm start`（不设 env vars）启动后，`curl localhost:3000/api/stats` 4 步全 200；`data/tic-tac-toe.db` 文件被创建
2. ✅ 线上 `curl https://3t-tic-tac-toe.vercel.app/api/stats` 4 步全 200；Turso 远程 DB 写入成功

**代码简化：**
3. ✅ `lib/db.ts` 不再有 `createClientFn` 闭包 / `__setCreateClientForTests` 出口；`selectDriver` 函数保留
4. ✅ `tests/db/db.test.ts` 11 个测试全 PASS（3 selectDriver identity + 5 spyOn 改造 + 4 真实 file + 2 schema/bootstrap）

**Vercel 单入口：**
5. ✅ Vercel project domains 仅 `3t-tic-tac-toe.vercel.app`；`ulw-demo.vercel.app` 已删
6. ✅ 旧 deployment（`dpl_AToyuvD1HY7PakBw6KGKDNRMJ2v5`、`dpl_5F6CpuPqu8v7VFPc2KmmpGfzncTa`）已加 protect + 30d expiration
7. ✅ 用户唯一可访问 URL：`https://3t-tic-tac-toe.vercel.app/`

**文档与验证：**
8. ✅ `pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build && tests/qa/commit-audit.mjs` 全绿
9. ✅ `docs/operations.md` 当前部署示例表更新到 3t / nodejs / 旧 deployment protect 30d

## Risk register

| 风险 | 触发条件 | 缓解 |
| --- | --- | --- |
| `vi.resetModules()` + spy 时序错位 | spy 在 reset 前设置，挂在 stale module 引用 | 在 spy 设置**前**先 `vi.resetModules()`，再 `await import` 真实 module，最后 spy |
| `nativeClient.createClient` 在 spy 后 TypeScript 类型变 any | spy mockImplementation 返回 fakeClient() | 测试侧 `as unknown as Client` 强转，运行时正确 |
| 远程 4 步 curl 时 Turso HTTP 延迟 | 网络抖动 | 步骤加 `--retry 3 --retry-delay 2`；evidence 完整记录每次 attempt |
| Vercel project domain 删除失败 | `ulw-demo.vercel.app` 仍挂 alias | 先 `vercel alias rm` 再 DELETE domain |
| 旧 deployment protect API 不支持 | Hobby plan 限制 | 退化为 `vercel deployment protect` CLI（dash 仍可设 expiration） |
