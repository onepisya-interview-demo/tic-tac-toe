# ulw-rev-units-p3-hygiene-20260923 - Work Plan

## TL;DR (For humans)

**What you'll get:** 票③五项 finding 逐项闭环——修一处 jest-style 的 spy 残留（vi.spyOn 留下的 Object.defineProperty 不还原）、修一处 §三/§四 行号与实际源码的漂移、修 Alert.test.tsx 三处 comment 的同型漂移、给 §三「补充 case（4b）」补 footnote 说明它是有意合入 case 4。零行为改动；零用例新增；零用例删除。

**Why this approach:** 全部是「test-helper 卫生 / plan 文档同步 / 注释行号修」三类纯 hygiene 修改——所有现有测试一行不动也必须全绿（494 用例），这是「零行为改动」的客观佐证。修 spy 残留用最小修改（用模块级 flag + afterEach Reflect.deleteProperty）；修漂移用「逐段比对真源」机械执行；补 footnote 把「像遗漏」变成「明确设计决定」。每项 finding 都先给「fixed / 未发现漂移（附证据）/ 未定位到（附排查过程）」三态判定，禁凭感觉声称通过。

**What it will NOT do:** 不碰 tests/qa/home-return-qa.mjs（02c 阈值主公御裁「现阶段不动」）；不碰 lib/view-transition.ts / components/ui/Alert.tsx 等产品码；不碰其他票文件；不 build、不开 dev server；不 --no-verify。

**Effort:** Quick
**Risk:** Low - 全是 hygiene / 文档同步；diff 一眼可审；唯一隐忧是 finding ① 删除 install 属性后跨测试依赖——若有，AC-1 兜底「停下如实报告，不许硬修」
**Decisions to sanity-check:** finding ⑤ footnote 文案已写死为「语义同效，并入 case 4 用例，不另测」（来自 ticket 原文），无需再问。

Your next move: 已获用户授权 plan + execute 同会话进行，直接进入执行。

---

> TL;DR (machine): quick, low risk, 4 文件 hygiene edits + 单 atomic commit + AC 自验。

## Scope
### Must have
- `lib/view-transition.test.ts:51-83` — spyOnGetAnimations() 改为函数返回 spy + 记「本测试是否由 helper 安装属性」模块级 flag；afterEach 末尾加 `if (installed) Reflect.deleteProperty(document, 'getAnimations')`；installed flag 在 beforeEach 重置
- `.omo/plans/ulw-transition-alert-unit-tests-20260923.md:33-43`（§三）— 按 lib/view-transition.ts + lib/view-transition.test.ts 真源逐行修正行号 / 措辞漂移；§三 文末「补充 case（4b）」补 footnote
- `.omo/plans/ulw-transition-alert-unit-tests-20260923.md:45-56`（§四）— 按 components/ui/Alert.tsx + components/ui/Alert.test.tsx 真源逐行修正行号漂移
- `components/ui/Alert.test.tsx:17-19, 24-26, 32-34` — 三处 contract comment 行号从「:30,:44 / :30,:42 / :34,:45」更新到真实源码行（:39,:46 / :29,:46 / :31,:43,47），保留 callers 引用与 OutcomeErrorBanner 引用（已校验正确）

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 禁碰 `tests/qa/home-return-qa.mjs`（02c 阈值主公御裁「现阶段不动」）
- 禁碰 `lib/view-transition.ts`、`components/ui/Alert.tsx` 等产品码
- 禁碰其他票在管文件（其它 4 个 finding 的修法各自在其 plan 里）
- 禁 build、dev server、浏览器 QA
- 禁 `--no-verify` 绕过 commit-msg hook
- 禁改测试断言、断言顺序、用例数

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after（零行为改动 / 零用例增删，vitest 既有 494 用例必须全绿 = 零行为改动佐证）
- Evidence: notepad `/var/folders/qw/zyhqrbnj4jq4pj746lnpk8300000gn/T/ulw-20260923-XXXXXX.XXXXXX.md`
- 六层验收（task F3）：vitest + typecheck + lint（不动 build / 探针：本波无产品码变更）

## Execution strategy
### Parallel execution waves
> 4 项编辑彼此独立（文件不重叠，§三/§四同文件但段不同），单 wave 串行即可（顺序无所谓）。

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 lib/view-transition.test.ts | — | F1-F4 | 2, 3, 4 |
| 2 plan §三（含 4b footnote） | — | F1-F4 | 1, 3, 4 |
| 3 plan §四 | — | F1-F4 | 1, 2, 4 |
| 4 components/ui/Alert.test.tsx | — | F1-F4 | 1, 2, 3 |
| F1 五项 finding 闭环判定 | 1-4 | — | — |
| F2 4 文件 diff 审查 | 1-4 | — | F1 |
| F3 vitest + typecheck + lint | 1-4 | — | F1, F2 |
| F4 原子 commit + lore trailer | F1-F3 | — | — |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

