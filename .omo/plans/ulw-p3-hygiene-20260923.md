# ulw-p3-hygiene-20260923 - Work Plan

## TL;DR (For humans)

**What you'll get:** 仓库里四处分散的小"撒谎"统一收拾干净：danger 配色对比度注释改成真实数字（6.66:1，不是当年拍脑袋写的 8.55:1）；战报失败提示字段的注释纠正成实际清空点；一处被遗忘的 7 空格行清掉；一处永远不会被命中的字典项按设计意图删除。

**Why this approach:** 全是「注释/空白/死键」三类纯卫生修改，零行为改动——也就是说所有现有测试一行不动也应当全绿，这是验收"零行为改动"的佐证。WCAG 对比度我自己用 Python 跑了一遍 WCAG 2.x 相对亮度公式复算确认 6.66:1，不是抄协调者的数；死键走「删除」而非「留注释」是因为现有 `?? fallback` 已经正确覆盖未知 reason，留着是伪装代码。

**What it will NOT do:** 不动 globals.css 的颜色 token；不动 lib/store.ts 任何运行时逻辑；不动 Alert 变体、ResetRoomStatsButton、OnlineGateDialog 等其他席位在管的东西；不跑 build、不开 dev server。

**Effort:** Quick
**Risk:** Low - 零行为改动，diff 全部三类（注释/空白/死键）一眼可审
**Decisions to sanity-check:** 死键选项选了 A（删除）而非 B（保留+注释）；理由详见 `## Decisions`。

Your next move: 已获用户授权 plan + execute 同会话进行，直接进入执行。

---

> TL;DR (machine): quick, low risk, 4 注释/空白/死键 edits + 单 atomic commit + AC 自验。

## Scope
### Must have
- app/globals.css :30-32 — danger token 注释对比度改为 6.66:1（可写 ≈6.7:1），保留"远超 AA"结论
- lib/store.ts :76-82 — outcomeError 字段 doc 改写为真实清空点
- lib/store.ts :128-135 — setOutcomeError action doc 同步改写（AC-2 全局要求无"下一次 makeMove"）
- components/OnlineGateMount.tsx :95 — 删 7 空格尾行
- components/OutcomeErrorBanner.tsx :26 — 删 'not-found' 死键（选项 A）

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 禁改 globals.css token 值（4 行 `--color-danger*` 一个字符不许动）
- 禁改 lib/store.ts 任何运行时逻辑（startGame / restart / setOutcomeError / makeMove 行为零变化）
- 禁动 Alert 变体、resetStore、其他席位在管的探针 / 弹框
- 禁 build、dev server
- 禁 `--no-verify` 绕过 commit-msg hook

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after（zero behavior change，vitest 既有 479 用例必须全绿 = 零行为改动佐证）
- Evidence: notepad `/var/folders/qw/zyhqrbnj4jq4pj746lnpk8300000gn/T/ulw-20260923-164916.XXXXXX.md.meKbbxFyH5`
- 六层验收（task AC-5）：vitest + typecheck + lint（不动 build / 探针：纯注释/空白/死键改动，浏览器探针不触发）

## Execution strategy
### Parallel execution waves
> 4 项编辑彼此独立，单 wave 串行即可（顺序无所谓，文件不重叠）。

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 globals.css 注释 | — | F1-F4 | 2, 3, 4 |
| 2 lib/store.ts 注释 | — | F1-F4 | 1, 3, 4 |
| 3 OnlineGateMount.tsx 空白 | — | F1-F4 | 1, 2, 4 |
| 4 OutcomeErrorBanner.tsx 死键 | — | F1-F4 | 1, 2, 3 |
| F1 计划合规 | 1-4 | — | — |
| F2 6 个 AC 探针 | 1-4 | — | F1 |
| F3 vitest + typecheck + lint | 1-4 | — | F1, F2 |
| F4 原子 commit + diff 审查 | F1-F3 | — | — |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. globals.css :30-32 注释对比度改为 6.66:1
  What to do / Must NOT do: 改注释为「text #F87171 on bg-elevated #141414 ≈ 6.66:1, 远超 4.5:1 AA 阈值。」；不动 token 值（4 行 `--color-danger*` 一字不改）
  Parallelization: Wave 1 | Blocked by: — | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): app/globals.css:30-32（复算见 plan 顶 WCAG 段）
  Acceptance criteria (agent-executable): `rg -n '8\.55' app/globals.css` 零命中；`rg -n '6\.66' app/globals.css` 命中 1
  QA scenarios: 复算 Python 验算（已跑 → 6.6600:1，PASS）
  Commit: Y | 合并到 4 项总 commit

