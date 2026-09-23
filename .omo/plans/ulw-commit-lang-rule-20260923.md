# Plan: ulw-commit-lang-rule（票① 语言一致性契约）

## Goal

将 commit-audit 体系从「格式合规」升级到「格式 + 中文语言」双重机械门禁，让
「plan / commit subject / lore trailer 一律中文」从建议变硬约束；同步
commitlint / 提交策略文档 / 调度者 brief 模板，三处口径一致。存量 plan
只翻译不动 commit。

## Background（已裁决，不再调研）

- 主公 2026-09-23 裁决 A+B 组合：A 给 commit-audit 加 R7 中文语言规则；B
  把调度 brief 模板钉中文。
- 现有 commit-audit.mjs 只查格式（R1-R6），没有语言门禁；存量 commit 几乎
  全中文 subject（见 git log 近 30 条），新规则不会误伤历史，但需测一次。
- R7 阈值设计为「至少 1 个 CJK 字符」（`/[㐀-鿿]/`），不放占比阈值——主公
  在 brief 中明示要防「标识符密集中文 subject」被误杀，最小门槛即可。
- 存量 plan `ulw-reset-store-outcome-error.md` 81 行几乎全英文散文，主公同
  步下令翻译，但不动既有 commit（reword/rebase 视为负面清单硬约束）。
- commitlint.config.cjs 已支持 commit-as-prompt 解析；R7 trailer 校验走
  commit-audit 真源，commitlint 同步语义但不重复实现（CJK 检测属格式而非
  commitlint 标准规则；新增 commitlint 插件改 4 处同步，反增加漂移面）。

## Scope（in）

1. **A0** 翻译 `.omo/plans/ulw-reset-store-outcome-error.md` 为中文散文：
   - 标题/列表/段落叙述全部中文。
   - 代码块、命令、文件路径、commit SHA、行号、字段名、JSON 字段保持原样。
   - 语义零漂移（不接受顺手重构、不动 WHAT/WHY/HOW 三段、AC 表、行号引用）。

2. **A1** `tests/qa/commit-audit.mjs` 新增 R7：
   - subject 剥掉 `PROMPT_RE` / `TYPE_RE` 前缀后必须含至少 1 个 CJK 字符
     （`/[㐀-鿿]/`）。注释里注明阈值取最小门槛的理由（防标识符密集被误杀）。
   - footer 中自由文本 trailer 值必须含 CJK。豁免清单：`Confidence:
     low|medium|high`、`Scope-risk: narrow|moderate|broad`、`Plan: <path>`。
   - 其他 trailer（`Constraint / Rejected / Directive / Tested / Not-tested
     / Co-authored-by / Signed-off-by / Reviewer / Reviewed-by / Refs /
     Closes / Fixes / Breaking / See-also`）一律自由文本，须 CJK。
   - R7 与 R1-R6 同一 findings 通道输出，单行 `R7: <msg>`。
   - bot-authored（dependabot）豁免 R3-R5，不豁免 R7（Dependabot 的
     Co-authored-by 是英文，但 bot 提交通常不带自由文本 trailer，留给未来
     单独处理，不在本波扩）。

3. **A2** `tests/qa/commit-audit.test.ts` 加 4 类用例：
   - ① 全英文 subject 必须 FAIL：构建 fixture repo，写入
     `fix(x): hello world`，subject 不含 CJK，断言 `FAIL R7`。
   - ② git log 近 30 条既有 subject 全部 PASS：构建 fixture repo，把
     `git log --format=%s -30` 写入 30 条 commit，逐一加 R1-R5 + R7 合规
     body / trailer，断言 audit 退出 0 且零 R7 失败。
   - ③ 标识符密集中文 subject 必须 PASS：fixture 写
     `refactor(store): 抽取 resetStore helper 统一 11 处 setState 重置块`，
     断言 PASS。
   - ④ 全英文 trailer 自由文本必须 FAIL：fixture 中文 subject + 中文
     `Constraint: keep the leaf intact.`（英文），断言 `FAIL R7` 指向
     `Constraint:` trailer。