- [ ] 1. lib/view-transition.test.ts 修 spyOnGetAnimations() 残留
  What to do / Must NOT do: 改 spyOnGetAnimations()——内部用模块级 flag `installedGetAnimations` 记录「本 helper 调用是否装了属性」（flag 在 beforeEach 重置）；afterEach 末尾加 `if (installedGetAnimations) { Reflect.deleteProperty(document, 'getAnimations'); installedGetAnimations = false; }`；helpers / tests / 断言一字不动；7 个用例的 mockReturnValue / mockRestore 调用保持原样
  Parallelization: Wave 1 | Blocked by: — | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): lib/view-transition.test.ts:51-60, :69-83（beforeEach/afterEach 块）；lib/view-transition.ts:49-50（getAnims 探测）
  Acceptance criteria (agent-executable): `pnpm vitest run lib/view-transition.test.ts` 全绿（7 用例）；7 用例数不变
  QA scenarios: RED（无）→ GREEN = vitest 7/7 通过 + 用例计数不变（ticket AC-1）
  Commit: Y | 合并到 4 项总 commit

- [ ] 2. .omo/plans/ulw-transition-alert-unit-tests-20260923.md §三逐行修正 + 4b footnote
  What to do / Must NOT do: 按真源比对修正 §三 7 行映射（行号 / 措辞）；§三 末尾「补充 case（4b）」段后插入 footnote：「**Footnote：** case 4b 的语义（jsdom 缺 getAnimations）与 case 4（getAnimations() 返回 []）同效——spyOnGetAnimations() 内部在 helper 缺属性时 Object.defineProperty 安装 + 返空模拟相同 source。来源：lib/view-transition.ts:49-50；lib/view-transition.test.ts:51-60。**语义同效，并入 case 4 用例，不另测。**」；不动 §一/§二/§五/§六/§七；不动 §四（task 3 改）
  Parallelization: Wave 1 | Blocked by: — | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): lib/view-transition.ts 行号真源：24-27（SSR no-op）/ 30-35（finish body 含 done + cleanup）/ 32-33（removeEventListener + clearTimeout，cleanup）/ 36-43（onEnd 含 whitelist if + finish 调用，whitelist 实际生效在 :37-40 的两个等值比较）/ 44（window.setTimeout(safety, 600)）/ 46-61（首 rAF 内 addEventListener + getAnimations 探测 + hasVT 判断）/ 55-61（hasVT=false 分支）
  Acceptance criteria (agent-executable): §三 7 行映射表每行「源码位置」与 lib/view-transition.ts 真源 1:1 对齐（用 `sed -n` 抽查 3 行验证）；§三 文末 footnote 字串含「并入 case 4 用例，不另测」
  QA scenarios: 真源 sed 抽查（PASS）；§三 / §四 行号 / 措辞漂移 0（self-check 列表）
  Commit: Y | 合并到 4 项总 commit

- [ ] 3. .omo/plans/ulw-transition-alert-unit-tests-20260923.md §四逐行修正
  What to do / Must NOT do: 按真源比对修正 §四 7 行映射（行号 / 措辞）；保留 §四 7 个断言语义不变（默认 role='alert' / role='status' 透传 / 默认 testid + 自定义 testid 透传 / title 条件渲染 / svg aria-hidden / children / className 合并不丢自有类）；不动 §一/§二/§三（task 2 改）/ §五/§六/§七
  Parallelization: Wave 1 | Blocked by: — | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): components/ui/Alert.tsx 行号真源：29（AlertProps role prop type）/ 31（AlertProps data-testid prop type）/ 39（destructured default `role = 'alert'`）/ 43（testId 计算）/ 46（JSX role={role}）/ 47（JSX data-testid={testId}）/ 48-54（className 数组构造）/ 57（svg aria-hidden）/ 65（title 三元）/ 66（children 渲染）
  Acceptance criteria (agent-executable): §四 7 行映射表每行「源码契约」与 components/ui/Alert.tsx 真源 1:1 对齐（用 `sed -n` 抽查 3 行验证）
  QA scenarios: 真源 sed 抽查（PASS）；§四 行号 / 措辞漂移 0（self-check 列表）
  Commit: Y | 合并到 4 项总 commit

