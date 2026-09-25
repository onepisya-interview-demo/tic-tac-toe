# 调研报告：重复错误固化为机器规则——机制盘点与 AI 时代业界实践

> 性质：调研入档，**不立项不开坑**（主公 2026-09-26 明示「等需要的时候再拉出来编写计划」）。
> 缘起：两计划波交接后，主公提出「经常犯的错误用代码与强制流程固化，类似 eslint——同类问题新出现就加规则，程序自动修复与遵守」。
> 唤醒条件与检索路径见 §六；候选行动项（立票素材）见 §五。

---

## 一、方法论：错误固化晋升流水线

错误不是直接变规则，而是逐层升级：

```
错误发生 → 反模式目录（文档层）→ 复发（三犯法则）→ 脚本检查（可跑）
        → 门禁强制（hook / CI，绕不过）→ 自动修复（--fix / codemod，不用人改）
```

四原则：
1. **能机械的绝不靠记忆**——prose 规则是意图声明，不是执行层；人与 LLM 记忆都衰减，探针与 lint 不会。
2. **规则也是代码**——每条规则带正反例测试、触发范围、owner；没有反例测试的规则会在第一次误报时被全员绕过。
3. **修复优先于报告**——`--fix` 优于报错，报错优于文档，文档优于口头。
4. **强制力分级，放对层**：
   - L1 可确定性判定（格式 / 文件禁区 / 绑定关系）→ lint / hook / CI 阻断；
   - L2 模式可匹配、语义模糊（「这类调用形状危险」）→ 结构规则（ast-grep/semgrep）+ 人审；
   - L3 只能语义判断（抽象合不合理）→ AI 评审 + 约定文件，其裁决向 L1/L2 沉淀。
   放错层是常见病：L3 写成 L1 → 误报泛滥 → 规则被人整体关掉；L1 留在 L3 → 永远重犯。

## 二、仓库现状盘点：管道已存在，三次实证转化

| 层 | 已有机制 |
|---|---|
| 知识层（候补池） | anti-patterns.md（L0/L1/L2 编号目录）、business-rules.md（decree 表）、.omo/plans 设计记录、dispatcher-playbook「机器锚点优先」节 |
| 机械层 | commit-audit R1-R7 + commitlint + commit-msg hook（禁 --no-verify）；eslint 9；knip（qa:audit）+ 探针↔CI 机械对账测试（anti-patterns L1-31）；sw-bust --check |
| CI 层 | ci.yml 八 job：lint/typecheck/test/build + 四探针 job 化；org ruleset main-gate（required checks 名单）+ main-redline（禁改文件无豁免） |
| 派发层（AI 时代自创） | workflow 脚本亲跑门禁与红线 diff 断言（不信任席位自报）、换人复核、worktree 文件面比对 |

三次「重犯→立规」实证：① 2026-09-22「467 全绿但业务意图被破坏」→ BR 表 + R6 双向机械绑定；② commit 排版同日四五犯 → R7 + brief 排版模板；③ 孤儿探针 13 个 → knip 白名单清零 + 对账测试。

**差距（停在文档层、可机械化候选）**：① TTL「改一处」文档承诺 ↔ 端点硬编码 30（= 待决 Q3）；② 多票派发单票范围漂移（t-n4 型，本波靠司机人工拦截）；③ eslint 无 --fix、无 format 自动化。

## 三、业界全景（AI 时代，四层）

### A. 结构规则 + 自动修复层（「加规则→程序自动修」的最短路径）
- **ast-grep（`sg`）**：YAML 结构规则（pattern + fix），`sg scan` 报告、`--rewrite` 全仓改写、`--interactive` 逐个接受；25+ 语言。示例 `pattern: console.log($ARGS)` → `fix: logger.info($ARGS)`。
- **Semgrep**：同类多语言，规则生态大，autofix 成熟。
- **Fixit（Uber）**：libcst 之上的 lint 规则 + autofix 框架；Uber 文化 = 同样的错误看到第二次就写成带 autofix 的规则，codemod 推全仓。
- **Codemod 家族**：jscodeshift / ts-morph（一次性迁移）、OpenRewrite（Java recipes）、GritQL——规则即「可分发、可测试、可批量执行的迁移脚本」。
- **Fitness functions**：dependency-cruiser / eslint-plugin-boundaries / ArchUnit——架构约束写成会失败的测试（Evolutionary Architecture 术语）。本仓库 R6 红线断言属此类。

