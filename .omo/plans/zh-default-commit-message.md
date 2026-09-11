# zh-default-commit-message - Work Plan

## TL;DR (For humans)

**What you'll get:** AGENTS.md「### 中文提交」章节从 permissive（"可中文"/"可用中文 prose"/"也可"）改写为 prescriptive（首句硬约束"默认 commit message 用中文" + 封闭三条例外清单），并在 docs/learnings.md 追加 #31 条目，沉淀 commit `0f49375` 英文正文事件的可复现根因。单一 atomic docs commit，commit message 自身用中文 prose——即新规则的第一个端到端证据。

**Why this approach:**
- commit `0f49375`（feat(audit-policy): make commitlint run transitively on audit --message-file）subject + body 全英文，违反项目期望。检查点在机制上放行了它：audit R1-R5 只验结构（type 前缀 / 长度 / WHY-HOW 关键词命中 / trailer / Plan footer），不验语言——英文正文靠英文 token 列表轻松命中 R3。
- 双重诱导是根因：AGENTS.md 原章节用允许语气（permissive 对 LLM agent 是"允许集"而非"默认路径"）；commit-audit.mjs R3 的英文 token 列表实测远长于 CJK keyphrase 列表（WHY 62 vs 38、HOW 100 vs 52），英文正文命中 R3 几乎零成本。最近一笔 `a74b44e` 虽是中文先例，仍压不过这个组合。
- 用户决策：默认中文，例外清单显式列出，并沉淀为项目级记忆。

**What it will NOT do:**
- 不改 tests/qa/commit-audit.mjs / commitlint.config.cjs / .git/hooks/commit-msg——结构检查与语言默认是两层；本次只修文档契约层，R3 token 列表的语言中性化留作后续独立任务。
- 不改历史 commit——`0f49375` 保持英文原文，作为 learnings #31 的证据；不做 reset / rebase。
- 不动 `a74b44e` 的内容（learnings #30 是独立条目）。
- 不引入新依赖、不加新规则引擎。

**Effort:** XS（两个文档文件 + 一个 plan）
**Risk:** Low——纯文档契约变更，无运行时行为；audit 结构规则字节不动。

## 动机（latent 问题陈述）

1. 规范条款写法决定 agent 默认行为：permissive（"可以 X"）会被 agent 读成"英文也是合法选项"；prescriptive（"默认 X，例外是 Y"）才给出唯一默认路径。双语项目里，permissive + 检查器的 token-count bias = agent 永远选英文。
2. `0f49375` 事件证明检查点（audit R1-R5 + commitlint 串联）只能卡结构不能卡语言倾向；语言默认必须在 AGENTS.md 层显式规定。
3. learnings.md 是项目级记忆：#28/#29/#30 沉淀的都是机制可复现的失败；这次是规范写法层面的失败，同属一类，必须留档防止回潮。

## 选项评估

| 选项 | 做法 | 代价 / 为何不选 |
| --- | --- | --- |
| A. 保持 permissive，只加 learnings #31 | 不改 AGENTS.md | 根因不修，下一个 agent 在同一章节诱导下重演。**被否决** |
| B. 硬禁英文正文 | 「禁止英文 commit message」 | 例外场景真实存在：引用外部工具/库名、外部文档标题、用户显式要求英文。一刀切逼 agent 写蹩脚中文或绕过规则。**被否决** |
| **C. 默认中文 + 封闭例外清单（选定）** | 「默认中文」硬约束 + 三条例外（外部工具/库/API token、外部文档/链接标题、用户显式要求英文） | agent 有一条明确默认路径；例外封闭枚举，不给"看着办"空间；audit 结构规则无需感知语言。 |

## 设计要点

1. **标题改「### 中文提交（默认）」**：保留三级标题（在「## 提交约定」之下，与「### 五步提交流程」「### 正文 schema」同级），括号自带结论，agent 扫目录层就能拿到默认值。首句"默认 commit message 用中文"是硬约束句式，全文不再出现"可中文"类允许语气。
2. **例外封闭三条例**：(1) 引用外部工具/库/API 的 token（`pnpm exec commitlint`、`execFileSync` 等代码标识符）；(2) 引用外部文档/链接的标题；(3) 用户明确要求英文 commit message。清单之外一律走默认中文。
3. **保留三检查点句**：tests/qa/commit-audit.mjs、commitlint.config.cjs 和 commit-msg hook 的关系不变（audit 是策略真源、hook 薄壳委托、commitlint 被 audit 在 --message-file 模式串联）——本次不改任何检查点代码。
4. **learnings #31 只沉淀事实与机制**：事件（0f49375 英文正文）、三层根因（permissive 条款 / R3 token 列表长度差实测 62 vs 38 与 100 vs 52 / a74b44e 先例失效）、教训（双语规范必须 prescriptive + 检查点只能卡结构）。Plan footer 指向本 plan。实测数字替代任务简报里的约数（40+/36），以脚本统计为准。
5. **本 commit 自身即验证**：中文 prose 正文（WHAT:/WHY:/HOW: heading 关键词保留英文）+ 完整 R4 lore trailer + R5 Plan footer，先经 `audit --message-file` 干跑（即 audit→commitlint 串联链路），再走真实 `git commit` 被 hook 放行。

## 测试策略

1. `pnpm vitest run`：纯文档改动，基线 93/93 不应有任何位移。
2. `pnpm typecheck` / `pnpm lint` / `pnpm build`：全部 exit 0。
3. `node tests/qa/commit-audit.mjs --message-file <draft>`：中文草稿在 audit R1-R5 + commitlint 串联下双过（dry-run，不产生 commit）。
4. `node tests/qa/commit-audit.mjs --branch main`：128/128 → **129/129**（新增本 commit 自身）。
5. 端到端：真实 `git commit` 触发 commit-msg hook → audit --message-file → commitlint，中文 message 被放行。

on-demand 层不触发：不修改 `lib/**` / `db/**`（coverage、mutation 不触发），不新增 `lib/` 纯函数（property-based 不触发）。

## Must-not-have

- 不动 AGENTS.md / docs/learnings.md / 本 plan 之外的任何文件
- 不用 `--no-verify`；不做 history rewrite；不 `reset --hard` / `clean` / `rm -rf`
- 不改 commit-audit.mjs 的 token 列表本身（文档契约先行；R3 语言中性化是独立可选项）

## Rollback

单 commit revert 即回到 permissive 文本；learnings #31 随 revert 一并消失（同 commit 原子性）。无数据迁移、无生成文件。

## 后记（2026-09-12 amendment）

本 plan 发布后，用户显式授权将 `0f49375` 的英文 message 改写为中文（新 SHA `0ffde83`，经真实 `git commit --amend` 走 hook → audit → commitlint 链路放行）。原「不改历史 commit」的 Must-not-have 约束就此解除，仅对本 plan 的实现 commit 有效。learnings #31 已标注改写映射；文中保留英文原 subject 作为事件证据，不是疏漏。