- [ ] 4. components/ui/Alert.test.tsx 三处 comment 行号修
  What to do / Must NOT do: 修 test 1 comment（:17-19）行号从「:30,:44」→「:39（role 默认值声明）,:46（JSX role={role}）」；修 test 2 comment（:24-26）行号从「:30,:42」→「:29（AlertProps role prop type）,:46（JSX role={role}）」；修 test 3 comment（:32-34）行号从「:34,:45」→「:31（AlertProps data-testid prop type）,:43（testId 默认计算）,:47（JSX data-testid={testId}）」；保留 OutcomeErrorBanner 引用（components/OutcomeErrorBanner.tsx 真用 role='status'，已核实正确）；保留 callers 引用（RoomGateDialog.tsx:227 真用 room-gate-error，SyncConfirmDialog.tsx:274 真用 sync-confirm-error，已核实正确）；不动其它 comment、断言、用例
  Parallelization: Wave 1 | Blocked by: — | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): components/ui/Alert.tsx:29, :31, :39, :43, :46, :47；components/RoomGateDialog.tsx:227；components/SyncConfirmDialog.tsx:274；components/OutcomeErrorBanner.tsx 整体（role='status' 用法）
  Acceptance criteria (agent-executable): 3 处 contract comment 行号与 Alert.tsx 真源 1:1 对齐（用 `grep -n` 抽查）
  QA scenarios: 真源 grep 抽查（PASS）
  Commit: Y | 合并到 4 项总 commit

## Final verification wave
> APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above.

- [ ] F1. 五项 finding 闭环判定
  References: finding ①（lib/view-transition.test.ts spy 残留）= fixed by todo 1；finding ②③（plan §三/§四 行号与措辞漂移）= fixed by todo 2 / 3；finding ④（Alert.test.tsx comment 行号漂移）= fixed by todo 4；finding ⑤（§三 4b footnote）= fixed by todo 2；如某项 fixed 后发现仍漂，补报「未发现漂移」+ 证据 OR 「未定位到」+ 排查过程
  Acceptance criteria (agent-executable): 五项 finding 各有一行 closed（fixed / 未发现漂移/未定位到）+ 证据 / 排查过程
  QA scenarios: self-check 列表 PASS

- [ ] F2. diff 边界审查
  References: `git diff --stat c50532a..HEAD -- .` 仅 4 文件：lib/view-transition.test.ts / components/ui/Alert.test.tsx / .omo/plans/ulw-transition-alert-unit-tests-20260923.md / .omo/plans/ulw-rev-units-p3-hygiene-20260923.md（本 plan）
  Acceptance criteria (agent-executable): `git diff --stat c50532a..HEAD -- .` 恰好 4 文件命中
  QA scenarios: git diff --stat 抽查（PASS）

- [ ] F3. vitest + typecheck + lint 全绿
  References: package.json scripts: `pnpm test` (=vitest run) / `pnpm typecheck` (=tsc --noEmit) / `pnpm lint` (=eslint)
  Acceptance criteria (agent-executable): 三个命令均 exit 0；vitest 测试数 = 494 不变（ticket AC-1）；不动 build / 探针
  QA scenarios: 三命令自跑收尾验证（PASS）

- [ ] F4. 原子 commit + lore trailer + Plan footer
  References: `.git/hooks/commit-msg` → `node tests/qa/commit-audit.mjs --message-file "$1"`；commit 真源模板 `.omo/plans/commit-policy-zh.md` + `.omo/plans/commit-policy-enforcement.md`
  Acceptance criteria (agent-executable): commit-msg hook exit 0；subject = `chore(test): P3×5 修 view-transition+Alert 单测卫生 + plan 文档同步`（≤100 字符，type=chore，scope=test；中文描述）；body 三段（WHAT:/WHY:/HOW:）；trailer 至少含 Constraint/Rejected/Confidence/Scope-risk/Directive/Tested；footer `Plan: .omo/plans/ulw-rev-units-p3-hygiene-20260923.md`
  QA scenarios: commit-msg hook 自跑（PASS）；commit log 抽查

## Decisions
- **finding ① 修法选 A（模块级 flag + afterEach Reflect.deleteProperty）而非 B（spyOnGetAnimations() 返回 `{spy, installed}`，调用方解构）**：A 对 7 处 `getAnims.mockReturnValue(...)` / `getAnims.mockRestore()` 调用零改动（helpers / tests 接口不变）；B 需改 7 处调用，风险/工作量都更大，且 ticket AC-2 要求「diff 仅含指定 4 文件」——B 会让 diff 越过测试主体之外，违反约束
- **finding ⑤ footnote 文案硬编码为 ticket 原文「语义同效，并入 case 4 用例，不另测」**：ticket 御定，不再问
- **finding ②③ 用「逐段比对真源」机械执行，不写脚本化 diff**：单文件变更量 ≤ 20 行，人工逐行核完比脚本快且证据链清晰
- **finding ④ 修法保留 callers / OutcomeErrorBanner 引用**：grep 实测三者真实使用对应 testid / role，与 Alert.tsx 渲染契约对齐，引用正确

## Findings (执行期追加)

（待补）
