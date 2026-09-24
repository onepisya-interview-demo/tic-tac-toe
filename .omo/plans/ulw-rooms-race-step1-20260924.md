# ulw-rooms-race-step1-20260924 - Work Plan

## TL;DR (For humans)

<!-- Auto-generated; below summarizes the real plan. -->

**What you'll get:** 在 `tests/qa/rooms-race-qa.mjs` 加入第八步探针 step 1（双设备同房间名并发记局），把 71ad38d 的 `withWriteLock + db.transaction()` 修复形态从代码注释钉到可执行契约断言；产物是「服务端权威累计值严格等于两设备各局数之和」这条不变式，从此 CI `rooms-race` job 的 8 步全绿才有 BR-6 真覆盖。

**Why this approach:** 复用 `launchQA` + 单 chromium + `browser.newContext()` 拉第二个 context + `Promise.all([runSide(ctx1, A), runSide(ctx2, B)])` 外层并内侧串行 await——既贴合"两设备同时独立玩"的语义（同设备不可能并发），又让两个设备的 POST outcome 在 Node 事件循环里真正交错，撞中 `withWriteLock` 的序列化队列。直接走 `postOutcome` API 不驱动 UI，避免渲染时延污染 race 测时，与既有 step 2/4/7 的形态一致。

**What it will NOT do:** 不动任何产品代码（修复已合入）；不改 step 2-7 任何一行字面（一字都算越界）；不动 `tests/qa/AGENTS.md` 探针地图表、`docs/business-rules.md` BR-6 行（pre-existing dangle 不在本票责任）、任何其他 `tests/qa/*.mjs` 探针、`tests/qa/lib/**`、`tests/qa/commit-audit.mjs`、`probe-reconciliation.test.ts`、`.github/workflows/ci.yml`、`.gitignore`、package.json 等；不 push / 不发 gh api / 不创建 PR / 不 `--no-verify`；不用 retry-to-pass / sleep hack / 阈值放宽制造假绿。

**Effort:** Quick — 单文件 ~70 行插入，已有 helper 全复用，CI job 已在。
**Risk:** Low — 单文件改动 + 既有 mode 复用 + 修复已合 + CI job 已在；唯一新增风险是写入 commit 触发的 commit-msg hook（用 lore trailer 闭合）。
**Decisions to sanity-check:** 默认 D2「两侧各 2 局，side A=`['X','X']`，side B=`['O','draw']`，共 4 局」——同时钉死 recordOutcome 的 X / O / draw 三通道累加分枝；同时默认 D3「外层 Promise.all + 每侧内部串行 await」。如要调局数或驱动 UI，请在 `$start-work` 启动时一并指明。

Your next move: `$start-work ulw-rooms-race-step1-20260924 --worktree /private/tmp/ttt-wt-20260924/step1`（执行席 = fresh codex，本会话不执行）。

---

> TL;DR (machine): Quick · 1 implementation todo + 4 final verifiers · :3101 hermetic + vitest + typecheck + lint + build + commit-msg · diff 仅在 tests/qa/rooms-race-qa.mjs + .omo/plans/ulw-rooms-race-step1-20260924.md


## Scope
### Must have
- `tests/qa/rooms-race-qa.mjs` 头部变更：
  - 第 1-3 行 `// BR: BR-7, BR-10` → `// BR: BR-6, BR-7, BR-10`（升序；commit-audit R6 校验用的 BR 文本出现在被引用文件首 20 行）
  - scenario 列表加 `step 1 (S2) 双设备同房间名并发 outcomes 精确累加契约` 行
  - 删原 `step 1 (T-B2 双设备并发 outcomes) 不在本票范围` 反指
  - 删原 `探针禁 claim BR-6（step 1 范围外；防 commit-audit R6 误判）` 反指
