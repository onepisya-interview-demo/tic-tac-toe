# 评测（Evals）与 MCP 练习地图：岗位调研 → 本仓库落地方案

> 生成时间：2026-09-18
> 性质：求职导向的仓库练习路线图（调研 + 建议），非产品文档。
> 信源口径：全部联网调研为 2026-09-18 现查，工具为 mmx search（MiniMax 搜索）+ WebFetch 全文阅读 + mcporter 本机实操；置信度标注见 §5。

## TL;DR

本仓库是「应用层 evals + 控制面」岗位方向的现成练习场：`lib/game.ts` 纯函数面就是确定性 code grader，API 面零鉴权零限流是控制面空白画布，本机 mcporter 自带 record/replay（全链路回放）能力。联网调研三大发现：① Anthropic 官方 evals 方法论给出可直接套用的双轨设计（capability / regression）；② 「LLM 下井字棋」有学术先例（ChildPlay 论文：GPT-4o 最高 92% 胜率，无一达到 minimax 基线 99.6%）——证明这个练习场的区分度真实存在，不是玩具自嗨；③ evals 赛道 2026 年被大厂密集收购（OpenAI 收 Promptfoo、ClickHouse 收 Langfuse、Cisco 收 Galileo），岗位判断被资本市场确认。

---

## 1. 联网调研发现（2026-09-18）

### 1.1 方法论一手源：Anthropic《Demystifying evals for AI agents》（2026-01-09）

全文已读（anthropic.com/engineering/demystifying-evals-for-ai-agents），可直接套用到本仓库的要点：

| 要点 | 原文口径 | 对本仓库的映射 |
| --- | --- | --- |
| 双轨 evals | capability evals 初始通过率应低（爬坡目标）；regression evals 通过率应近 100%（防退步）；能力 eval 毕业后转入回归套件 | 「LLM 能否赢随机对手」是 capability；「minimax 基线永不送胜」是 regression |
| 三类 grader | 代码 grader（快/便宜/可复现）、LLM judge（灵活/需校准）、人类 grader（金标准/贵） | `lib/game.ts:checkWinner` 是 code grader；LLM-as-judge 复盘棋局是第二层 |
| pass@k vs pass^k | pass@k = k 次内一次成功（工具类）；pass^k = k 次全成功（面向用户要一致性） | 井字棋是面向用户场景，应报 pass^k（100 局全胜率）而非 best-of-k |
| grade 产出而非路径 | 检查工具调用顺序太脆弱，惩罚合理创造性 | 只判胜负与合法性，不判「LLM 先手是不是按你预期顺序思考」 |
| 起步规模 | 从真实故障转化的 20–50 个任务就够（早期效应量大） | 先建 8–20 个固定局面 case（必堵/必赢/陷阱），不上来就大规模 |
| CI 集成 | evals 当 unit test 维护，每次提交跑；新模型发布跑全套 | 井字棋 case 集进 vitest 或独立脚本，模型升级时重跑 |
| 任务无歧义 | 两位专家独立判应得一致 pass/fail；配 reference solution 验证可解 | 井字棋规则天然无歧义——这是选它做第一个 eval 对象的核心理由 |

### 1.2 学术先例：ChildPlay 论文证明区分度真实

《Evaluating Large Language Models Beyond Textual Understanding with ChildPlay》（arXiv 2407.11068）实测 LLM 下井字棋/海战棋/四子棋（对手为 minimax）：

- GPT-4o 在 temperature 0.5 达最高胜率 92%；GPT-4 为 77%；GPT-3.5 为 53%；GPT-4o-mini 为 61%。
- **没有任何模型达到 minimax 基线 99.6%**——确定性基线永远有区分度。
- 温度越高胜率越低；**模型代际更新与胜率不单调**（海战棋上 GPT-3.5 反而最好）——正是「为什么需要回归 evals」的实证。
- 结论：井字棋作为 LLM eval 对象有学术级先例，胜率数字可直接作为我方实验的对照参考系。

### 1.3 evals 框架格局：2026 收购潮确认赛道

| 框架 | 现状（2026-09） | 对本项目的适配 |
| --- | --- | --- |
| Promptfoo | 开源 CLI（YAML case + CI 友好），**2026-03 被 OpenAI 收购** | TS 生态最顺手；但被收购后走向需观察 |
| DeepEval | Confident AI（YC W25），Python/pytest 系，Apache 2.0 | 本仓库是 TS 栈，需跨语言，仅作方法论参照 |
| OpenAI Evals | MIT 原祖（2023-03），dev-time harness，偏 OpenAI 生态 | 词汇表来源（dataset/run/grader），不必直接用 |
| Langfuse | 开源 observability，**2026-01 被 ClickHouse 收购** | 自托管 tracing 可选，对本项目过重 |
| Galileo | 企业 agent observability，**2026-04 被 Cisco 收购**（并入 Splunk） | 企业向，非本项目范围 |