4. **A3** 三处同步（tests/qa/AGENTS.md 反模式条款明示不能只改一处）：
   - `commitlint.config.cjs` 在注释块写明「中文 trailer 自由文本值由
     commit-audit R7 校验；commitlint 不重复实现以避免双源漂移」，并在
     rules 注释里提示 `has-*-trailer` 插件检查的是枚举 + Plan，与 R7 互
     不覆盖。
   - `docs/commit-policy.md` 「中文提交（默认）」节增 R7 子段，写明豁免
     清单与正反例：subject 至少 1 CJK、自由文本 trailer 必须含 CJK、枚举
     + Plan 路径豁免；列出 4 条正反例（同 A2 四类）。
   - `docs/dispatcher-playbook.md` 「Brief 硬性负面清单」节增「派发 brief
     正文一律中文」小节（技能触发行与外部 prompt 模板原文除外）。

5. **A2 副作用**：现有 `commit-audit.test.ts` 的 `BOTH_PASS` /
   `R6_FIXTURE_MSG` / `AUDIT_PASS_COMMITLINT_FAIL` 三处 fixture 改为中
   文（free-text trailer 值改中文，subject 改中文，body 改中文 prose），
   否则 R7 落地会让原有 4 个测试全挂——这是 R7 的合理影响，不是副作用，
   不写免责注释。

## Scope OUT（Must-NOT-Have）

- 不 reword / rebase / reset 任何既有 commit（git log 30 条历史不动）。
- 不动 `tests/qa/home-return-qa.mjs`。
- 不动 `tests/qa/AGENTS.md`（归票④）。
- 不动 `lib/` `components/` `app/` `db/`。
- 不动 `.git/hooks/commit-msg`（它只调 auditor，auditor 升级自动生效）。
- 不改 R1-R6 既有语义（不删豁免，不改阈值，不放宽）。
- 不跑 `next build` / `next start` / 浏览器 QA（本波无产品码变更）。
- 不写新 commitlint 插件（双源漂移风险）。
- 不改 `tests/qa/commit-audit.mjs` 的 dependabot 豁免逻辑。
- 不加新 npm 依赖。

## Tier

**LIGHT**。单点审计规则升级 + 文档同步 + 测试覆盖，pattern 已知（R1-R6 同
构），无开放设计决策；blast radius 限于 `tests/qa/commit-audit.*`、
`commitlint.config.cjs` 注释、`docs/commit-policy.md`、
`docs/dispatcher-playbook.md`、`.omo/plans/ulw-reset-store-outcome-error.md`、
`.omo/plans/ulw-commit-lang-rule-20260923.md` 七个文件。证据通道：vitest
+ commit-audit subprocess（已有现成路径，参考 `commit-audit.test.ts` 的
fixture repo 模式）。无浏览器 / 端到端表面。自检写入 notepad；无 reviewer
loop。

## Files Touched（expected `git diff dev..HEAD --name-only`）

- `tests/qa/commit-audit.mjs`（modify：加 R7 + CJK 检测）
- `tests/qa/commit-audit.test.ts`（modify：BOTH_PASS / R6_FIXTURE_MSG
  中文化；增 R7 4 类用例）
- `commitlint.config.cjs`（modify：注释写明 R7 不在 commitlint 重复实现）
- `docs/commit-policy.md`（modify：增 R7 子段）
- `docs/dispatcher-playbook.md`（modify：增 brief 中文小节）
- `.omo/plans/ulw-reset-store-outcome-error.md`（modify：A0 翻译）
- `.omo/plans/ulw-commit-lang-rule-20260923.md`（add：本 plan）

## Acceptance Criteria