- [ ] 2. lib/store.ts :76-82 + :128-135 注释纠正清空点
  What to do / Must NOT do: 改写为真实清空点（startGame / restart / 手动关闭 = setOutcomeError(null)）；不删 `makeMove` 字符串本身（注释里出现是允许的，前提是不写"下一次 makeMove"或等价的"下一次/下次会清"语义）；不动运行时逻辑
  Parallelization: Wave 1 | Blocked by: — | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): lib/store.ts:76-82, :128-135, :308, :411, :464, :359-366, :387-393
  Acceptance criteria (agent-executable): `rg -n '下一次 makeMove' lib/store.ts` 零命中；`rg -n 'next makeMove|下一次\s*makeMove|下次 makeMove' lib/store.ts` 零命中；两处新注释明确提到 startGame / restart / 手动关闭
  QA scenarios: rg 自验（PASS）；不动 store.test.ts 既有 479 用例（行为不变）
  Commit: Y | 合并到 4 项总 commit

- [ ] 3. OnlineGateMount.tsx :95 删 7 空格尾行
  What to do / Must NOT do: 删除该行所有字符（含行尾换行）；不动 afterViewTransition 块其他内容
  Parallelization: Wave 1 | Blocked by: — | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): components/OnlineGateMount.tsx:90-100（afterViewTransition 块上下文）
  Acceptance criteria (agent-executable): `rg -n '^\s{7}$' components/OnlineGateMount.tsx` 零命中
  QA scenarios: rg 自验（PASS）
  Commit: Y | 合并到 4 项总 commit

- [ ] 4. OutcomeErrorBanner.tsx :26 删 'not-found' 死键（选项 A）
  What to do / Must NOT do: 删除该行；?? fallback 兜底逻辑保持；不删 copyFor 函数其他行
  Parallelization: Wave 1 | Blocked by: — | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): components/OutcomeErrorBanner.tsx:26；lib/game-net.ts:35-37（FetchResult.reason 词汇表）；components/OutcomeErrorBanner.tsx:29（?? fallback）
  Acceptance criteria (agent-executable): `rg -n 'not-found' components/` 命中数从 2 降到 1（剩 ResetRoomStatsButton.test.tsx 里的测试 fixture 字符串，与本次无关）
  QA scenarios: rg 自验（PASS）；ResetRoomStatsButton.test.tsx 不在范围内故不动
  Commit: Y | 合并到 4 项总 commit

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. 计划合规审计（diff 三类审查）
  Acceptance: `git diff dev..HEAD` 仅含注释/空白/死键三类改动；`git diff dev..HEAD --stat` 与预期文件集完全一致
- [ ] F2. 6 个 AC 探针全过
  Acceptance: AC-1~6 全部 PASS（AC-1 `rg 6.66` ✓ AC-2 `rg 下一次 makeMove` 零命中 ✓ AC-3 `rg '^\s{7}$'` 零命中 ✓ AC-4 `rg not-found components/` 仅 ResetRoomStatsButton 测试 fixture ✓ AC-5 见 F3 ✓ AC-6 commit 走完）
- [ ] F3. vitest + typecheck + lint 全绿
  Acceptance: `pnpm vitest run` exit 0；`pnpm typecheck` exit 0；`pnpm lint` exit 0；不动 build（注释/空白/死键，无产物影响）
- [ ] F4. 原子 commit + diff 终审
  Acceptance: 单 commit，subject ≤100，type 前缀，lore trailer（Constraint / Rejected / Confidence / Scope-risk / Directive / Tested），Plan: .omo/plans/ulw-p3-hygiene-20260923.md footer；禁 --no-verify；commit-msg hook PASS

## Commit strategy
单 atomic commit：`chore(hygiene): 4 项零行为改动（注释/空白/死键）`
- WHY/HOW 段覆盖 4 项，Constraint/Rejected/Confidence/Scope-risk/Directive/Tested trailer 全
- Plan footer 指向本文件
- 禁 --no-verify；commit-msg hook 走 R1-R5 audit

## Success criteria
- AC-1 `app/globals.css` 注释含 6.66 或 6.7 且不再含 8.55
- AC-2 `lib/store.ts` 注释不再含「下一次 makeMove」或等价表述，新注释与实际清空点（startGame / restart / 手动关闭）一致
- AC-3 `rg -n '^\s{7}$' components/OnlineGateMount.tsx` 零命中
- AC-4 OutcomeErrorBanner 死键已删（选 A，rg 命中数从 2 降到 1）
- AC-5 `git diff dev..HEAD` 仅含注释/空白/死键三类；`pnpm vitest run` / typecheck / lint 全绿
- AC-6 原子提交 + lore trailer + Plan footer，commit-msg hook PASS，禁 --no-verify
