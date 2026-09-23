# ulw-decree-record-t3-judgment-20260923 - Work Plan

## TL;DR (For humans)

**What you'll get:** 把项 3 主公裁决里那条「等数据，现阶段不动」的判据钉到仓库的时序敏感断言守则里 (AGENTS.md),同时在裁决文档上留一行反向指针,防止判据与决策文档漂移。

**Why this approach:** 这是纯文档票 — 两文件各加一行,零产品码零测试改动,所以走单 atomic commit 而不是拆 2 commit (避免中间态不一致窗口);门禁只跑 vitest 全绿 (零行为改动佐证),其余四层 (浏览器探针 / build / typecheck / lint) 按任务书禁跑。

**What it will NOT do:** 不改任何探针阈值 (`home-return-qa.mjs` 步 02c EARLY 100ms 不动);不碰 commit-msg hook / commitlint 配置 / 提交策略文档 (票①在管);不动 build、不跑浏览器 QA、不 push。

**Effort:** Quick
**Risk:** Low - 纯文档改动,两文件各单行插入,commit-msg hook R1-R6 守门
**Decisions to sanity-check:** T1 新增 bullet 措辞采用「阈值不动 + 触发条件 + 调参公式 + 判据来源」四要素一行式,与现有 5 条 bullet 同密度。

Your next move: 已批准,直接进入执行 — 写两文件 → atomic commit → vitest 全绿 → 终验。

---

> TL;DR (machine): quick, low risk, 2 文档行插入 + 单 atomic commit + vitest 全绿 + 计划合规审查。

## Scope

### Must have
- tests/qa/AGENTS.md :43-49 「时序敏感断言」节追加 1 条 bullet (接现有 5 条之后),钉死 02c EARLY 阈值暂不放宽 + CI 首次 flake 触发判据 + 调参公式 + 判据来源。
- .omo/decisions-20260923.md :83-86 项 3 主公裁决引文块下追加 1 行反向指针:判据已外化至 tests/qa/AGENTS.md (本票,分支 docs/decree-record)。
- 单 atomic commit (subject `docs(qa): 外化 02c 阈值判据至时序敏感断言节(项 3 御裁)` ≤100 字符 + WHAT/WHY/HOW 三段 + 6 项 lore trailer + Plan footer)。
- `pnpm vitest run` 全绿 (零行为改动佐证)。
- commit-msg hook (R1-R6) 通过;禁 `--no-verify`。

### Must NOT have (guardrails, anti-slop, scope boundaries)
- 禁改 `tests/qa/home-return-qa.mjs` 与任何 EARLY/LATE 阈值数值 (任务书负面清单第 1 项)。
- 禁触 `tests/qa/commit-audit.mjs` / `commitlint.config.cjs` / `docs/commit-policy.md` / `docs/dispatcher-playbook.md` (票① in-flight)。
- 禁触其他并列席分支 (`chore/p3-doc-hygiene`, `feat/commit-lang-rule`, `refactor/reset-store-helper`, `fix/qa-02c-anchor`, `fix/reset-store-outcome-error`, `test/transition-alert-units`) — 仅在 `docs/decree-record` 上落 commit。
- 禁跑 `next build` / `next start` / 浏览器 QA。
- 禁 `--no-verify` 绕过 commit-msg hook。
- 禁 `git push` (本会话交付即止;主控统一合并与交叉审)。
- 禁改两文件其他内容 (一行式简洁风格维护;AC-1「其余内容一字不动」)。
- 禁扩 scope 到 commit-msg hook R7 中文门禁 (票①在管)。
- 禁把 `.omo/drafts/*` 草稿纳入 commit (AC-2 限定 diff 范围)。
- 禁跑 typecheck / lint / build (任务书未要求;与 AC-3「仅 vitest 全绿」一致)。
- 禁改 plan 文件到任何非 `.omo/plans/` 路径。

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after (zero behavior change,vitest 既有基线必须全绿 = 零行为改动佐证)
- Evidence: notepad `/var/folders/qw/zyhqrbnj4jq4pj746lnpk8300000gn/T/ulw-<timestamp>.md` (每次状态变更 append);最终 diff 自证在 commit message。
- 六层验收 (本波仅触发其中两层):
  - vitest 全绿 (AC-3) = zero behavior change 佐证
  - commit-msg hook R1-R6 全过 (AC-3 一部分)
  - 浏览器探针 / build / typecheck / lint 不触发 (任务书禁,且本票零产品码)