### B. Agent 执行层（AI 时代新增门禁位）
- **Claude Code / ZCode hooks（PreToolUse/PostToolUse）**：策略做成基础设施级确定性控制；业界口径「hooks 在基础设施层强制策略，skills 在推理层给知识」；PostToolUse 自动 format/lint，PreToolUse 挡危险操作/保护分支/禁改文件。注意：PreToolUse 不能覆盖权限系统的 deny/ask。
- **AGENTS.md 开放标准**：2026 已成跨工具事实标准（Codex/Cursor/Claude Code 通读；LLVM 亦在用 RFC 写 AI tool policy）。业界共识：**AGENTS.md 负责声明，CI/lint 负责强制**——agent 对 prose 遵守率非 100%，声明层与执行层必须分离。
- **Cursor rules / .cursor/rules、Claude Skills**：知识层载体，与 hooks 互补（推理层 vs 基础设施层）。

### C. AI 评审层（L3 模糊区产品化）
- **CodeRabbit**：learnings 机制（评审反馈沉淀为团队约定记忆）；内部也用 ast-grep 做代码导航。
- **Qodo**：仓库级 best_practices.md 喂给 reviewer。
- **Greptile**：全库理解型 review。
- 共同模式：只能人判的约定外包给 AI 评审 → 裁决沉淀为规则文件 → 硬门禁最终仍回 CI。

### D. 规则的元层（维护规则集本身）
- **三犯法则**：同一错误第 3 次出现必须立规则（Google paved road / Uber fixit 共同点）。
- **LLM 起草、人裁决、机械验证**：bug 报告 → LLM 理解/规则草稿 → 带正反例的规则测试 → 人审入册。相关研究：LLM 可从 bug 报告理解并复现约 50%（Plein et al. 2023）；「style spec → 规则清单 → AI 自检」与「自定义 linter 编码规则再喂给 LLM」是两篇实操文。
- **精度预算**：误报多的规则会被人整体关掉——每条规则维护 precision，不为准而准（与本仓库「不为改而改」同构）。

## 四、核心洞察（本次调研的判断）

1. **「声明归 prose、强制归代码」是 AI 时代的最大共识**——agent 是 literal-minded 的高速执行者，prose 漂移率比人更高，红线因此更清晰。本仓库 AGENTS.md Router + 机械门禁组合已是该共识的先行版，不需要引入新框架，需要的是把差距项（§二）逐个下沉。
2. **hooks 是 agent 时代新增的门禁位**：本仓库已有两个实例（commit-msg hook、派发 workflow 的红线断言），缺的是「编辑动作级」的 PostToolUse 型强制（如 protected paths 在编辑时就拦截，而非合流时才拦）。
3. **R6 是 fitness function 的本地产物，可推广为「文档契约测试」模式**：R6 绑定的是「BR 表 ↔ 探针」，同一模式可绑「operations.md 运维承诺 ↔ 代码现实」（Q3 即第一例）——文档里的每一句「只需改一处」都应该有一个会失败的测试守护。
4. **探针测行为、结构规则测形状，两层互补**：BR-11 的「身份只能经 setRoomName 写入」可部分下沉为 ast-grep 结构规则进 CI，探针保端到端行为不变——双保险且把发现时点从「探针跑时」提前到「lint 时」。
5. **规则集本身要走本仓库质量纪律**：正反例测试（commit-audit.test.ts 已是实践）、precision 预算、owner 与触发范围、「不为改而改」。AI 可以起草规则，但规则必须可机械验证才准入册。
6. **派发层强制力已验证**：本波 t-n4 漂移被司机 pane 取证拦截（人工），同型红线断言若沉淀为 workflow 脚本模板即成机械拦截——「人工拦截成功」恰是「该机械化」的信号。
7. **强制力分级映射派谁干活**：L1 交给 CI/hook（零上下文零漂移），L2 交给结构规则+席位，L3 交给对抗性评审——与「派谁决策树」同构，规则层级就是运行时选择。

## 五、候选行动项（唤醒时立票素材，全部未裁决）