| ID | Criterion | Verify by |
| --- | --- | --- |
| AC-1 | A0 翻译完成：`.omo/plans/ulw-reset-store-outcome-error.md` 全文无成段英文散文（代码块、命令、路径、commit SHA、行号、字段名除外） | `rg -U '[A-Za-z]{20,}' .omo/plans/ulw-reset-store-outcome-error.md` 仅命中代码块/路径/SHA |
| AC-2 | R7 in + A2 四类用例齐全，`pnpm vitest run` 全绿 | vitest 退出 0，新加的 4 个 R7 测试 PASS，原有测试 PASS |
| AC-3 | commitlint.config.cjs / docs/commit-policy.md / docs/dispatcher-playbook.md 三处 R7 语义一致（含豁免清单与正反例） | 三处文案 grep 命中一致关键字（`R7`、`CJK`、`豁免`） |
| AC-4 | `pnpm typecheck` exit 0；`pnpm lint` exit 0；本分支 git log 近 30 条 subject 用新 R7 自测全 PASS | 三条命令退出 0；`node tests/qa/commit-audit.mjs --branch feat/commit-lang-rule` 退出 0 |
| AC-5 | 不 reword/rebase 任何既有 commit（负面清单硬约束） | `git log --format=%H -30` 与 `git log dev..HEAD` 不重叠（HEAD 与 dev 在同一基线 + 本波新 commit 之前） |

## Todos

- [ ] 1. `.omo/plans/ulw-reset-store-outcome-error.md: 翻译为中文散文（代码块/路径/SHA/字段名保持原文；语义零漂移）` — verify by AC-1 的 ripgrep 命令只命中豁免片段。
- [ ] 2. `tests/qa/commit-audit.mjs: 新增 CJK_RE 与 R7 校验（subject 必须 ≥1 CJK；footer free-text trailer 必须含 CJK；枚举 trailer 与 Plan 路径豁免）` — verify by unit 思路在 step 4 落地。
- [ ] 3. `tests/qa/commit-audit.test.ts: 把 BOTH_PASS / AUDIT_PASS_COMMITLINT_FAIL / R6_FIXTURE_MSG 三处 fixture 改为中文（subject + body + 自由文本 trailer 值中文化；枚举 trailer + Plan 路径保持英文）` — verify by 现有测试 PASS。
- [ ] 4. `tests/qa/commit-audit.test.ts: 新增 4 类 R7 用例（① 全英文 subject FAIL；② 30 条历史 PASS；③ 标识符密集中文 subject PASS；④ 全英文自由文本 trailer FAIL）` — verify by 4 个 it() 全 PASS。
- [ ] 5. `commitlint.config.cjs: 顶部注释写明「中文 trailer 自由文本值由 commit-audit R7 校验；commitlint 不重复实现以避免双源漂移」` — verify by 文件首部 grep 命中。
- [ ] 6. `docs/commit-policy.md: 「中文提交（默认）」节增 R7 子段（豁免清单 + 4 条正反例）` — verify by AC-3 grep。
- [ ] 7. `docs/dispatcher-playbook.md: 「Brief 硬性负面清单」节增「派发 brief 正文一律中文」小节` — verify by AC-3 grep。
- [ ] F1. `git diff dev..HEAD --name-only` 仅 7 个文件；`pnpm typecheck` / `pnpm lint` / `pnpm vitest run` / `node tests/qa/commit-audit.mjs --branch feat/commit-lang-rule` 全 PASS；AC-1~5 逐条 self-check 入 notepad。

## Commit

- type: `chore`
- scope: `audit`
- subject: `chore(audit): commit 消息加中文语言规则 R7 + 三处同步`
- lore trailer: Constraint / Rejected / Confidence / Scope-risk / Directive / Tested
- footer: `Plan: .omo/plans/ulw-commit-lang-rule-20260923.md`

## Stop condition

I'll stop right away when AC-1~5 all PASS with captured evidence in the
notepad, the atomic commit lands, the final reply carries the AC-1~5
one-line table + diff 文件清单 + 门禁自跑结果 + 偏离任务书之处（本波无）。
