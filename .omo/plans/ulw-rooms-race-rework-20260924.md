# ulw-rooms-race-rework-20260924 - Work Plan

## TL;DR (For humans)

**What you'll get:** 两处独立复核确认的防线漏洞修掉——反向对账测试不再被 docs/commands.md 的通配展开全员豁免，新增孤儿探针会立刻红；`lib/db.ts` 两个测试 seam（factory 与 delay）从隐式耦合变正交，并发竞态复现用的 delay 注入不会被任一 seam 静默清零。

**Why this approach:** d-F1 把 `docs/operations.md` 升为第三显式引用源并删通配展开——这是修复反向防线失效最直接的改动，零重构、零依赖；d-F2 用「移除隐式重置 + 在两 seam 各自的 JSDoc 明文契约」最小动作消除耦合，不动现有测试体（其调用顺序本就安全）。

**What it will NOT do:** 不动 docs/commands.md 通配行文本、不修任何探针代码（含 fix 后新暴露的 7 个真悬空——只入白名单 + TODO，不 triage）、不动 lib/db.ts 其他 seam、不动 .github/workflows/ci.yml、不引入新依赖、不 push、不合并不 PR。

**Effort:** Short
**Risk:** Low — 改动限于 4 个文件共 ~30 行；现有 tests/db/db.test.ts:1314-1349 两 delay 测试按「factory → delay → finally(双 reset)」安全顺序，seam 正交后仍绿；fix 后 probe-reconciliation 的 KNOWN_ORPHANS 由 10 扩 13，cited 由 5 扩 9，对账总数 24 自洽。

**Decisions to sanity-check:** 5 个 announced default（worktree 位置 / commit 粒度 / KNOWN_ORPHANS 扩法 / 不动 commands.md 通配行 / d-F2 JSDoc 措辞）——详见 `.omo/drafts/ulw-rooms-race-rework-20260924.md` §Open assumptions，可一票否决。

Your next move: 批准即可启动执行席（`$start-work ulw-rooms-race-rework-20260924 --worktree /private/tmp/ttt-wt-20260924/rooms-rework`）。

---

> TL;DR (machine): Short · Low · 5 todos · 2 atomic commits · 2 file groups (probe-reconciliation + lib/db) · :no-qa-needed（fix 后单测即证明；全库门禁由主控复跑）

## Scope

### Must have
- `tests/qa/probe-reconciliation.test.ts`：
  - line 65-76 删除 `parseReferencesFromCommandsMd` 的通配展开分支（line 70-74 readdirSync 块）
  - 顶部常量区新增 `OPERATIONS_MD` 常量 + `parseReferencesFromOperationsMd(src: string): string[]` 函数（同形正则 `/tests\/qa\/([a-z0-9-]+\.mjs)/g`，不解析 YAML、不展开通配）
  - reverse it（line 95-114）cited 集合由 `[...ciProbes, ...cmdProbes]` 改为 `[...ciProbes, ...cmdProbes, ...opsProbes]`；错误消息更新为「既未被 ci.yml/docs/commands.md/docs/operations.md 引用，也无 DISABLED 标记，且不在 KNOWN_ORPHANS 白名单」
  - KNOWN_ORPHANS 由 10 条变 13 条：迁出 4 条 ops-cited（audio-cheer/audio-confetti-qa/audio-probe/hydration-check），新增 7 条真悬空（confetti-origin-qa / home-return-qa / offline-mode-qa / offline-qa / online-direct-qa / pwa-sw-cache-qa / room-reset-qa），每条新项按现有 TODO 范式注 `// TODO: triage in T-B1-followup-1 — 5 条可能真悬空；或迁 docs/operations.md`
- `lib/db.ts`：
  - line 124-127 `__setCreateClientForTests` 函数体移除 `dbOpDelayMs = 0;`（line 126）；JSDoc（line 112-123）改写为「仅重置 createClientFn 至 defaultCreateClient，不影响 dbOpDelayMs；如需同时清零 delay，请显式调用 `__setDbOpDelayForTests(null)`」
  - line 129-131 `__setDbOpDelayForTests` JSDoc 改写为「仅重置 dbOpDelayMs 至 0/null，不影响 createClientFn」（函数体不动）
