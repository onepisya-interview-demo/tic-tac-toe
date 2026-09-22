# AGENTS.md 调度者节增补建议行（W-RF 蒸馏产物四 · 草案）

- 日期：2026-09-22
- 作者：W-RF 蒸馏席（distiller）
- 工单：W-RF（`ulw-quality-hardening-opt-20260922.md` §六.2 沉淀方向 7 + §九审批门升级）
- 性质：**草案**——本文件列出 AGENTS.md §调度者 节可新增的条目供调度者收口选用；**不直接修改 AGENTS.md**（消化路径由调度者按 AGENTS.md 维护契约收口）
- 来源：本次蒸馏的三件产物（`docs/retro-2026Q3.md` / `docs/requirement-intake.md` / `.omo/plans/dispatcher-roles-retrospective.md` §4.1-4.5）汇总

## 一、AGENTS.md 调度者节建议新增条目（按行级，每条 ≤3 行）

### 1.1 intake 五维必答

> 调度者起草 plan 前必答五维（范围/深度/形态/边界/验收）。**未答不起草**——五维任一空白不进入 drafting 状态。详见 `docs/requirement-intake.md` §二。

### 1.2 词汇步必走

> 需求名词先映射 CONTEXT.md；三态处置（命中 preferred / 命中 `_Avoid_` 替换 / 未命中入 Pending 或御定）。plan 必含「词汇映射表」段。

### 1.3 aligned 门为强制门

> plan 状态机 `drafting → aligned → ready-for-approval → executing`；aligned = 主公对 Given-When-Then 验收场景复述确认「一致」，**不是「没说不行」**。状态行枚举固定。

### 1.4 事实依赖三必填

> plan 内「待 X 触发 Y」分叉必含三必填：触发判据 + 悬置成本 + 降级路径。三必填不全不进 plan 草案。preload 波 8 天悬置即反面教材。

### 1.5 调研路径 L1 先行

> 「为什么类」问题先外部已知证据检索（L1：上游 issue / 官方文档 / 学术论文），内部复现矩阵（L2）降级为确认手段，启发式推断（L3）标 `[inferred]`。

### 1.6 单 session 拆分四问

> 派发前回答：上下文预算 / 文件面窄 / 判据可跑 / 产物交接——任一为否即回拆。本波 §四「拆分原则」已固化，操作判据见 `.omo/plans/dispatcher-roles-retrospective.md` §4.1。

### 1.7 brief 硬性负面清单

> brief 末尾必带「本任务不做」段——明确「不动哪些文件 / 不发起哪些动作 / 不产出哪些产物」。W-AB 漂移实证：补负面清单一次通过。

### 1.8 长报告落库双通道

> 长报告（≥500 行）落盘 + 终端摘要（≤200 字）——防 herdr pane scroll buffer 截断丢失全文。报告落点必带绝对路径。

### 1.9 commit-msg hook 隐性规则进 brief

> brief 必列 commit-audit.mjs 5 条 R1-R5（Conventional 前缀 / ≤100 chars / WHAT+WHY+HOW / Confidence+Scope-risk / Plan footer）+ 项目约定（subject 首字母避免大写、中文 token 留英文）。

### 1.10 「0 win 合法完成态」

> 优化类工单的合法完成态含三选项：0 win（书面证明）/ mid win（保留 + 标注未行动项）/ N win（每项一个 commit）。**0 win 与 N win 同等合法**——席凭本能「挖一挖再交」是反模式。

## 二、建议增补位置

AGENTS.md 内**调度者节**（AGENTS.md §运行时能力边界 / §本项目反模式之后，§六层门禁之前）。

**段级建议**：

```markdown
## 调度者（多代理编排）

[既有 §运行时能力边界 内容]

[既有 §本项目反模式 内容]

**调度者必走协议**：
1. intake 五维必答（范围/深度/形态/边界/验收；未答不起草）——见 docs/requirement-intake.md §二
2. 词汇步必走（CONTEXT.md 映射 + 三态处置）——见 §三
3. aligned 门为强制门（Given-When-Then 复述确认，状态行枚举固定）——见 §四
4. 事实依赖三必填（触发判据 + 悬置成本 + 降级路径）——见 §六
5. 调研路径 L1 先行（外部已知证据检索优先）——见 §七
6. 单 session 拆分四问 / brief 负面清单 / 长报告落库双通道 / hook 隐性规则进 brief / 0 win 合法——见 .omo/plans/dispatcher-roles-retrospective.md §4.1-4.5

**禁止默认假设**：「没被反对 = 通过」不是对齐——是漂移结构的主入口。
```

## 三、消化优先级建议

| 优先级 | 条目 | 落地动作 |
| --- | --- | --- |
| **P0（首波消化）** | 1.3 aligned 门 | plan 模板 + commit-audit.mjs 扩展 |
| **P0** | 1.4 事实依赖三必填 | plan 模板 |
| **P0** | 1.7 brief 负面清单 | dispatcher-roles-retrospective.md §4.2 已落 |
| **P1（次波消化）** | 1.1 intake 五维 | dispatcher §4 委派协议升级 |
| **P1** | 1.2 词汇步 | plan 模板 |
| **P1** | 1.5 调研路径 L1 | plan 模板 |
| **P2（增量）** | 1.6 / 1.8 / 1.9 / 1.10 | dispatcher §4.1/4.3/4.4/4.5 已落，本文件仅锚定 |
| **P2** | 1.10「0 win 合法」 | brief 模板升级 |

## 四、与既有契约的衔接

- **AGENTS.md Router 形态**（AGENTS.md 自身说明）：本文不直接复制实现细节，仅列行级条目 + 指向蒸馏产物
- **CONTEXT.md**：本节 §1.2「词汇步」强化 CONTEXT.md 的消费路径
- **dispatcher-roles-retrospective.md**：§4.1-4.5 已落；本文件 §1.6-1.10 锚定其位置
- **commit-policy.md**：§1.9 与 commit-audit.mjs R1-R5 一致
- **verification-gauntlet.md**：未变更（6 层 Gauntlet 既有契约）

## 五、不在本次建议范围的相邻强化

主公/调度者收口时可考虑但本次未列入：

- **plan 模板（`docs/plan-template.md`）**：承载 §1.1-1.5 模板约束的具体文件——本文件仅指出「应新建」，未起草模板本体
- **commit-audit.mjs 扩展**：把「词汇映射表 + 事实依赖表 + L1 检索报告」纳入 Plan: footer 校验——本文件仅指出方向，未起草补丁
- **调度者 brief 模板**：本文件 §1.7 / §1.9 列出条目，模板本体由 dispatcher-roles-retrospective §4.2 / §4.4 承载

## 六、诚实边界

- 本草案**未回测**——本波为首次适用
- 升降建议的优先级由蒸馏席主观判断——主公/调度者收口时可重排
