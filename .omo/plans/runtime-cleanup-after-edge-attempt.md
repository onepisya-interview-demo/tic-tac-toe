# Runtime Cleanup — Edge Attempt → Node Runtime

## Context
- 2026-09-10 用户希望 `/api/stats` 上 Edge runtime
- 我尝试了 `runtime='edge'` + `lib/db.ts` lazy refactor（动态 import node:path / node:fs / @libsql/client）
- `pnpm build` 通过（warning 级），但 `vercel --prod` 被 Vercel 拒：
  > Edge Function "api/stats" is referencing unsupported modules: node:path, node:fs
- Next.js 16 自己也抛出弃用警告：
  > ⚠ The Edge Runtime is deprecated. You can use the "nodejs" runtime instead.
- `process.cwd()` 在 Edge runtime 不支持（resolveDbConfig 默认分支用到了）

## Decision
走 **A 路：Vercel Node.js runtime**（Vercel 现在的"标准边缘部署"，Node 进程跑在全球分布的边缘节点上，冷启动 < 1s）。

- `route.ts` runtime 保持 `nodejs`（Edge 尝试后已 revert）
- `lib/db.ts` 回到直接 import node:path / node:fs / @libsql/client — lazy refactor 没用了，且增加 async 开销
- `tests/db/db.test.ts` 回到 sync `__setCreateClientForTests` + identity-equal selectDriver 测试
- 旧的 `.omo/plans/edge-runtime-migration.md` 留作历史，不删（记录"试过但不取"）

## Steps
1. 验证 route.ts 是 `runtime='nodejs'`（已经是）
2. 还原 lib/db.ts：直接 import node:path / node:fs / @libsql/client
3. 还原 tests/db/db.test.ts：sync 回调 + identity selectDriver 断言
4. 跑 5 道关（typecheck / lint / vitest / build / commit-audit）
5. `vercel --prod --yes` 部署
6. 4 步 curl 验证新 URL
7. 把 `3t-tic-tac-toe.vercel.app` 重新挂到新 deployment（每次 redeploy 都要 reattach 一次；更新 runbook 记录这点）
8. 更新 README.md §Vercel 排错：明确"我们用 Vercel Node runtime，部署在 Vercel 全球边缘节点，跟 Edge runtime 的 UX 一样；Next.js 16 已弃用 Edge runtime"
9. 更新 docs/operations.md §部署 当前部署示例：补 runtime 字段
10. 给 .omo/plans/edge-runtime-migration.md 加一行 "决策：弃 Edge、走 Node"（保留历史）
11. commit + lore trailer + Plan footer 引用本文件

## Verify
- `pnpm typecheck` 0
- `pnpm lint` 0
- `pnpm vitest run` 88/88（恢复原始测试数）
- `pnpm build` ok（不再有 Edge runtime 警告）
- `node tests/qa/commit-audit.mjs` 65+/65+ PASS
- `vercel --prod --yes` exit 0，新 URL Ready
- `https://tic-tac-toe-onepisyas-projects.vercel.app/api/stats` 4 步 curl 全 200
- `https://3t-tic-tac-toe.vercel.app` HTTP 200 + 内容正确

## Risks
- 部署产生新 deployment（旧的 dpl_<deployment-id> 留在历史）；可逆
- alias reattachment 失败会导致 short URL 暂时死掉；可重试
- 还原代码后，selectDriver 文件分支 identity 测试要严格匹配 nativeClient.createClient（已验证可过）

## Out of scope
- Phase 2（GitHub push-to-deploy）— 仍待 GitHub repo
- bare `tic-tac-toe.vercel.app` — 仍被 Sanjay Puri 占着（goal blocked 项）
- Custom domain — 用户尚未决定

---

# Addendum — Make 3t-tic-tac-toe.vercel.app Project-Level Alias

## Context (this addendum)
- 2026-09-10 user: "以后默认 alias 项目级应该是 3t-tic-tac-toe.vercel.app"
- 意思：每次 `vercel --prod` 之后，3t-tic-tac-toe.vercel.app 应该自动指向新 deployment，不要手动 `vercel alias set`
- 当前状态：3t-tic-tac-toe.vercel.app 是 deployment-level alias（绑死在 dpl_<deployment-id>），下次部署会留在旧 deployment 上死掉

## Approaches tried
- `PATCH /v1/projects/{id}` with `productionAlias` / `productionAliases` / `alias` / `aliases` / `productionDeploymentAlias` / `canonicalAlias` → 全部 `bad_request: should NOT have additional property`
- Hobby plan 下项目级 production alias 由 `<projectName>-<teamSlug>.vercel.app` 自动决定，API 不允许 override

## Approach to try now
- Vercel 有 `project domains` 概念：自定义域（paid domain）和 vercel.app 子域都可以作为项目级 domain 添加
- 端点：`POST /v10/projects/{idOrName}/domains`，body: `{"name": "3t-tic-tac-toe.vercel.app"}`
- 添加成功后会成为项目级 domain，自动跟随 production deployment
- 风险：之前它已经是 deployment-level alias on this deployment，可能需要先 DELETE deployment-level alias 才能 add project-level

## Steps
1. 列出当前 project domains 看 3t-tic-tac-toe 是否已经在 list 里
2. 如果在：confirm auto-following；不在：POST 添加
3. 如果 POST 拒绝（"domain in use"）：先 DELETE 当前 deployment 上的 alias，再 POST
4. 验证：通过 `vercel alias ls` 看 source 是否从 "deployment URL" 变成 "PROJECT"
5. 测试自动跟随：做一次 no-op redeploy，看 3t-tic-tac-toe 是否自动迁移到新 deployment
6. 更新 docs/operations.md "current deployment example" 表 + runbook（把 "每次手动 reattach" 改为 "自动跟随"）
7. commit + lore trailer

## Fallback (如果 POST 失败)
- 报告失败原因
- 推荐方案：(a) 买 custom domain `3t-tic-tac-toe.com`（Vercel 自动 follow）；(b) 用 GitHub Actions 在 `vercel --prod` 后跑 `vercel alias set <new> 3t-tic-tac-toe.vercel.app`；(c) 接受手动 reattach，写进 runbook checklist