- `tests/db/db.test.ts`：
  - 文件头部 JSDoc 注释加一行 `// d-F2 fix (2026-09-24): 两 seam 正交；factory 调换不影响 delay 状态，delay 调换不影响 factory 状态`
  - 测试体不动（line 1314-1349 两 delay 测试调用顺序本就安全）
- `.omo/evidence/ulw-rooms-race-rework-20260924/{report.md,df1-red-green.md,df2-red-green.md,commit-list.txt}`（gitignored 落档点）
- `.omo/plans/ulw-rooms-race-rework-20260924.md`（即本文件）
- 2 次原子 commit（commit-audit R7 + commit-msg hook 必绿）：
  - C1: `test(qa): probe-reconciliation 反向断言切四源 — 去通配展开 + 加 docs/operations.md 显式引用 + 扩 KNOWN_ORPHANS 13 条`
  - C2: `fix(db): __setCreateClientForTests 与 __setDbOpDelayForTests 两 seam 正交 — 明文契约不再隐式重置 dbOpDelayMs`

### Must NOT have (guardrails, anti-slop, scope boundaries)
- ❌ 不删 `docs/commands.md:43` 通配行（人类读的文档，测试侧停止展开即可）
- ❌ 不重构 `tests/qa/probe-reconciliation.test.ts` 任何其他部分（注入对照 it / 正向 it / 头注释 / imports）
- ❌ 不修 `tests/qa/*.mjs` 任何探针代码（fix 后新暴露的 7 条真悬空只入白名单 + TODO，不 triage 不删不改）
- ❌ 不动 `KNOWN_ORPHANS` 现有 10 条的语义（只迁出 + 扩 TODO，不删任何条目）
- ❌ 不动 `lib/db.ts` 其他 seam（`getDb` / `closeDb` / `resolveDbConfig` / `selectDriver` / `dbOpDelayMs` 注入点 line 194 等）
- ❌ 不动 `tests/db/db.test.ts` 测试体（仅文件头加一行 JSDoc）
- ❌ 不改 `.github/workflows/ci.yml` / `docs/commands.md` / `docs/operations.md` / `docs/commit-policy.md` / `tests/qa/commit-audit.mjs`
- ❌ 不改 `package.json` / `pnpm-lock.yaml` / `knip.json` / `.gitignore` / `next-env.d.ts`
- ❌ 不引入新依赖
- ❌ 不 push / 不合并不 PR / 不调 `gh api` / 不动 remote
- ❌ 不 `--no-verify` 绕过 commit-msg hook
- ❌ 不新增 vitest 用例覆盖 d-F2（line 1314-1349 自然证明 seam 正交性）
- ❌ 不重写 `KNOWN_ORPHANS` JSDoc 整体（仅在 TODO 行追加「新增 7 条迁自通配兜底展开」一行）
- ❌ 不在 plan 文件里写 lore trailer（trailer 只在 commit message 里出现）

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after（d-F1 是测试自身的修复，无需新增用例；d-F2 由现有 tests/db/db.test.ts:1314-1349 自然证明）
- 验证六层（本批只触及测试 seam 与测试自身代码，故主跑 vitest + commit-audit；其他四层 typecheck/lint/build/浏览器探针由主控复跑以确认零回归）：
  1. `pnpm vitest run tests/qa/probe-reconciliation.test.ts tests/db/db.test.ts` — 本批直接覆盖的两个文件 + 其依赖文件
  2. `pnpm typecheck`（`tsc --noEmit`）
  3. `pnpm lint`（`eslint`，含 tests/qa/** 因 globalIgnores 跳）
  4. `pnpm build`（`next build`）
  5. `node tests/qa/commit-audit.mjs --message-file <commit-msg>`（每次 commit 自跑）+ `node tests/qa/commit-audit.mjs --branch <branch>`（branch 全史审计，验 R7 + R3-R6 + Confidence + Scope-risk）
  6. 浏览器探针：本次不触及界面，worker 仅跑 `node tests/qa/commit-audit.mjs --branch <branch>`（commit 消息契约最严的一种覆盖）即可；不跑 visual-qa / rooms-race-qa
- Evidence 落点：`.omo/evidence/ulw-rooms-race-rework-20260924/`
  - `df1-red-green.md`：d-F1 三件套注入对照（ghost probe + KNOWN_ORPHANS 移除 + ops 引用生效）前后对比
  - `df2-red-green.md`：d-F2 旁路清除注入对照（factory → delay → factory(null)）前后对比
  - `commit-list.txt`：2 个 commit 的 SHA + subject + 完整 message
  - `report.md`：终报（AC 逐条 self-check、门禁自跑结果、commit 列表、偏离任务书之处）
- 红灯三件套（d-F1 注入对照）：
  - R1: `cp .github/workflows/ci.yml /tmp/ci.bak.yml && printf '\n        run: pnpm exec node tests/qa/ghost-probe.mjs\n' >> .github/workflows/ci.yml && pnpm vitest run tests/qa/probe-reconciliation.test.ts 2>&1 | tee /tmp/df1-r1.log; git checkout .github/workflows/ci.yml`
  - R2: `cp tests/qa/probe-reconciliation.test.ts /tmp/recon.bak.ts && node -e 'const fs=require("fs");let s=fs.readFileSync("tests/qa/probe-reconciliation.test.ts","utf8");s=s.replace(/\"sw-console-hygiene\.mjs\",\n/,"");fs.writeFileSync("tests/qa/probe-reconciliation.test.ts",s);' && pnpm vitest run tests/qa/probe-reconciliation.test.ts 2>&1 | tee /tmp/df1-r2.log; cp /tmp/recon.bak.ts tests/qa/probe-reconciliation.test.ts`
  - R3: `echo 'node tests/qa/foo-probe.mjs # 新探针测试' >> docs/operations.md && pnpm vitest run tests/qa/probe-reconciliation.test.ts 2>&1 | tee /tmp/df1-r3.log; git checkout docs/operations.md`（验证 ops 引用源解析生效——foo-probe 不存在会被正向断言捕获，但反向断言应展示 ops 解析通路工作）
- 红灯两件套（d-F2 注入对照）：
  - R4: `cat > /tmp/df2-mut.mjs << 'EOF'\nimport { __setCreateClientForTests, __setDbOpDelayForTests, getDb } from '@/lib/db';\nconst fakeClient = () => ({ execute: async () => ({ rows: [] }), batch: async () => ({ rows: [] }) });\n__setCreateClientForTests(fakeClient);\n__setDbOpDelayForTests(50);\nawait getDb(); // first call: 50ms delay applies\nconst t = Date.now();\n__setCreateClientForTests(fakeClient); // re-set factory — should NOT reset delay\nawait getDb();\nconsole.log('elapsed after factory re-set:', Date.now() - t, 'ms');\n__setCreateClientForTests(null);\n__setDbOpDelayForTests(null);\nEOF\npnpm exec tsx /tmp/df2-mut.mjs 2>&1 | tee /tmp/df2-r4.log`
  - 期望：fix 前 elapsed ≈ 0（旁路清零），fix 后 elapsed ≥ 40（delay 仍注入）

## Execution strategy

### Parallel execution waves
- Wave 1 (1 todo)：T1 d-F1 修复（tests/qa/probe-reconciliation.test.ts 单文件改）
- Wave 2 (1 todo)：T2 d-F1 KNOWN_ORPHANS 扩展（同一文件下半部分改）
- Wave 3 (1 todo)：T3 d-F2 lib/db.ts 修复（单文件改）
- Wave 4 (1 todo)：T4 d-F2 tests/db/db.test.ts JSDoc 加注（单文件改）
- Wave 5 (1 todo)：T5 终报 + commit 自审 + commit-audit branch 跑
- Wave 6 (parallel)：F1-F4 final verify

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 d-F1 删通配展开 + 加 ops 解析 | — | T2 | — |
| T2 d-F1 扩 KNOWN_ORPHANS 13 条 | T1（同一文件） | F1-F4 | — |
| T3 d-F2 lib/db.ts 两 seam 正交 | — | T4, T5 | T1, T2 |
| T4 d-F2 tests/db/db.test.ts JSDoc 加注 | T3（关联文件） | T5 | — |
| T5 终报 + commit 自审 | T1, T2, T3, T4 | F1-F4 | — |
| F1-F4 final verify | T5 | — | 平行 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. tests/qa/probe-reconciliation.test.ts: 删通配展开分支（line 70-74 readdirSync 块）+ 新增 `OPERATIONS_MD` 常量与 `parseReferencesFromOperationsMd(src: string): string[]` 函数（同形正则 `tests/qa/([a-z0-9-]+\.mjs)` 不展开通配）；reverse it cited 集合由 `[...ciProbes, ...cmdProbes]` 改为 `[...ciProbes, ...cmdProbes, ...opsProbes]`，错误消息更新含三源
  What to do / Must NOT do: 不删 `docs/commands.md:43` 通配文本本身；不动注入对照 it（line 116-140）；不动正向 it（line 89-94）；不动 imports（line 16-19）；新增 ops 函数体与 `parseReferencesFromCommandsMd`（line 65-76 改后）等形 — 不需要读 YAML、不需要展开通配、不需要 require node:fs
  Parallelization: Wave 1 | Blocked by: — | Blocks: T2
  References (executor has NO interview context - be exhaustive):
    - tests/qa/probe-reconciliation.test.ts:65-76（当前 parseReferencesFromCommandsMd 函数体）
    - tests/qa/probe-reconciliation.test.ts:95-114（reverse it，cited 集合与错误消息）
    - tests/qa/probe-reconciliation.test.ts:19（COMMANDS_MD 常量行）
    - docs/operations.md:42-48（7 个 ops 引用源确认；rg `tests/qa/[a-z0-9-]+\.mjs` 实测 7 条）
    - .github/workflows/ci.yml:117, 171（ci.yml 引用 — 仅 visual-qa 与 rooms-race-qa）
    - docs/commands.md:14, 29, 42（commands.md 显式引用 — commit-audit / one-identity-qa / visual-qa；line 43 通配不展开）
    - .omo/drafts/ulw-rooms-race-rework-20260924.md:35-52（d-F1 finding 与 evidence 复述）
  Acceptance criteria (agent-executable):
    - `pnpm vitest run tests/qa/probe-reconciliation.test.ts` exit 0
    - `rg -n 'readdirSync.*TESTS_QA' tests/qa/probe-reconciliation.test.ts` 仅命中 `KNOWN_ORPHANS` 那一处；`parseReferencesFromCommandsMd` 函数体内无 readdirSync
    - `rg -n 'OPERATIONS_MD' tests/qa/probe-reconciliation.test.ts` ≥ 1 命中（新常量声明）
    - reverse it 中 `cited = new Set\(\[\.\.\.ciProbes, \.\.\.cmdProbes, \.\.\.opsProbes\]\)` 模式
  QA scenarios (name the exact tool + invocation):
    - happy — `pnpm vitest run tests/qa/probe-reconciliation.test.ts` → 3/3 PASS
    - failure — 临时向 ci.yml 注入 ghost-probe.mjs → 反向断言应 FAIL（修复前 PASS，因通配兜底；修复后 FAIL）
    - Evidence: `.omo/evidence/ulw-rooms-race-rework-20260924/df1-red-green.md` §R1
  Commit: Y | `test(qa): probe-reconciliation 反向断言切四源 — 去通配展开 + 加 docs/operations.md 显式引用`

- [ ] 2. tests/qa/probe-reconciliation.test.ts: KNOWN_ORPHANS 由 10 条变 13 条 — 迁出 4 条 ops-cited（audio-cheer/audio-confetti-qa/audio-probe/hydration-check），新增 7 条真悬空（confetti-origin-qa / home-return-qa / offline-mode-qa / offline-qa / online-direct-qa / pwa-sw-cache-qa / room-reset-qa），每条新项按现有 TODO 范式注 `// TODO: triage in T-B1-followup-1 — 5 条可能真悬空；或迁 docs/operations.md`；JSDoc（line 31-32）加一行「新增 7 条迁自通配兜底展开（2026-09-24 d-F1 fix）」；C1 commit message 写明 WHAT/WHY/HOW + 全套 trailer + Plan footer
  What to do / Must NOT do: 不删现有 10 条中的任何一条；只迁出（4 条 ops-cited 删）+ 扩 TODO（7 条新 + 注释）；不动 reverse it 与 T1 改的函数体；不动 KNOWN_ORPHANS 既有 TODO 注释（line 45-46）
  Parallelization: Wave 2 | Blocked by: T1 | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive):
    - tests/qa/probe-reconciliation.test.ts:31-46（KNOWN_ORPHANS 当前内容）
    - ls tests/qa/*.mjs 实测 24 条 → 已分组（cited 9 / disabled 2 / KNOWN_ORPHANS 13）
    - docs/operations.md:42-48（4 条 ops-cited 出处）
    - .git/log:graph -1 test(qa) probe-reconciliation 用例 commit f327646（f3276465d0f4409a391553c2396edc8009be3910）
    - docs/commit-policy.md §中文 commit-audit 机械规则 R7（subject 描述必含 ≥1 CJK）
    - .omo/drafts/ulw-rooms-race-rework-20260924.md:53-68（D9 D10 决议）
  Acceptance criteria (agent-executable):
    - `pnpm vitest run tests/qa/probe-reconciliation.test.ts` exit 0
    - `rg -c '^\s+"[a-z0-9-]+\.mjs",$' tests/qa/probe-reconciliation.test.ts` = 13（已知 KNOWN_ORPHANS 大小）
    - `git diff --stat tests/qa/probe-reconciliation.test.ts` 显示 -4 +7 行（迁出 4 + 扩 7）
    - commit message R7 通过：`node tests/qa/commit-audit.mjs --message-file <commit-msg>` exit 0
  QA scenarios (name the exact tool + invocation):
    - happy — `pnpm vitest run tests/qa/probe-reconciliation.test.ts` → 3/3 PASS
    - failure — 临时把任意 KNOWN_ORPHANS 条目移出 + 该文件无三源引用 → 反向断言应 FAIL
    - Evidence: `.omo/evidence/ulw-rooms-race-rework-20260924/df1-red-green.md` §R2
  Commit: Y | （与 T1 同一 commit；此 todo 是 T1 commit 的下半部分，commit message 包含两部分）

- [ ] 3. lib/db.ts: 移除 `__setCreateClientForTests` 函数体 line 126 的 `dbOpDelayMs = 0;`；JSDoc（line 112-123）改写为「仅重置 createClientFn 至 defaultCreateClient，不影响 dbOpDelayMs；如需同时清零 delay，请显式调用 `__setDbOpDelayForTests(null)`」；JSDoc（line 129-131）`__setDbOpDelayForTests` 改写为「仅重置 dbOpDelayMs 至 0/null，不影响 createClientFn」（函数体不动）
  What to do / Must NOT do: 不改 `__setDbOpDelayForTests` 函数体（line 130 `dbOpDelayMs = ms ?? 0` 不动）；不改 `getDb` / `closeDb` / `resolveDbConfig` / `selectDriver`；不改 dbOpDelayMs 注入点（line 194 附近）；不改 schema；C2 commit message 写明 WHAT/WHY/HOW + 全套 trailer + Plan footer
  Parallelization: Wave 3 | Blocked by: — | Blocks: T4
  References (executor has NO interview context - be exhaustive):
    - lib/db.ts:112-127（__setCreateClientForTests JSDoc + 函数体）
    - lib/db.ts:129-131（__setDbOpDelayForTests JSDoc + 函数体）
    - lib/db.ts:139（`let dbOpDelayMs = 0` 模块级变量声明）
    - lib/db.ts:194-196（getDb 中 dbOpDelayMs 消费点）
    - tests/db/db.test.ts:1314-1349（两 delay 测试 — 调用顺序安全；line 1327-1328 / 1345-1346 双 reset 保留）
    - tests/db/db.test.ts:1303-1313（line 1303-1313 是 setup，line 1314-1349 是两 it；不修改）
    - .omo/drafts/ulw-rooms-race-rework-20260924.md:35-52（d-F2 finding 与 evidence 复述）
  Acceptance criteria (agent-executable):
    - `pnpm vitest run tests/db/db.test.ts` exit 0（含 line 1314-1349 两 delay 测试）
    - `pnpm typecheck` exit 0（lib/db.ts 类型签名未变）
    - `rg -n 'dbOpDelayMs = 0' lib/db.ts` 仅命中 line 139 的 `let dbOpDelayMs = 0` 一处；`__setCreateClientForTests` 函数体内无 `dbOpDelayMs = 0`
    - JSDoc 中含「不影响 dbOpDelayMs」字样
  QA scenarios (name the exact tool + invocation):
    - happy — `pnpm vitest run tests/db/db.test.ts` → exit 0
    - failure — 在 fake-client 复现脚本中先 factory→delay→factory(null) → 修复前 elapsed ≈ 0ms（旁路清零），修复后 elapsed ≥ 40ms（delay 仍注入）
    - Evidence: `.omo/evidence/ulw-rooms-race-rework-20260924/df2-red-green.md` §R4
  Commit: Y | `fix(db): __setCreateClientForTests 与 __setDbOpDelayForTests 两 seam 正交 — 明文契约不再隐式重置 dbOpDelayMs`

- [ ] 4. tests/db/db.test.ts: 文件头部 JSDoc 注释加一行 `// d-F2 fix (2026-09-24): 两 seam 正交；factory 调换不影响 delay 状态，delay 调换不影响 factory 状态`（插入位置：现存头注释最后一行之后、所有 import 之前）
  What to do / Must NOT do: 不动测试体（line 1303-1349 任何一行）；不动 setup / teardown / import；不动 describe / it 块；不引入新测试
  Parallelization: Wave 4 | Blocked by: T3（语义关联） | Blocks: T5
  References (executor has NO interview context - be exhaustive):
    - tests/db/db.test.ts:1-30（文件头部 JSDoc 当前内容）
    - lib/db.ts:112-131（两 seam JSDoc 改后契约真源）
    - .omo/drafts/ulw-rooms-race-rework-20260924.md:53-68（D7 决议）
  Acceptance criteria (agent-executable):
    - `pnpm vitest run tests/db/db.test.ts` exit 0
    - `rg -n 'd-F2 fix' tests/db/db.test.ts` 命中 1 次
    - `git diff tests/db/db.test.ts` 显示 +1 -0（仅文件头加注）
  QA scenarios (name the exact tool + invocation):
    - happy — `pnpm vitest run tests/db/db.test.ts` → exit 0
    - failure — （此 todo 无独立 RED 场景；与 T3 同 commit）
    - Evidence: 终报 commit-list.txt 含 C2 SHA
  Commit: Y | （与 T3 同一 commit）

- [ ] 5. .omo/evidence/ulw-rooms-race-rework-20260924/{report.md, df1-red-green.md, df2-red-green.md, commit-list.txt}: 落档终报与对比证据；跑 `node tests/qa/commit-audit.mjs --branch <branch>` 验 C1+C2 双 commit R7 + Confidence + Scope-risk + Plan footer；跑 `pnpm typecheck && pnpm lint && pnpm build` 三层门禁自检；交付到 worktree 分支末端
  What to do / Must NOT do: 不 push；不合并不 PR；不调 gh api；不动 remote；evidence 目录已 gitignored，不入 commit
  Parallelization: Wave 5 | Blocked by: T1, T2, T3, T4 | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive):
    - .omo/drafts/ulw-rooms-race-rework-20260924.md（决策全表 + evidence 路径）
    - docs/commands.md（验证六层命令）
    - docs/commit-policy.md（commit-audit R7 + trailer + Plan footer）
    - .omo/plans/ulw-rooms-race-rework-20260924.md（即本文件）
  Acceptance criteria (agent-executable):
    - `.omo/evidence/ulw-rooms-race-rework-20260924/report.md` 存在且 ≥ 30 行（AC 逐条 self-check + commit 列表 + 偏离任务书之处）
    - `node tests/qa/commit-audit.mjs --branch <branch>` exit 0
    - `pnpm typecheck` exit 0
    - `pnpm lint` exit 0
    - `pnpm build` exit 0
    - `git status -s` 仅显示分支领先（无未提交改动；evidence 已 gitignored 不应出现）
  QA scenarios (name the exact tool + invocation):
    - happy — 五条 acceptance 命令全 exit 0
    - failure — （无 RED 场景；本 todo 是整合验证）
    - Evidence: `.omo/evidence/ulw-rooms-race-rework-20260924/report.md`
  Commit: N（不新增 commit；本 todo 是终报落档 + commit 自审）

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit — `git diff main` 仅含 `tests/qa/probe-reconciliation.test.ts`（含 KNOWN_ORPHANS 扩 13）、`lib/db.ts`（两 seam JSDoc + factory 函数体移除一行）、`tests/db/db.test.ts`（+1 JSDoc 行）、`.omo/plans/ulw-rooms-race-rework-20260924.md`；C1+C2 双 commit 带 Plan footer + 全套 trailer + 中文 subject；无 `docs/commands.md` / `docs/operations.md` / `.github/workflows/ci.yml` / `package.json` / `pnpm-lock.yaml` / `knip.json` / `.gitignore` / `next-env.d.ts` 改动
- [ ] F2. Code quality review — `tests/qa/probe-reconciliation.test.ts` diff：函数体改动 ≤ 5 行（删 readdirSync 块 + 加 OPERATIONS_MD 常量 + 加 parseReferencesFromOperationsMd 函数 ≤ 25 行 + reverse it cited 集合 + 错误消息改写 ≤ 3 行）；`lib/db.ts` diff：两 seam JSDoc 改写 ≤ 20 行（line 112-123 + 129-131）+ 函数体删 1 行；`tests/db/db.test.ts` diff：+1 JSDoc 行；总 LOC 改动 ≤ 60；eslint 跳过 tests/qa/** 与 tests/db/** 因 globalIgnores；TS 类型签名零变化
- [ ] F3. Real manual QA — `pnpm vitest run tests/qa/probe-reconciliation.test.ts tests/db/db.test.ts` exit 0；`pnpm typecheck` exit 0；`pnpm lint` exit 0；`pnpm build` exit 0；`node tests/qa/commit-audit.mjs --branch <branch>` exit 0；d-F1 红灯三件套 R1/R2/R3 全按预期（fix 前 PASS → fix 后 FAIL；fix 后 ops 引用源解析生效）；d-F2 红灯 R4 旁路清除 fix 前 ≈ 0ms → fix 后 ≥ 40ms
- [ ] F4. Scope fidelity — 不动 docs/commands.md 通配行（`git diff docs/commands.md` 空）；不修任何探针代码（`git diff tests/qa/*.mjs` 仅含 probe-reconciliation.test.ts，不含其他 .mjs）；KNOWN_ORPHANS 总数 = 13（`rg -c '^\s+"[a-z0-9-]+\.mjs",$' tests/qa/probe-reconciliation.test.ts` = 13）；不引入新依赖（`git diff package.json pnpm-lock.yaml` 空）；不 push 不合并不 PR（`git log --oneline origin/dev..HEAD` 有 2 commit 但无 `git push` 调用）

## Commit strategy
- 原子提交：2 个 commit（C1 = T1+T2 同一 commit；C2 = T3+T4 同一 commit）
- commit 顺序：先 C1 后 C2（C1 与 C2 互不阻塞；按 d-F1 → d-F2 语义顺序排列）
- subject 必须 = `<type>(<scope>): <中文描述>`（type ∈ test/fix；scope = qa/db）
- 正文 = WHAT / WHY / HOW 三段中文（每行 ≤72 字符）
- trailer 至少含：Constraint: / Rejected: / Confidence: <low|medium|high> / Scope-risk: <narrow|moderate|broad> / Directive: / Tested:（每行 ≤100 字符，且自由文本值含 ≥1 CJK 字符）
- Plan 页脚：`Plan: .omo/plans/ulw-rooms-race-rework-20260924.md`
- 禁 `--no-verify`（commit-msg hook 强制）
- 不 push；本票以分支末端交付
- C1 subject: `test(qa): probe-reconciliation 反向断言切四源 — 去通配展开 + 加 docs/operations.md 显式引用 + 扩 KNOWN_ORPHANS 13 条`
- C2 subject: `fix(db): __setCreateClientForTests 与 __setDbOpDelayForTests 两 seam 正交 — 明文契约不再隐式重置 dbOpDelayMs`

## Success criteria
- AC-1 | `pnpm vitest run tests/qa/probe-reconciliation.test.ts tests/db/db.test.ts` exit 0 | 证据：`.omo/evidence/ulw-rooms-race-rework-20260924/report.md §AC1`
- AC-2 | d-F1 红灯 R1（ghost probe 注入）：fix 前 PASS → fix 后反向断言 FAIL | 证据：`.omo/evidence/ulw-rooms-race-rework-20260924/df1-red-green.md §R1`
- AC-3 | d-F1 红灯 R2（KNOWN_ORPHANS 移除 + 无引用）：fix 前 PASS → fix 后反向断言 FAIL | 证据：同上 §R2
- AC-4 | d-F1 ops 引用源解析生效（向 docs/operations.md 加 `tests/qa/foo-probe.mjs`，foo-probe 不存在 → 正向断言捕获，但反向断言展示 ops 解析通路工作：opsProbes 含 foo-probe）| 证据：同上 §R3
- AC-5 | d-F2 红灯 R4（factory → delay → factory(null) 旁路）：fix 前 elapsed ≈ 0ms → fix 后 elapsed ≥ 40ms | 证据：`.omo/evidence/ulw-rooms-race-rework-20260924/df2-red-green.md §R4`
- AC-6 | `pnpm typecheck && pnpm lint && pnpm build` 三层 exit 0 | 证据：`.omo/evidence/ulw-rooms-race-rework-20260924/report.md §AC6`
- AC-7 | `node tests/qa/commit-audit.mjs --branch <branch>` exit 0（R7 + R3-R6 + Confidence + Scope-risk + Plan footer 全过）| 证据：同上 §AC7
- AC-8 | `git diff --name-only main..HEAD` 仅含 tests/qa/probe-reconciliation.test.ts、lib/db.ts、tests/db/db.test.ts、.omo/plans/ulw-rooms-race-rework-20260924.md（共 4 个被跟踪文件）+ gitignored evidence | 证据：同上 §AC8
- AC-9 | KNOWN_ORPHANS 总数 = 13 | 证据：同上 §AC9
- AC-10 | 不 push 不合并不 PR：工作树 `git log --oneline origin/dev..HEAD` 含 2 commit，`git push` 调用次数 = 0 | 证据：同上 §AC10