- `tests/qa/rooms-race-qa.mjs` 函数体新增：在现有 step 2 之前插入 `await step("step 1 (S2) ...", async () => { ... })` 段，约 60-70 行（launchQA + `browser.newContext()` 拉 ctx2 + `Promise.all([postRoom(ctx1), postRoom(ctx2)])` + `Promise.all([runSide(ctx1, ['X','X']), runSide(ctx2, ['O','draw'])])` + 服务端权威 GET 断言 四字段精确 + 不变式 `xWins+oWins+draws === totalGames`）；finally 关闭 ctx2 + browser
- step 2-7 函数体一字面不变（T2 强制；本文件 `git diff cddf174..HEAD` 在 step 2-7 段零 ± 行）
- `node tests/qa/rooms-race-qa.mjs`（:3101 hermetic）退出码 0；stdout 含 `STEP: step 1 (S2) 双设备同房间名并发 outcomes 精确累加契约 ... PASS` + 终 `=== QA SUMMARY: 8 PASS / 0 FAIL / 8 total ===`
- `.omo/plans/ulw-rooms-race-step1-20260924.md`（决议 + 任务 + 验收谱，本文件自身；不入 git 跟踪）
- `.omo/evidence/rooms-race-step1-ticket/`（每 AC 一 log + `qa-log.json` + 终报 `report.md`）
- 一次原子 commit：`feat(qa): rooms-race-qa step 1 — S2 双设备同房间并发 outcomes 精确累加契约`（含 WHAT/WHY/HOW + lore trailer + Plan footer）

### Must NOT have (guardrails, anti-slop, scope boundaries)
- ❌ 任何 `lib/`、`app/`、`components/`、`db/`、`tests/db/` 改动
- ❌ 任何 `tests/qa/` 下其他文件改动（含 `tests/qa/AGENTS.md` 探针地图表、`tests/qa/lib/*`、`tests/qa/commit-audit.mjs`、`tests/qa/commit-audit.test.ts`、`tests/qa/probe-reconciliation.test.ts`、其他 `tests/qa/*.mjs` 探针）
- ❌ 任何 `docs/**` 改动（含 `docs/business-rules.md` BR-6 行 pre-existing dangle；本票不新增也不移除）
- ❌ 任何 `.github/**`、`package.json`、`.gitignore`、`next-env.d.ts`、`eslint.config.mjs`、`vitest.config.ts` 等配置改动
- ❌ 改 step 2-7 任一行字面（一字 = 退化为 refactor 而非 contract assertion）
- ❌ 引入新依赖（无 yaml 库 / 无 test helpers）
- ❌ push / gh api / 创建 PR / 任何外发动作
- ❌ `--no-verify` 绕过 commit-msg hook
- ❌ 改造吸收或复活 `concurrent-surface-qa.mjs`（已在 T-B1 删除入档；本票不再处理）
- ❌ SINGLE_SIDE env 或 runSide 的额外分支
- ❌ retry-to-pass / 阈值放宽 / sleep hack / mock 替身 / `assert.equal(sideAOutcomes.length + sideBOutcomes.length, 999)` 类退化断言

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + 探针自带契约断言（agent 自跑 vitest + :3101 探针）
- 验证六层（每 commit 必跑）：
  1. `pnpm vitest run`（含 probe-reconciliation.test.ts；本票不改 rooms-race 相关，但其隐式覆盖 `tests/qa/*.mjs` 与 ci.yml 双向引用，所以 rooms-race-qa.mjs 的 `BR: BR-6, BR-7, BR-10` 改动不破坏该用例）
  2. `pnpm typecheck`（`tsc --noEmit`；探针内仅引 `node:assert/strict` / `node:child_process` 已存在符号，typecheck exit 0 不依赖本票）
  3. `pnpm lint`（`eslint`；`tests/qa/**` 走 globalIgnores 跳过 eslint 走 `node --check` 二验）
  4. `pnpm build`（`next build`；生产构件为本票探针唯一允许的运行目标，禁 dev server）
  5. `node tests/qa/commit-audit.mjs --message-file <commit-msg>`（仅本次提交 message 合规——R1-R5 + commitlint；R6 不参与 --message-file 模式，所以 BR-6 dangle 不在本路径）
  6. `:3101` hermetic 生产构建 + `node tests/qa/rooms-race-qa.mjs`（8 step 全绿、stdout `8 PASS / 0 FAIL / 8 total`、进程杀干净、tmp DB 删干净）
- Evidence: `.omo/evidence/rooms-race-step1-ticket/task-<N>-<desc>.log` + `probe-summary.md`（六层结果汇总）+ 最终 `report.md`（AC 逐条 self-check）

