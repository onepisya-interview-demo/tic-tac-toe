# Plan: evals-mcp-practice-map（评测与 MCP 练习地图调研入档）

日期：2026-09-18
状态：docs-only 调研入档，无代码变更

## 目标

把「AI 评测 / 控制面岗位调研 → 本仓库可实践的落地方案」沉淀为 docs/ 单一文档（docs/evals-mcp-practice-map.md），作为后续 wave（evals/ 目录、MCP server、控制面硬化）的设计输入。

## 调研工具与方法

mmx search（MiniMax）×3 查询（MCP TS SDK / evals 框架对比 / LLM 井字棋先例）+ WebFetch 全文读 Anthropic《Demystifying evals for AI agents》+ mcporter v0.13.10 本机实操（list / record / replay help）+ 内置 web search 交叉验证博客 URL。信源与置信度分级见文档 §5。

## 选项取舍

- **放 docs/ 而非 .omo/plans/**：这是给人读的调研 + 路线图（docs/ 既有定位是面向人的记录），不是单次实现的设计记录；后续各 wave 动手时各自再写自己的 plan（本文件只覆盖「调研入档」这一步）。
- **自研最小 harness 优先于引入 Promptfoo / DeepEval**：TS 栈匹配 + 面试叙事价值更高；框架仅作设计对照（文档 §1.3），不进依赖。
- **LLM 对手后端先 MiniMax-M3**（本机 mmx CLI 已认证），报告要求 provider 抽象留切换位。
- **P1–P5 排序依据**上一轮岗位调研的「最短路径」结论（应用层 evals + 国内 Agent 平台族）。

## 禁止事项

- evals 相关代码（未来 wave）不得让 vitest 默认跑网络调用——LLM 对手必须可注入 fake provider。
- 本 plan 与文档不改变任何生产路由、门禁或浏览器行为。

## 提交约定

docs(research) 单提交，带全套 lore trailer + 本 Plan footer。