## Execution strategy

### Parallel execution waves
> T1 与 T2 是同意图两面 (判据外化 + 反向指针),但作用不同文件;可同 wave 串行 (顺序无所谓,文件不重叠),合一次 atomic commit。

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1 T1 AGENTS.md 时序敏感断言节追加 bullet | — | F1-F4 | 2 |
| 2 T2 decisions-20260923.md 项 3 块下追加指针 | — | F1-F4 | 1 |
| F1 计划合规 | 1, 2 | — | — |
| F2 AC 自检(两处一致 + 互证) | 1, 2 | — | F1, F3, F4 |
| F3 vitest 全绿 | 1, 2 | — | F1, F2, F4 |
| F4 原子 commit + commit-msg hook + diff 终审 | 1, 2 | — | F1, F2, F3 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. T1 — tests/qa/AGENTS.md :43-49 时序敏感断言节追加 1 条 bullet
  What to do / Must NOT do: 在现有第 5 条 bullet (`- 实证:\`home-return-qa.mjs\` step 02c ...`) 之后、`## 反模式` 节标题之前,**字面**追加: `- 02c EARLY 阈值(100ms)暂不放宽;CI 首次 flake 时读 DIAG 行 \`clickToOpenMs\`,若 path C 实测 >80ms 则 EARLY = 实测 P99 + 20ms(判据来源:\`.omo/decisions-20260923.md\` 项 3)。` (末尾保留 1 空行与现有列表间距对齐)。不动其他内容。
  Parallelization: Wave 1 | Blocked by: — | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): tests/qa/AGENTS.md:43-49 (现有 5 条 bullet 字面与行号已锁); .omo/decisions-20260923.md:62-86 (项 3 裁决明文); tests/qa/home-return-qa.mjs step 02c (DIAG 行字段定义,本票不修改)
  Acceptance criteria (agent-executable): `sed -n '50p' tests/qa/AGENTS.md | grep -F '02c EARLY 阈值(100ms)暂不放宽'` exit 0;`sed -n '50p' tests/qa/AGENTS.md | grep -F '.omo/decisions-20260923.md'` exit 0;`sed -n '51p' tests/qa/AGENTS.md` 内容与 line 49 之前所有行一致
  QA scenarios (name the exact tool + invocation): happy = 字面 grep PASS;failure = 字面错字 / 多余空格 / 引用源路径拼错 (fail 即停,重做);Evidence git diff tests/qa/AGENTS.md 行号 50 单行插入
  Commit: Y | 合并到 2 项总 commit

- [ ] 2. T2 — .omo/decisions-20260923.md :83-86 项 3 主公裁决块下追加 1 行反向指针
  What to do / Must NOT do: 在 line 86 `> 判据外化(防只活在决策文档里):修复席④落 \`tests/qa/AGENTS.md\` 时序敏感断言节。` 之后、同一 `### 主公裁决(2026-09-23)` 节内、最后一条 `>` 引文行紧接其后,**字面**追加: `> 判据已外化至 tests/qa/AGENTS.md(本票,分支 docs/decree-record)。` (前面不加空行引头;末尾保留 1 空行与块末间距对齐)。不动其他裁决项 (项 1/2/4/5 一字不动)。
  Parallelization: Wave 1 | Blocked by: — | Blocks: F1-F4
  References (executor has NO interview context - be exhaustive): .omo/decisions-20260923.md:83-86 (项 3 主公裁决块结构); .omo/decisions-20260923.md:7-12 (项 1 头部结构参考); .omo/decisions-20260923.md:36-58 (项 2 头部结构参考)
  Acceptance criteria (agent-executable): `sed -n '87p' .omo/decisions-20260923.md | grep -F '判据已外化至 tests/qa/AGENTS.md'` exit 0;`sed -n '87p' .omo/decisions-20260923.md | grep -F 'docs/decree-record'` exit 0;`git diff -- .omo/decisions-20260923.md | wc -l` 仅 +1 行
  QA scenarios (name the exact tool + invocation): happy = 字面 grep PASS;failure = 字面错字 / 漏分支名 / 误改其他裁决项 (fail 即停,重做);Evidence git diff .omo/decisions-20260923.md 行号 87 单行插入
  Commit: Y | 合并到 2 项总 commit

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit(diff 三类审查)
  Acceptance: `git diff docs/decree-record~1..HEAD --stat` 仅含 3 行 (2 文件 + plan + stat header);`git diff docs/decree-record~1..HEAD --name-only` = `{tests/qa/AGENTS.md, .omo/decisions-20260923.md, .omo/plans/ulw-decree-record-t3-judgment-20260923.md}`