**判断**：赛道被资本市场确认（三起收购集中在 2026 Q1–Q2），但工具全部不必引入——本仓库练习价值恰恰在**自研最小 harness**（几百行 TS），面试叙事远强于「我会调 Promptfoo 的 YAML」。框架只用于对照设计。

### 1.4 MCP 工程面：SDK 现状与 mcporter 实操

- **官方 TS SDK**：`@modelcontextprotocol/sdk` + `zod`，`new McpServer({name, version})` + `server.tool(name, description, zodSchema, handler)`，本地 stdio（StdioServerTransport）、远端 StreamableHTTPServerTransport。井字棋 nine tools 一个下午可成。
- **mcporter**（steipete，v0.13.10 本机已装）：TypeScript MCP 运行时 + CLI，本机已注册 23 个 server（21 healthy）。核心能力与本仓库练习的对应关系：
  - `list --schema`：server/tool 发现与契约查看——「Tool Contract」活样本（滴滴 JD 逐字词）。
  - `call server.tool key=value`：不经客户端直接调工具——MCP server 的 curl 等价物，QA 探针素材。
  - **`record` / `replay`：MCP JSON-RPC 流量录制到 NDJSON + 确定性回放**——对应美团评测基建七能力的「全链路回放 + 回归机制」两格，现成工具，无需自研。
  - `generate-cli` / `emit-ts`：从 server 生成独立 CLI / TS types——「一份实现，多形态出口」的平台工程思维样本。
  - `serve`：把多 server 聚合为一个 MCP server——网关/聚合形态微缩样本。

---

## 2. 本仓库实践地图（文件级映射）

### 路线 A：evals/ 目录 + LLM 对手（第一优先，补 gap：评测方法论 + 统计实验设计）

已有资产（不需要新建）：
- `lib/game.ts` —— 纯函数规则引擎，零 React/DOM/I/O。`checkWinner`（lib/game.ts:26）= 无争议 code grader；`getAvailableMoves` = 合法性围栏；`randomizeFirstPlayer(rng)` 已注入 RNG——测试面友好。
- `lib/game.property.test.ts` —— fast-check property-based 已在（生成器+收缩思维即 eval 思维）。
- `tests/qa/lib/win-drive.mjs` —— 胜局驱动器（胜局探针 0,3,1,4,2 契约）。

新建（建议结构，动手前先写 `.omo/plans/` 设计记录）：

```
evals/
├── harness/           # 最小评测 runner：case 集 × 对手 × N 局 → 结果 NDJSON
├── opponents/
│   ├── minimax.ts     # 确定性基线（不可战胜 = regression 锚点）
│   ├── random.ts      # 弱基线（capability 爬坡起点）
│   └── llm.ts         # LLM 对手（OpenAI 兼容接口；本机可先用 mmx/MiniMax-M3）
├── cases/             # 固定局面 case：必堵 / 必赢 / 陷阱（Anthropic 口径 20-50 起步 → 先 8-20 个）
└── reports/           # 胜率 + Wilson 置信区间 + 每步延迟/非法落子率
```

四层指标直接对齐美团口径：结果层（胜率 pass^k）、过程层（非法落子率/补堵漏率）、效率层（每步延迟/token 花费）、风险层（越界坐标/幻觉）。统计部分（置信区间、显著性、A/B）融在 reports 里，不单独立项。

### 路线 B：MCP server 包井字棋（第二优先，补 gap：MCP 全家桶）

- tools 映射现成导出：`new_game` / `get_board` / `make_move`（内调 `applyMove` + `checkWinner`）/ `get_stats`。stdio 起步。
- 用 `mcporter list <name> --schema` 验契约、`mcporter call tictactoe.make_move index:4 player:X` 做无客户端 QA、`mcporter record/replay` 做「改规则后的确定性回归」——把 mcporter 写进 QA 探针层。
- 进阶：接线上受控写入口，让 Claude 通过 MCP 真下棋——同时覆盖「MCP + 工具鉴权 + 审计」三件 JD 要求。

### 路线 C：控制面硬化（第二优先并行，对齐国内平台族 JD）

