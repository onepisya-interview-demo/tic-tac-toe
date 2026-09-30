# Plan: 意图锚定体系（意图块 BDD 化 + 防漂移协议）

- 日期: 2026-09-22
- 状态: 已实现（81ee7b9 2026-09-22 docs(intake) 意图锚定四文档落地；状态线 2026-09-26 按 git 实况修正）
- 分支: dev
- 上游: 合并弹框事件（`ulw-home-merge-trigger-spec-20260922.md`）引发的意图约束调研

## 一、命题

把「用户意图的定义与执行中的保持」约束化：意图怎么写（BDD/SDD 外部调研）+ 意图怎么在长任务中不漂（llm-wiki 漂移科学）。结论：**意图真伪归 aligned 门（人），形式与可执行性流程化**。

## 二、证据

- 外部：Gherkin v6 `Rule`（Feature→Rule→Scenario）、EARS（Kiro）、SDD 三层级 spec-first/anchored/as-source（Böckeler/Fowler）、SBE 十年（反面场景 + 自动化缺位教训）。
- llm-wiki（双子代理侦察，路径 `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/meeting/llm-wiki`）：`agent-rule-decay`（15 tool call 规则衰减 + 三修法）、`goal-register`（73+ turns 无漂移）、`attention-dilution vs context-poisoning`（漂移两分型）、`agentic-pipeline-contract-integrity`（enforcement 必须 system level）、`ticket-as-contract`（字面读者假说 + What Stays the Same）、`spec-driven-development-attribution`（Delivery beats presence，23.8%→45%）。

## 三、改动

1. `docs/requirement-intake.md` §4.3 意图块（三层 + 反面必备 + 保持项 + 探针映射 + BR 编号绑定）+ §4.4 规模双模式 + 自检清单/硬化表同步
2. `docs/dispatcher-playbook.md` §意图锚定与防漂移（派发绑定 / teach-back 两阶段 / 重锚定三修法 / 分型处置 / 机器锚点优先）
3. `docs/business-rules.md` 探针闭环强制（留空禁引用为已对齐）
4. `docs/anti-patterns.md` L1-29（执行中漂移）

## 四、验收

- 六层：vitest/typecheck/lint 绿；build 略过（L2-13 dev 服在线，docs-only）
- commit-audit message PASS
- 使用验证（后续 wave 自然回测）：下一个行为类 plan 走意图块模板 + 派发引用 Scenario 编号；首例执行中漂移按分型协议处置

## 五、红线

- aligned 门仍是意图真伪唯一裁决层；不动 AGENTS.md 既有结构与六层门禁
