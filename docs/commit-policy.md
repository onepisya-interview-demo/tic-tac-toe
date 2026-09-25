# 提交策略（Commit Policy）

> 定位：本文承接 AGENTS.md §提交约定 及其子节（原子提交 / 设计记录 / PR 大小 / commit-msg
> hook）的全部细节。AGENTS.md 自 2026-09-12 起为 Router 形态，只留 digest（设计记录
> .omo/plans/agents-md-slim.md）。
>
> 策略真源是 `tests/qa/commit-audit.mjs`；`commitlint.config.cjs` 与 `.git/hooks/commit-msg`
> 是同一策略的另外两个检查点。本文解释策略，不复制规则清单——以脚本为准。
> 既有决策记录：`.omo/plans/commit-policy-enforcement.md`（hook 强制）、
> `.omo/plans/commit-policy-zh.md` 与 `.omo/plans/zh-default-commit-message.md`（中文化）。

本区块由项目维护，不是 next dev 再生成的内容。它是本仓库的权威贡献契约。

## 两类提交

提交遵循 Conventional Commits，正文使用 WHAT / WHY / HOW。同一分支有两类提交，不能混在一个提交里：

- **Context Prompt 提交**：主题以 prompt(<scope>): 开头，供后续 AI 审查消费；适合文档、设计记录和主要读者是评审者的产物。
- **常规功能/修复提交**：主题使用 feat、fix、refactor、test、docs、chore、build、ci 或 perf；不进入 prompt 转换流程，但仍遵守正文规范。

## 五步提交流程

1. 先检查 git status -s、git diff 和 git diff --cached，只提交已理解的变化。
2. 清理死代码、临时日志、调试器、脚手架和占位标识；不修改自己不理解的行为。
3. 按文件或 hunk 精确暂存。纯格式化、依赖升级、大规模重命名和无关变更单独提交。
4. 编写符合下方 schema 的提交消息。
5. 提交后同步相关文档；行为变化要运行对应的 tests/qa 脚本并保留 PASS/FAIL 证据。

## 正文 schema（WHAT / WHY / HOW）

- **WHAT**：一句话说明动作和对象，祈使语气，不展开实现细节。
- **WHY**：说明缺陷、需求、动机或架构权衡；有关联 issue/PR 时引用。
- **HOW**：说明策略、兼容性、验证、风险和用户影响；diff 已列出文件，正文不逐文件复述。

非平凡提交还要带 lore trailer：Constraint:、Rejected:、Confidence:、Scope-risk:、Directive:、Tested:、Not-tested:。设计记录页脚写 Plan: .omo/plans/<slug>.md。trailer 键名保持英文，值可以中文。audit 脚本硬性要求 Confidence:（low|medium|high）与 Scope-risk:（narrow|moderate|broad）；触发 on-demand 验证层时 `Not-tested:` 改为 `Tested:` + 触发原因（模板见 docs/verification-gauntlet.md §2）。

### 正文排版硬规则（commit-msg hook 实测，2026-09-24 补）

- **WHAT:/WHY:/HOW: 的 token 独占一行**，内容从下一行起、每行 ≤72 字符——commitlint 的 footer 解析把 `WHAT: 同行长内容` 整行认作 footer token 行，超长即 footer-max-line-length 拒绝（同日三犯实证；token 独占一行的格式不触发）。
- **subject 剥掉 Conventional 前缀后以中文或小写词开头**——大写单词开头触发 subject-case（sentence-case）拒绝：「T-B2 …」「Session …」「W-DIFF …」均实测被拒；中文/小写开头最稳。
- **每条 trailer 行 ≤100 字符**（长值拆成多条 trailer 或收窄措辞，不要硬塞一行）。
- 参照范本：commit `2e7104d`（@types/node 对齐，全要素合规）。

## 中文提交（默认）

默认 commit message 用中文。type/scope 保留英文 token，描述默认中文（按 Unicode 码点计 ≤100），正文默认中文 prose，WHAT/WHY/HOW 显式 heading 也默认中文。

**保留英文的三种例外**：

1. 引用外部工具/库/API 的 token（`pnpm exec commitlint`、`execFileSync` 等代码标识符）
2. 引用外部文档/链接的标题
3. 用户明确要求英文 commit message

清单之外的场景一律走默认中文。

### 中文 commit-audit 机械规则 R7（2026-09-23 入档）

`tests/qa/commit-audit.mjs` R7 把以上约定变成机械门禁，行为：