## Execution strategy
### Parallel execution waves
> 单 implementation todo + 4 final verifiers = 5 个 todo（含 F 行），单 wave 平铺即可；不强制拆多 wave。
- Wave 1 (1 todo)：T1 探针 step 1 函数体 + 头部变更
- Wave 2 (4 todos parallel)：F1-F4 final verification wave

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| T1 探针 step 1 + header | — | F1-F4 | — |
| F1 plan compliance audit | T1 | — | F2 / F3 / F4 (parallel) |
| F2 code quality review | T1 | — | F1 / F3 / F4 (parallel) |
| F3 real manual QA | T1 | — | F1 / F2 / F4 (parallel) |
| F4 scope fidelity | T1 | — | F1 / F2 / F3 (parallel) |

> Implementation + Test = ONE todo。本探针本身就是 contract assertion，T1 同时含实现 + 契约断言；F3 才把同一断言在 :3101 hermetic 下端到端复跑。

## Todos
> Implementation + Test = ONE todo. Never separate.

- [ ] 1. tests/qa/rooms-race-qa.mjs: 头部 `// BR: BR-6, BR-7, BR-10` + scenario 列表加 step 1 + 删除两条反指 + 在 step 2 之前插入 step 1 函数体（约 60-70 行：launchQA + browser.newContext() 拉 ctx2 + Promise.all 双注册 + Promise.all 双侧 runSide + 服务端权威 GET + 不变式）；step 2-7 函数体一字面不变

  What to do / Must NOT do:
  - 第 1-3 行 BR 文本替换：`// BR: BR-7, BR-10` → `// BR: BR-6, BR-7, BR-10`
  - scenario 列表段（约 6-13 行）：在 step 2 行前新增 `step 1 (S2) 双设备同房间名并发 outcomes 精确累加契约` 一行
  - 删除原 `step 1 (T-B2 双设备并发 outcomes) 不在本票范围` 一整行
  - 删除原 `探针禁 claim BR-6（step 1 范围外；防 commit-audit R6 误判）` 一整行
  - 在现有 `await step("step 2 (S3) merge × outcomes 交错累加契约", ...)` 之前插入 `await step("step 1 (S2) 双设备同房间名并发 outcomes 精确累加契约", async () => { ... })`
  - step 1 内部实现要点（worker 复制）：
    - `const { browser, ctx: ctx1 } = await launchQA(); const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });`
    - `Promise.all([postRoom(ctx1, room), postRoom(ctx2, room)])` → assert 两边 200，existed pair sorted === [false, true]
    - `const sideAOutcomes = ["X", "X"]; const sideBOutcomes = ["O", "draw"];`
    - `const runSide = async (ctx, outcomes) => { for (const outcome of outcomes) { const r = await postOutcome(ctx, room, outcome); assert.equal(r.status, 200, ...); } };`
    - `await Promise.all([runSide(ctx1, sideAOutcomes), runSide(ctx2, sideBOutcomes)]);`
    - 服务端权威 `getStats(ctx1, room)` → assert status 200、`stats.body.stats.totalGames === sideAOutcomes.length + sideBOutcomes.length`、`xWins` / `oWins` / `draws` 各 === 期望值
    - 不变式 assert：`stats.body.stats.xWins + stats.body.stats.oWins + stats.body.stats.draws === stats.body.stats.totalGames`
    - finally：`try { await ctx2.close(); } catch {} await browser.close();`
  - MUST NOT：现有 step 2 / step 3 / step 4 / step 5 / step 6 / step 7 任何函数体内字符不动（含注释、assertion message 文本、空白）；不要把 `uniqueRoom("step2")` 等改成统一 `uniqueRoom("step1")` — 这是 step 内部局部变量，跟外部 step 无冲突
  - MUST NOT：不引入新 import；不在 step 1 内调用 `driveTopRowWin`（走 API 不走 UI）；不写 SINGLE_SIDE env

  Parallelization: Wave 1 | Blocked by: — | Blocks: F1-F4

  References (executor has NO interview context - be exhaustive):
    - tests/qa/rooms-race-qa.mjs:1-15（现头部；改面只在这 15 行头部 + 新增 step 1 函数块）
    - tests/qa/rooms-race-qa.mjs:33-35（`assert` import 已就位）
    - tests/qa/rooms-race-qa.mjs:34（`BASE` 常量已从 `BASE_URL` 派生）
    - tests/qa/rooms-race-qa.mjs:36-37（`EVIDENCE` / `RR_DB_PATH` / `RUN_SUFFIX` / `findings`）
    - tests/qa/rooms-race-qa.mjs:39-52（`step()` helper 同型复用）
    - tests/qa/rooms-race-qa.mjs:77-87（`postRoom` / `postOutcome` / `postReset` / `postMerge` / `getStats` helper 一字复用）
    - tests/qa/rooms-race-qa.mjs:90-92（`uniqueRoom(label)` helper 直接用 `uniqueRoom("step1")`）
    - tests/qa/rooms-race-qa.mjs:106-（现 step 2 函数体起点；step 1 必须插在此处之前）
    - tests/qa/rooms-race-qa.mjs:106-380（现 step 2-7 完整函数体；一字不动）
    - tests/qa/rooms-race-qa.mjs:380-（终报 section；不动）
    - tests/qa/lib/browser.mjs:36-58（`launchQA` 返 `{ browser, ctx, page, ... }`；`browser.newContext()` 复用同一 chromium）
    - tests/qa/lib/evidence.mjs:ensureDir / shootTo / writeQaLog（不动；EVIDENCE_DIR 已设）
    - app/api/rooms/route.ts:71-90（POST /api/rooms 200 + existed 契约）
    - app/api/rooms/[room]/stats/route.ts:31-44（GET stats 200 / 404 problem+json 契约）
    - app/api/rooms/[room]/stats/outcomes/route.ts:55-72（POST outcome 200 / 404 防静默建档）
    - lib/db.ts:419+（`recordOutcomeForRoom` 已 `withWriteLock` + `db.transaction()` 包裹，71ad38d D9 形态）
    - lib/db.ts:382-`accumulateMergeStats` 边界（不直接相关但需注意：本 step 走 outcome 而非 merge）
    - .omo/research-rooms-race-probe-20260924.md:46 §五 step 1 行（票面原话）
    - .omo/research-rooms-race-probe-20260924.md:178 步骤表注释（断言含义定位）
    - .omo/plans/ulw-rooms-race-map-20260924.md:T-B2 段（执行席已决参数）
    - .omo/plans/ulw-rooms-race-qa-ticket-20260924.md（已并入的探针骨架范式 — 沿用其 step() / helper / library 调用风格）
    - .github/workflows/ci.yml:79-138（CI `rooms-race` job 已就位；不重加）

  Acceptance criteria (agent-executable):
    - `node --check tests/qa/rooms-race-qa.mjs` exit 0
    - 第 1-3 行含字面 `// BR: BR-6, BR-7, BR-10`（按升序）
    - scenario 列表（头 6-15 行）含字面 `step 1 (S2) 双设备同房间名并发 outcomes 精确累加契约`
    - 文件不含字面 `step 1 (T-B2 双设备并发 outcomes) 不在本票范围` 与 `探针禁 claim BR-6` 两个反指
    - `git diff cddf174..HEAD -- tests/qa/rooms-race-qa.mjs` 在 step 2-7 段（106-380 范围内）零 `+`/`-` 行（实现 + 删除 only 在头部 + step 1 新增段）
    - `node tests/qa/rooms-race-qa.mjs`（:3101 hermetic + 全部 8 step）stdout 含 `STEP: step 1 (S2) 双设备同房间名并发 outcomes 精确累加契约 ... PASS` + 最终 `=== QA SUMMARY: 8 PASS / 0 FAIL / 8 total ===` + exit 0
    - 故意 mutation 测（验完撤回）：把 sideB 的 `"draw"` 临时改成 `"X"` → 探针 RED（draws 期望值出错）
    - 故意 mutation 测（验完撤回）：把 `expectedTotal` 临时改成 `999` → 探针 RED
    - 故意 mutation 测（验完撤回）：在 lib/db.ts 注释掉 `withWriteLock` 调用（模拟 71ad38d 之前） → step 1 必须 RED（坐实 lost-update → mutation proof） → 撤回恢复 PASS

  QA scenarios (name the exact tool + invocation, evidence path):
    - happy — `cd /private/tmp/ttt-wt-20260924/step1 && DATABASE_URL=file:/tmp/ulw-rs1-$(date +%s).db PORT=3101 pnpm start & SERVER_PID=$!; for i in {1..30}; do curl -sf http://localhost:3101/ > /dev/null && break || sleep 1; done; BASE_URL=http://localhost:3101 node tests/qa/rooms-race-qa.mjs; kill $SERVER_PID; rm -f /tmp/ulw-rs1-$(date +%s).db` → exit 0；Evidence: `.omo/evidence/rooms-race-step1-ticket/task-1-step1.log`
    - happy — `git diff cddf174..HEAD -- tests/qa/rooms-race-qa.mjs` | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | awk -F: '{print $1}' | sort -u 验证 ± 行只在 `tests/qa/rooms-race-qa.mjs:1-15` 与 step 1 新增段范围内；Evidence: `.omo/evidence/rooms-race-step1-ticket/task-1-step2-7-invariant.log`
    - failure — `sed -i 's/\"O\", \"draw\"/\"O\", \"X\"/' tests/qa/rooms-race-qa.mjs` 然后跑同上 happy → 探针 RED → `git checkout -- tests/qa/rooms-race-qa.mjs` 恢复 → 再跑 happy 绿。Evidence: `.omo/evidence/rooms-race-step1-ticket/task-1-mutation-draws.log`
    - failure — `sed -i 's/expectedTotal = sideAOutcomes.length + sideBOutcomes.length;/expectedTotal = 999;/' tests/qa/rooms-race-qa.mjs` 同上 → RED → 撤回 → 绿。Evidence: `.omo/evidence/rooms-race-step1-ticket/task-1-mutation-total.log`
    - failure — 临时把 `lib/db.ts:422` `withWriteLock` 注释掉 → step 1 必须 RED（lost-update 坐实）→ 撤回恢复 PASS。Evidence: `.omo/evidence/rooms-race-step1-ticket/task-1-mutation-lock-bypass.log`

  Commit: Y | `feat(qa): rooms-race-qa step 1 — S2 双设备同房间并发 outcomes 精确累加契约`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.

