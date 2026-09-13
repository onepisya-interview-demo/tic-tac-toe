# Plan: ulw · commit-audit 豁免 dependabot squash commit（ulw-audit-dependsbot-exempt-20260913）

- 日期：2026-09-13
- ulw-loop：`.omo/ulw-loop/ulw-audit-dependsbot-exempt-20260913/`

## 1. 现象

`node tests/qa/commit-audit.mjs --branch main` 现 total=168 fail=5。
五败者皆 Dependabot squash merge commit（#1/#2/#3/#4/#6 并入所产，
b020259/e92d976/2620fbc/bcde777/e92caf1）。其消息由 GitHub 生成，
永不能携带本仓人类 lore trailer（Confidence/Scope-risk/Plan/WHAT-WHY-HOW）。
策略若不豁免，验证门禁对 main 全史审计将永红——门之存在意义即失。

## 2. 修法

`tests/qa/commit-audit.mjs`：
1. branch 模式取 commit 元数据时增 author 名与邮箱
   （`--format=%H%x1f%ae%x1f%an`，按 \x1f 切分）。
2. `checkMessage(label, raw, opts)` 增第三参 `opts.botAuthored`；
   为真时**跳过 R3/R4/R5**（R1/R2 照检——bot 之 subject 仍须 conventional）。
3. 判定：author email === `dependabot[bot]@users.noreply.github.com`
   或 author name === `dependabot[bot]`。
4. 输出：豁免者记 `SKIP  <label>  <subject> (dependabot)`；
   汇总行改 `total=N pass=X skip=Y fail=Z`；exit 语义不变（fail=0 方绿）。
   `--message-file` 模式**不受豁免**（人类提交入口，策略不松）。
5. `tests/qa/commit-audit.test.ts` 补三测：
   a. bot 消息（无 body/trailer）→ branch 语境 SKIP 不 FAIL
   b. bot 消息 subject 非 conventional → R1 仍 FAIL
   c. 人类消息缺 trailer → FAIL 不变（回归守护）
6. `docs/commit-policy.md` §commit-msg hook 段后补一段豁免说明
   （bot 判定 + 只松 R3-R5 + message-file 不豁免）。

## 3. 验收标准

- AC1: 六门绿，且 `--branch main` 输出 fail=0、skip≥5
- AC2: 五个旧 dependabot commit 均 SKIP，人类 commit 无一 SKIP
- AC3: 新测试 3 件全绿，vitest 总数相应增加无减
- AC4: 单 commit（脚本+测试+文档+计划四件一体），trailer 齐全，
  subject 小写起，消息=授权件逐字节同
- AC5: 不 push

## 4. 边界

- 不动 commitlint.config.cjs（仅管人类 message-file 入口）
- 不动 .git/hooks（hook 委托 audit，脚本改即生效）
- 豁免以 author 身份为准，不按 subject 猜测（`bump ...` 标题不作为判据）
