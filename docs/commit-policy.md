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

## 中文提交（默认）

默认 commit message 用中文。type/scope 保留英文 token，描述默认中文（按 Unicode 码点计 ≤100），正文默认中文 prose，WHAT/WHY/HOW 显式 heading 也默认中文。

**保留英文的三种例外**：

1. 引用外部工具/库/API 的 token（`pnpm exec commitlint`、`execFileSync` 等代码标识符）
2. 引用外部文档/链接的标题
3. 用户明确要求英文 commit message

清单之外的场景一律走默认中文。

## 原子提交

一个提交一个主题。每个提交都必须独立构建、测试为绿；不提交 WIP 或 omnibus。next-env.d.ts 和 Next 自动生成区块的变化单独作为 chore 提交，方便未来 bisect。

## 设计记录

非平凡工作先在 .omo/plans/<slug>.md 写设计记录，记录选项取舍、禁止事项和提交约定。实现提交通过 Plan: footer 引用它。

## Pull Request 大小

代码部分尽量少于 500 LOC、少于 10 个代码文件；文档、生成文件和 lockfile 不计入。超过时按层、功能组件或重构/功能拆分。

## commit-msg hook

`.git/hooks/commit-msg` 会调用 `node tests/qa/commit-audit.mjs --message-file "$1"`。消息不合规时提交失败；**禁止用 `git commit --no-verify` 绕过**。需要独立校验时使用 `pnpm exec commitlint --edit <message-file>`。

hook 重建契约（hook 位于 `.git/` 内，git 永不跟踪）：契约三源为 AGENTS.md §commit-msg hook、`.omo/plans/commit-policy-enforcement.md`、commit `52204f2` 正文与 Directive；重建脚本见 `.omo/plans/recovery-from-unknown-cleanup.md` 附录 B，重建后必须双向冒烟（合规消息放行 + 违规消息拦截）。