- [ ] F1. Plan compliance audit — `git diff main..HEAD --name-only` 仅含 `tests/qa/rooms-race-qa.mjs` + `.omo/plans/ulw-rooms-race-step1-20260924.md`（后者在 `.gitignore` 范围内不进 git，但写盘存在）；`git diff cddf174..HEAD -- tests/qa/rooms-race-qa.mjs | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)'` 在 step 2-7 函数体段（106-380 行）零 ± 行；Evidence: `.omo/evidence/rooms-race-step1-ticket/ac-f1-diff.log`
- [ ] F2. Code quality review — step 1 函数体约 60-70 行；命名沿用 `step()` / `uniqueRoom` / `postRoom` / `postOutcome` / `getStats` 既有 helper；`node --check tests/qa/rooms-race-qa.mjs` exit 0；commit message 含 WHAT/WHY/HOW + 至少 6 个 lore trailer（Constraint/Rejected/Confidence/Scope-risk/Directive/Tested）+ Plan footer；Evidence: `.omo/evidence/rooms-race-step1-ticket/ac-f2-quality.log`
- [ ] F3. Real manual QA — `:3101` hermetic + `node tests/qa/rooms-race-qa.mjs` 8 step 全绿（exit 0；stdout `8 PASS / 0 FAIL / 8 total`；server kill -0 fails；tmp DB 删净）；`pnpm vitest run` exit 0；`pnpm typecheck` exit 0；`pnpm lint` exit 0；`pnpm build` exit 0；`node tests/qa/commit-audit.mjs --message-file <commit-msg>` exit 0；Evidence: `.omo/evidence/rooms-race-step1-ticket/ac-f3-qa.log` + `probe-summary.md`
- [ ] F4. Scope fidelity — `git diff main..HEAD --name-only` 仅含两文件；`grep -rE 'concurrent-surface-qa\.mjs' tests docs lib app components .github scripts` 命中数 === `cddf174` 基线命中数（pre-existing BR-6 dangle 触点不增不减）；`grep -c '2 PASS\|1 FAIL' .omo/evidence/rooms-race-step1-ticket/task-1-step1.log` ≥ 1（探针真有跑）；不 push / 不发 gh api / 不创建 PR；Evidence: `.omo/evidence/rooms-race-step1-ticket/ac-f4-scope.log`