| # | 候选 | 事实 | 形态 | 成本估计 |
|---|---|---|---|---|
| C1 | anti-patterns 条目加「机械化状态」字段 | 差距项散在文档无层级台账 | 文档字段（文档层/脚本层/门禁层/自动修层 + 下一层触发条件） | 小 |
| C2 | 文档契约测试（R6 推广） | Q3 的 operations.md ↔ route.ts 矛盾是第一例 | vitest：断言 route handler 不含 purgeStaleRooms 字面实参（或 ops 声明与 AST 一致） | 小-中 |
| C3 | ast-grep 进 CI | BR-11 部分断言可下沉为结构规则 | 新 CI job + rules/ 目录 + 正反例 fixture | 中 |
| C4 | eslint --fix / format 自动化 | lint script 无 --fix，无 format 层 | script 改造 + 一次性全仓 format commit（diff 噪声需主公裁决） | 小，但噪声取舍需裁决 |
| C5 | 派发红线断言模板化 | t-n4 型漂移靠司机人工拦截 | .omo/ 或 scripts/ 沉淀 workflow 脚本模板（diff 文件面 vs brief 白名单集合断言） | 小 |

## 六、唤醒条件与检索路径

- **唤醒触发**（任一即拉出本报告进 planning）：① 同类错误第 3 次重犯（三犯法则）；② t-n4 型派发漂移再犯；③ Q3 批注落地时顺手评估 C2；④ 主公点名「规则机械化」。
- **检索路径**：ZCode 记忆索引「规则机械化调研待命」条目 → 本文件。
- **建议第一步**：读 §五候选清单 → docs/requirement-intake.md 对齐 → `$omo:ulw-plan` 立票（候选间正交，可单票可组合；C2 与 Q3 补丁同波最顺）。
- **本次调研用过的检索词**（复搜起点）：AGENTS.md standard enforcement 2026 / ast-grep YAML rule autofix / Claude Code hooks deterministic guardrails / AI code review learnings conventions / LLM lint rule synthesis / Uber Fixit autofix。

## 参考链接清单

**AGENTS.md 标准**：[规格与写法（asdlc.io）](https://asdlc.io/practices/agents-md-spec) · [The Agent-Native Repo（Harness.io）](https://www.harness.io/blog/the-agent-native-repo-why-agents-md-is-the-new-standard) · [LLVM RFC: AI tool policy](https://discourse.llvm.org/t/rfc-llvm-ai-tool-policy-agents-md/91712) · [vs .cursorrules vs Claude Skills（2026）](https://blog.buildbetter.ai/agents-md-vs-cursorrules-vs-claude-skills-2026-comparison) · [Tembo: What is AGENTS.md](https://www.tembo.io/blog/agents-md) · [生产仓 6 例（securityboulevard）](https://securityboulevard.com/2026/06/6-agents-md-examples-from-real-production-repos)

**Hooks / agent 强制**：[Claude Code Hooks 官方指南](https://code.claude.com/docs/en/hooks-guide) · [Hooks 101 课程](https://academy.claude.com/courses/claude-code-101/hooks) · [Deterministic Layer（blakecrosley）](https://blakecrosley.com/blog/claude-code-hooks-explained) · [Production Setup（ronveen）](https://ronveen.com) · [Policy as Code（ranjankumar）](https://ranjankumar.in/hooks-policy-as-code-agent-enforcement) · [Permissions 与 hook 交互（anomity）](https://anomity.ai) · [完整指南（hidekazu-konishi）](https://hidekazu-konishi.com/entry/claude_code_hooks_complete_guide.html) · [Skills vs Hooks vs Prompts（explainx）](https://explainx.ai)

**结构规则 / 自动修复**：[ast-grep Cheatsheet](https://gist.github.com) · [AST-aware structural search & rewrite（266d）](https://266d.com) · [ast-grep Skill](https://github.com) · [ast-grep MCP 深入（skywork）](https://skywork.ai) · [Semgrep CHANGELOG（autofix）](https://github.com/semgrep/semgrep/blob/develop/CHANGELOG.md) · [Fixit（见 static-analysis 清单）](https://github.com/analysis-tools-dev/static-analysis)

**AI 评审**：[CodeRabbit](https://www.coderabbit.ai) · [Qodo Academy](https://qodo.ai/academy/ai-code-review) · [Greptile vs CodeRabbit vs Qodo（levelop）](https://levelop.dev) · [How CodeRabbit built its agent（Google Cloud）](https://www.coderabbit.ai)

**规则合成 / 元层**：[Can LLMs Demystify Bug Reports?（arXiv, Plein 2023）](https://arxiv.org) · [Style Specs + Self-Checking Linter（dev.to）](https://dev.to) · [Custom Linter for AI Code Generation（zenn.dev）](https://zenn.dev) · [AI-Powered Linter（dev.co）](https://dev.co)