- **subject**：剥掉 Conventional 前缀（`feat(scope): ` 等）后，描述部分必须含至少 1 个 CJK 字符。阈值取最小门槛（`≥1 CJK`）以防误杀标识符密集中文 subject。
- **trailer 自由文本值**：`Constraint:` / `Rejected:` / `Directive:` / `Tested:` / `Not-tested:` / `Co-authored-by:` / `Signed-off-by:` / `Reviewer:` / `Reviewed-by:` / `Refs:` / `Closes:` / `Fixes:` / `Breaking:` / `See-also:` 等所有自由文本 trailer 的值必须含至少 1 个 CJK 字符。
- **trailer 豁免清单**：`Confidence: low|medium|high`、`Scope-risk: narrow|moderate|broad`、`Plan: .omo/plans/<slug>.md` 不进 R7 校验——它们是枚举或路径 footer，不是散文。

正反例（与 `tests/qa/commit-audit.test.ts` R7 用例同构）：

| 类型 | 例子 | R7 |
| --- | --- | --- |
| 正 ① 中文 subject | `fix(x): 中文测试` | PASS |
| 正 ② 历史兼容 | `git log --format=%s -30` 中 29 条中文 subject | PASS |
| 正 ③ 标识符密集 | `refactor(store): 抽取 resetStore helper 统一 11 处 setState 重置块` | PASS |
| 反 ① 纯英文 subject | `fix(x): hello world` | FAIL R7 |
| 反 ② 中文 subject + 英文 free-text trailer | `Constraint: keep the leaf intact.` | FAIL R7 |
| 反 ③ 英文路径值 trailer | `Refs: .omo/plans/foo.md` | FAIL R7——路径值也算自由文本，要引路径走 `Plan:` footer（豁免清单内） |

R7 与 commitlint 是单源关系：`commitlint.config.cjs` 不重复实现 R7，避免双源漂移（见该文件首部注释）。已有 commit 中的英文 outlier 由 R7 捕获，由后续工单按 reword 协议处理（不在本工单范围）。

### R6 BR↔探针双向绑定（全仓状态检查）

`tests/qa/commit-audit.mjs` R6 只在 `--branch` 模式运行，审计对象是**仓库现状**而非逐 commit：遍历 `docs/business-rules.md` 每个 BR 行，探针列（末列）反引号引用的每个路径必须 ① 在仓内存在、② 该文件**头 20 行**内出现对应 BR 号（如 `// BR: BR-6, BR-12`）；探针列标「⚠ 未探针化」的行豁免。

- 新增/修订 BR 行或探针文件时**两处头注同步改**，R6 才回绿；探针列反引号内写全路径（规范化路径不命中会误判有洞）。
- `--branch` 模式走整条分支全历史 + 全仓 R6，因此**基线的隐性违规会在任意波的终验首爆**——不是本波引入的也要当场修（实证 2026-09-25：BR-6 探针头注缺失在两计划波终验被 R6 揪出，cdacf88 修复）。

R7 与 commitlint 是单源关系：`commitlint.config.cjs` 不重复实现 R7，避免双源漂移（见该文件首部注释）。已有 commit 中的英文 outlier 由 R7 捕获，由后续工单按 reword 协议处理（不在本工单范围）。

## 原子提交

一个提交一个主题。每个提交都必须独立构建、测试为绿；不提交 WIP 或 omnibus。next-env.d.ts 和 Next 自动生成区块的变化单独作为 chore 提交，方便未来 bisect。

## 设计记录

非平凡工作先在 .omo/plans/<slug>.md 写设计记录，记录选项取舍、禁止事项和提交约定。实现提交通过 Plan: footer 引用它。

## Pull Request 大小

代码部分尽量少于 500 LOC、少于 10 个代码文件；文档、生成文件和 lockfile 不计入。超过时按层、功能组件或重构/功能拆分。

## commit-msg hook

`.git/hooks/commit-msg` 会调用 `node tests/qa/commit-audit.mjs --message-file "$1"`。消息不合规时提交失败；**禁止用 `git commit --no-verify` 绕过**。需要独立校验时使用 `pnpm exec commitlint --edit <message-file>`。

branch 全史审计（`--branch main`）对 Dependabot 自动提交（author 为 `dependabot[bot]`）豁免正文/尾注规则 R3-R5，输出记 `SKIP` 并单列计数：bot 消息由 GitHub 生成，无法携带人类 lore trailer；其 subject 仍受 R1/R2 约束。`--message-file` 模式（人类提交入口）不受此豁免。豁免按 author 身份判定，不按 subject 猜测。

hook 重建契约（hook 位于 `.git/` 内，git 永不跟踪）：契约三源为 AGENTS.md §commit-msg hook、`.omo/plans/commit-policy-enforcement.md`与 `.omo/plans/recovery-from-unknown-cleanup.md`（Directive 即原始 hook 契约）；重建脚本见 `.omo/plans/recovery-from-unknown-cleanup.md` 附录 B，重建后必须双向冒烟（合规消息放行 + 违规消息拦截）。