现状：`app/api/player-session/route.ts`（71 行）与 `app/api/solo-stats/sync/route.ts`（115 行）经 grep 验证零鉴权、零限流、零审计。三步：
1. per-name rate limit（sync/outcome）——JD 字面词「限流」。
2. 服务端 idempotency key——现在防 double-count 全靠客户端哨兵 `ttt.solo.last-merged-local.v1`，服务端盲；把幂等从约定升级为强制。
3. audit log 表（落子/同步/登录事件）——滴滴 JD 逐字词「工具调用审计」。

已有可讲资产：`lib/player-name.ts:isPlayerName` 与 handler `normalizeName` 单一真相契约（DRIFT = 422 坏 UX）；commit 六层门禁 + Stryker 变异 = 「评测准入门禁 + 回归机制」的既有实践；AGENTS.md 反模式区每条带实证编号（B-1/B-2/W1）= 「badcase → 归因 → 固化契约」闭环。

---

## 3. 未来建议（分阶段 roadmap）

| 阶段 | 内容 | 产出物（= 面试弹药） | 预估 |
| --- | --- | --- | --- |
| P1 | evals/ harness + minimax/random 基线 + 固定 case 集 | 「确定性动作归代码、模糊判断归模型」分层叙事 + 首份胜率报告 | 1–2 周 |
| P2 | LLM 对手接入（provider 抽象，本机先用 MiniMax-M3）+ 跑 N≥200 局 | 胜率/置信区间/温度对照——对标 ChildPlay 论文数字 | 1 周 |
| P3 | MCP server（stdio）+ mcporter 接入 QA（list/call/record/replay） | 可演示的「Claude 玩我的井字棋」+ 回放回归脚本 | 3–5 天 |
| P4 | 控制面三步硬化（rate limit → idempotency → audit） | 「我把客户端哨兵升级为服务端强制」的治理叙事 | 1 周 |
| P5 | 评测 dashboard（React 读 reports/）+ LLM-as-judge 复盘对齐率 | 正中 PTC JD 加分项原文的 demo | 择机 |

顺序依据：调研报告最短路径 = 应用层 evals + 国内 Agent 平台族；P1/P2 一次补三个 gap（评测框架、统计实验、eval 分层显性化），且本仓库本就是 portfolio（homepage 指向 onepisya-interview-demo），练习与求职材料是同一份。

边界与红线（沿用仓库既有契约）：
- P1–P2 全部走 vitest/独立脚本，不碰生产路由；P3 MCP server 独立目录、不改 `/play` 现有行为；P4 动 API 前先读 Next.js 16 自动警告块并跑六层门禁。
- evals 目录若进主仓，`pnpm vitest run` 不应因网络依赖（LLM API）变红——LLM 对手测试用注入 fake provider，真实调用只在显式脚本里跑。
- 非平凡提交遵守 docs/commit-policy.md（Plan footer + lore trailer）。

## 4. 与岗位调研报告的 gap 对账

| 调研报告 gap | 本方案覆盖 |
| --- | --- |
| 1. 统计与实验设计 | P2 胜率实验（Wilson 区间、显著性、N 局设计） |
| 2. 开源评测框架动手 | P1 自研 harness（对照 Promptfoo/OpenAI Evals 设计）；React dashboard 在 P5 |
| 3. 下棋 demo 显性化 eval 分层 | P1/P2 全程；路线 A 即该 gap 的直接落地 |
| 4. MCP 协议上手 | P3（且 mcporter record/replay 超出「搭一个 server」的基础要求，多覆盖「全链路回放」一格） |

## 5. 信源与置信度

| 来源 | 类型 | ts | 置信度 |
| --- | --- | --- | --- |
| Anthropic《Demystifying evals for AI agents》（全文已读） | 一手 | 2026-09-18 | high |
| ChildPlay 论文（arXiv 2407.11068，实验表直读） | 一手（学术） | 2026-09-18 | high |
| evals 框架对比与收购时间线（completionkit 汇总页） | 二手 | 2026-09-18 | medium（收购动作建议提交前各验证一次官网/公告） |
| MCP TS SDK 教程（agentready.it.com 等 2 篇） | 二手 | 2026-09-18 | medium（API 细节以官方 SDK 文档为准） |
| mcporter v0.13.10 本机实操（help + list + record/replay） | 一手实操 | 2026-09-18 | high |
| 本机 MCP 注册表（23 server） | 一手实操 | 2026-09-18 | high |
| mcporter 项目定位（HN + agentskills.market 摘要，作者 steipete） | 二手 | 2026-09-18 | medium |

absent 显式标注：MiniMax-M3 作为 LLM 对手的成本/延迟未实测；Promptfoo 被 OpenAI 收购后的许可走向未知；国内平台族 JD 原文（字节/滴滴）来自上一轮调研的二手摘要，本轮未重新核验。