- [ ] F2. AC 自检(两处一致 + 互证)
  Acceptance: AC-1 `sed -n '50p' tests/qa/AGENTS.md` 字面含 '02c EARLY 阈值(100ms)暂不放宽' 且含 '.omo/decisions-20260923.md' 项 3;`sed -n '87p' .omo/decisions-20260923.md` 字面含 '判据已外化至 tests/qa/AGENTS.md' 且含 'docs/decree-record'。两处互证闭环 (AGENTS.md 引用源 / decisions 引用目标)。
- [ ] F3. vitest 全绿(zero behavior change 佐证)
  Acceptance: `pnpm vitest run` exit 0;不动 build / typecheck / lint / 浏览器探针(任务书禁)。
- [ ] F4. 原子 commit + commit-msg hook + diff 终审
  Acceptance: 单 commit;subject `docs(qa): 外化 02c 阈值判据至时序敏感断言节(项 3 御裁)` (≤100 字符,含 `docs(qa):` 前缀);body 含 WHAT/WHY/HOW 三段;trailer 含 Constraint/Rejected/Confidence/Scope-risk/Directive/Tested + Plan: `.omo/plans/ulw-decree-record-t3-judgment-20260923.md`;禁 `--no-verify`;commit-msg hook R1-R6 全过;`git log -1 --format=%B` 输出含 6 项 lore trailer key。

## Commit strategy
单 atomic commit — `docs(qa): 外化 02c 阈值判据至时序敏感断言节(项 3 御裁)`
- type=docs (纯文档票);scope=qa (AGENTS.md 是 tests/qa/ 子目录)
- body 三段:WHAT (T1+T2 字面) / WHY (判据外化防漂移 + 复利资产归仓库原则,参 bc5d914) / HOW (两文件各单行插入 + 零阈值改动 + 走 commit-msg hook R1-R6)
- lore trailer 6 项齐:Constraint / Rejected / Confidence / Scope-risk / Directive / Tested
- Plan footer: `Plan: .omo/plans/ulw-decree-record-t3-judgment-20260923.md`
- 禁 `--no-verify`;commit-msg hook 走 R1-R6 audit
- 不分拆 commit:拆则留 AGENTS.md 含判据但 decisions 反向指针缺失的不一致窗口

## Success criteria
- AC-1: 两处改动落地且互相一致;其余内容一字不动
  - `sed -n '50p' tests/qa/AGENTS.md` 字面含 '02c EARLY 阈值(100ms)暂不放宽' + '.omo/decisions-20260923.md' 项 3
  - `sed -n '87p' .omo/decisions-20260923.md` 字面含 '判据已外化至 tests/qa/AGENTS.md' + 'docs/decree-record'
  - `git diff docs/decree-record~1..HEAD -- tests/qa/AGENTS.md | wc -l` 仅 +1 行 (其余行字节不变)
  - `git diff docs/decree-record~1..HEAD -- .omo/decisions-20260923.md | wc -l` 仅 +1 行
- AC-2: 零代码零测试改动;diff 仅含 2 文件 + plan 文件
  - `git diff docs/decree-record~1..HEAD --name-only` = `{tests/qa/AGENTS.md, .omo/decisions-20260923.md, .omo/plans/ulw-decree-record-t3-judgment-20260923.md}`
- AC-3: commit-msg hook 通过;pnpm vitest run 全绿
  - `git log -1 --format=%B` 含 6 项 lore trailer key
  - subject ≤100 字符 + `docs(qa):` 前缀
  - Plan footer 路径精确匹配 `.omo/plans/ulw-decree-record-t3-judgment-20260923.md`
  - `pnpm vitest run` exit 0
