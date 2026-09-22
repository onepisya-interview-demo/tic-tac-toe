# Dispatcher Playbook

> 来源：AGENTS.md §调度者（行 178–192）+ §运行时能力边界（行 186–192）

调度者只做拆解、派发、轮询、独立验收、收尾沉淀，几乎不亲自写主线代码。本文件是四层职责与可复用模板的完整展开。

## 调度者金训

- 大 plan 以「一个调度者 + 多个正交委托代理」执行：调度者只做拆解、派发、轮询、独立验收、收尾沉淀，几乎不亲自写主线代码。
- 委派协议：接收方先用自己的话复述任务与验收标准（teach-back）再动手；任何委托产出在独立验证前一律视为未完成。

## Intake 五维与 Plan 状态机

- **plan 起草前 intake 五维必答**（范围/深度/形态/边界/验收），未答不起草；需求名词先映射 `CONTEXT.md`（词汇步）；plan 状态机 `drafting → aligned → ready-for-approval → executing`，aligned 门 = 主公对 Given-When-Then 验收场景复述确认一致（不是「没说不行」）；「待 X 触发 Y」分叉必带触发判据 + 悬置成本 + 降级路径。
- 完整协议见 [docs/requirement-intake.md](./requirement-intake.md)（2026-09-22 质量加固波 W-RF 蒸馏，复盘实证见 [docs/retro-2026Q3.md](./retro-2026Q3.md)）。

## Brief 硬性负面清单

- **brief 末尾必带「本任务不做」段**（不动哪些文件/不发起哪些动作/不产出哪些产物）——W-AB 首席漂移实证：补负面清单后重派一次通过。
- **长报告落盘 + 终端摘要双通道**（防 herdr scroll buffer 截断）。
- **commit-audit 隐性规则进 brief**（subject 避免大写开头、header ≤100 字符）。
- **优化类工单「0 win（书面证明）」与「N win」同等合法**。

## 四层职责 / 工具面 / 派发结构 / 轮询节奏

完整可复用模板（四层职责 / 工具面 / 五段派发结构 / 轮询节奏 / 升级规则 / 反模式 / 单 session 拆分四问 / 调研路径 L1 先行）见 [`.omo/plans/dispatcher-roles-retrospective.md` §4](../.omo/plans/dispatcher-roles-retrospective.md)。

## 运行时能力边界与任务分派（2026-09-18）

- **任何委派先匹配「任务类型 ↔ 运行时工具面」**；真源 `~/.hermes/references/ag-agent-runtime-capability-boundaries.md`（Router 镜像 `~/.hermes/AGENTS.md` § 2 第 21 条）。
- **速查**：
  - **Pi**（0 插件 = bash/read/write/edit）：只接单文件小修 / 脚本验证 / 小样板，禁派跨文件重构（无 LSP）。
  - **omp**（LSP+DAP+哈希锚定）：接跨文件重构 / DAP 排错 / 调用链追溯。
  - **宏大长程目标先拆解**，不直派任何单会话 runtime。
- **验收与 runtime 解耦**：不管谁执行，[验证六层](./commands.md#验证六层) 全绿才准提交；能力差异只影响「谁来写」，不影响「怎么验」。
- **视觉/UI 验证**：走仓库内 `tests/qa/*.mjs` headless 探针（断言 data-testid 与网络行为）+ 截图由多模态模型直读；默认态无浏览器工具不构成障碍。
- **高危面任务**：`lib/game.ts` / `lib/store.ts` 高危面任务优先派带 LSP 与完整测试工具面的 runtime，或由调度者代跑 on-demand 三层（coverage / mutation / property-based）；低能力 runtime 不得以「语法正确」宣布完成。

## 设计记录先行

`.omo/plans/` 设计记录先行 + wave 拆解与 wayfinder「地图 + 工单」同构：plan = 地图，wave/task = 工单；每个子任务新开干净 session（见 [docs/herdr-session-hygiene.md](./herdr-session-hygiene.md)）。

设计记录真源：[`.omo/plans/agent-runtime-boundaries.md`](../.omo/plans/agent-runtime-boundaries.md)。