## Commit strategy
- 一次原子 commit：`feat(qa): rooms-race-qa step 1 — S2 双设备同房间并发 outcomes 精确累加契约`
  - subject 必须 = `<type>(<scope>): <中文描述>`（scope=qa），≤100 字符，subject 描述部分必须含 CJK（R7）
  - 正文 = `WHAT:` / `WHY:` / `HOW:` 三段（中文，每行 ≤72 字符）；HOW 段必须显式含 `playwright`、`pnpm exec node`、`withWriteLock`、`Promise.all`、`node:assert/strict` 等 token（满足 R3 HOW_RE 兜底，避免显式 WHY/HOW 头不被匹配而退回到 token 匹配）
  - trailer 至少含 `Constraint:` / `Rejected:` / `Confidence:` / `Scope-risk:` / `Directive:` / `Tested:` 六行（每行 ≤100 字符；除枚举值外自由文本须含 CJK）
  - Plan footer：`Plan: .omo/plans/ulw-rooms-race-step1-20260924.md`
  - 禁 `--no-verify`
  - 不 push；本票以分支末端交付（调度者统一合入）

## Success criteria
- AC-1 | `pnpm vitest run` exit 0（含 probe-reconciliation.test.ts；本票不动 rooms-race 相关但 routing table 不破该用例）| 证据：`.omo/evidence/rooms-race-step1-ticket/ac-1-vitest.log`
- AC-2 | `pnpm typecheck` exit 0 | 证据：`.omo/evidence/rooms-race-step1-ticket/ac-2-typecheck.log`
- AC-3 | `pnpm lint` exit 0 | 证据：`.omo/evidence/rooms-race-step1-ticket/ac-3-lint.log`
- AC-4 | `pnpm build` exit 0 | 证据：`.omo/evidence/rooms-race-step1-ticket/ac-4-build.log`
- AC-5 | `DATABASE_URL=file:/tmp/ulw-rs1-<ts>.db PORT=3101 pnpm start &` + 30s ready check + `BASE_URL=http://localhost:3101 node tests/qa/rooms-race-qa.mjs` exit 0；stdout `8 PASS / 0 FAIL / 8 total`；server 杀干净（`kill -0 $SERVER_PID` 失败）；Evidence: `.omo/evidence/rooms-race-step1-ticket/ac-5-rooms-race-qa.log`
- AC-6 | `git diff main..HEAD --name-only` 仅含 `tests/qa/rooms-race-qa.mjs` +（不入 git 的）`.omo/plans/ulw-rooms-race-step1-20260924.md` | 证据：`.omo/evidence/rooms-race-step1-ticket/ac-6-diff.log`
- AC-7 | `node tests/qa/commit-audit.mjs --message-file <commit-msg>` exit 0 | 证据：`.omo/evidence/rooms-race-step1-ticket/ac-7-commit-msg.log`
- AC-8 | `git diff cddf174..HEAD -- tests/qa/rooms-race-qa.mjs` 在 step 2-7 函数体段（行号 106-380 范围内）零 ± 行 | 证据：`.omo/evidence/rooms-race-step1-ticket/ac-8-step2-7-invariant.log`
- AC-9 | AC-4 契约硬断言：happy 路径下，任何修改 sideB / expectedTotal / withWriteLock 的 mutation 撤掉后必须恢复 PASS（验完不留 mutation）| 证据：`.omo/evidence/rooms-race-step1-ticket/ac-9-mutation-invariant.log`

---

> 终报：完整报告入 `.omo/evidence/rooms-race-step1-ticket/report.md`（执行席交付时填）+ pane 最后输出摘要含 AC 逐条 PASS/FAIL + 证据链接 + 改动文件清单 + 偏离任务书之处（无则"无"）。
