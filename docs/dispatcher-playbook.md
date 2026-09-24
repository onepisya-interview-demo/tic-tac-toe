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
- **派发 brief 正文一律中文**（dispatcher-author prose default 中文）。技能触发行（`@lark-...` 等以 `@skill:` 开头的触发指令）与外部 prompt 模板原文豁免——只对调度者自写的「做什么 / 验收 / 不做」段钉中文。brief 漂移实证：history plan 中文占比 1%–60% 不等（`ulw-reset-store-outcome-error.md` 几乎全英文、`ulw-modal-collision-and-error-alerts-20260923.md` 英文骨架 + 中文正文）。R7 是 commit 端的中文硬门禁；brief 端的中文要求与 R7 配套，闭环。
- **优化类工单「0 win（书面证明）」与「N win」同等合法**。

## 意图锚定与防漂移（2026-09-22 新增）

> 依据：主公反复实测「AI 意图理解漂移是最大问题」+ llm-wiki 漂移科学蒸馏（`agent-rule-decay` / `goal-register` / `attention-dilution-vs-context-poisoning` / `agentic-pipeline-contract-integrity`）。核心事实：**规则不是被违反而是被后续 token out-voted——约 15 次 tool call 后 system prompt 规则可靠失效，全程无报错（green-dashboard failures）**。派发时绑定意图只是起点，防漂移是全程协议。

### 派发绑定（起点）

- brief【验收标准】段必须**引用 plan 意图块的 Scenario 编号**（`docs/requirement-intake.md` §4.3），不写自由散文验收——子代理 teach-back 复述的是 Scenario，不是任务描述。
- teach-back **两阶段**：开工复述（现有）+ **交付复述**（交付时逐条对照 Scenario 声明「哪条做到了、证据是什么」）。

### 执行中重锚定（对抗 15-call 衰减）

三个已验证修法（agent-rule-decay 实证），按场景选用：

1. **约束搬到动作时刻**：关键约束改写成动作发生前的 gate 步骤（探针 / hook / 门禁），使其成为 context 中最新近内容——`agent-rule-decay` 修法①。
2. **肯定式改写**：「禁止 X」衰减快，「要求执行的动作 Y」在 transcript 留痕——负面清单与肯定式验收动作并存（负面清单防越界 + 「交付前输出 git log -1」类动作钉住约束）——修法②。
3. **风险步骤前重注入**：调度者轮询（估算÷5 间隔）发现下一步涉及红线/高危面时，**重发意图块 Scenario** 而非自由文字纠偏——修法③。
4. **长任务锚定节奏**：单 session 预估超过 ~15 tool call 的关键路径，在中途 checkpoint 重申意图场景；herdr `/goal` 即运行时目标寄存器（goal-register 实证：73+ turns 无漂移 vs 传统注入 15-20 turns）。

### 漂移分型处置（先诊断再开药）

| 分型 | 症状 | 处置 |
| --- | --- | --- |
| **注意力稀释**（可治） | 忘早期约束、拿过时方案继续改、但方向大体对 | 重锚定：重发意图块 + 重读关键文件；必要时 summarize → 新 session（衔接 [herdr-session-hygiene](./herdr-session-hygiene.md)） |
| **上下文中毒**（难治） | 早期错误假设被反复加固、自我纠错后继续错（self-deterioration） | **弃会话重启**：不要在错误会话里辩论——summarize 已验证事实 → 新 session 按摘要重启（plan-then-new-session）；中毒后 compact / 自我纠错反而更糟 |

判据：重锚定一次后同类偏差复现 → 升级判中毒 → 重启。

### 机器锚点优先（enforcement 在 system level）

- 能变成确定性门禁的约束（探针 / commit-audit / hook / `git status` 越界检查）**绝不依赖 LLM 记忆**——探针没有上下文，所以不会漂。
- 独立验收（auditor.acceptance / 调度者复跑）本身就是漂移对策：**验证者与执行者不同 session**，执行者的意图衰减不影响验收通道。
- 完成契约：done = proven, not claimed——按可验证证据（门禁绿 / 探针 PASS）判定，不按模型自述。

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

## 多席并行与交叉审（2026-09-23 新增）

- **并行正解 = git worktree 隔离**：任务按「文件面零交集」切正交后，调度者预建 N 个 worktree（各开分支 + 串行 `pnpm install`），herdr `tab create --cwd` 直指各 worktree，多席 fresh session 并行互不污染；完成后主仓 cherry-pick 序列合入（文件面零交集时冲突率为 0）+ 统一终验。同一 worktree 多席并行写必然互踩，不要试。
- **双盲审**：修复席与审查席分离（各自 fresh session），每席深审一案；审查 brief 预埋「假绿来源清单」（rAF×fake timers、事件派发属性、mock 形状、SSR stub 污染、cleanup 残留），让 reviewer 逐项正面核查而不是复述执行席自报。
- **REJECT 闭环**：reviewer REJECT → 调度者**亲自验证证据** → 同 worktree 起新席整改（brief 直接带已验证的证据链，禁止 re-查证浪费）→ 整改 commit 由调度者复核 diff 后 cherry-pick 合入。REJECT 根因若在调度者 brief 的前提错误（实证：'not-found' 死键误判），如实认领，不甩执行席。
- **语言一致性**：plan 正文与 commit subject 默认中文（Goal / Scope / WHY 等骨架词可英文）。实证：brief 不钉语言时，各执行席漂移程度从 1% 到 60% 中文占比不等（`ulw-reset-store-outcome-error.md` 几乎全英文、`ulw-modal-collision-and-error-alerts` 英文骨架+中文正文）；历史 plan 惯例约 65% 中文。commit 端已升级为 commit-audit 机械规则 **R7**（2026-09-23 主公裁决 A+B 组合落地，commit 3068b22）；brief 端的中文要求与 R7 配套闭环。

## Session 单一事则与正交性矩阵（2026-09-24 新增）

> 依据：主公三条主张 + wayfinder 体系对齐。完整推导、本波实证复盘表与裁决记录见 [`.omo/research-session-orthogonality-20260924.md`](../.omo/research-session-orthogonality-20260924.md)；wayfinder 试点地图见 [`.omo/plans/ulw-rooms-race-map-20260924.md`](../.omo/plans/ulw-rooms-race-map-20260924.md)。

- **Session 单一事则**：一个 session 只做一件事；「事」的计量单位是**上下文容量**——所需全部上下文（代码面 + 决策史 + 被检对象）装得进一个干净会话且不互相稀释。做不好 → 继续拆小到单会话闭环。判定测试：**上下文域是否在会话内连续生长**——连续生长的多域探索（如 rooms-race 调研）算一件事，不因「摸了多个领域」而违反单一事则。
- **探索先行，执行后置**：能精确陈述问题才立票（禁预切片）；地图（票面 + 雾区 + 决策）先行，派发只认地图票面；「想直接开干的冲动 = 该继续探索的信号」。
- **正交性 2×2 判定矩阵**（拆不拆 session 按共享上下文判断，不按任务内容判断）：

| | 工作/检查方式相同 | 工作/检查方式不同 |
|---|---|---|
| **共享上下文** | 同 session 串行做（省上下文重建税） | **强制拆 fresh session——仅限对抗性评审**（D5：强制力来源是评审独立性——模型自身有偏见与漂移；非对抗场景不强制拆，但关键裁决仍应交外部新鲜眼睛） |
| **上下文正交** | 可并行（为墙钟速度；worktree 隔离） | 隔离并行的最大价值区（异镜头各占干净会话，被检对象重叠也不合并） |

- **派发前三问（brief 模板必答，写进派发记录）**：① 这张票与哪一席共享上下文？（共享 + 同方式 → 同 session 串行；共享 + 异方式对抗 → 强制 fresh）；② 检查/工作方式是否异镜头？（异镜头 → 隔离会话，上下文开销是必要的）；③ 预估上下文容量是否单会话闭环？（装不下 → 拆票，不塞）。
- **验证性工作默认隔离**：检查强度 > token 成本；「自我确认不是确认」——hunter 不得兼任 confirmer（独立复核换人换会话）。

### wayfinder 试点复盘（2026-09-24，地图 ulw-rooms-race-map）

**接线方式（定式）**：地图 = 本地 markdown tracker（`.omo/plans/ulw-*-map-*.md`，Destination + Session 票面 + Decisions 编号 + 雾区 F 编号 + Out of scope）；票面即 brief 的唯一素材（自包含，不引用会话上下文）；开雾票（判据性实验）由调度者亲自先跑，毕业雾区后才派发依赖票；裁决以 D 编号累积在地图内；每票落地后票面回填 commit 指针。与 omo ulw 流程兼容：席位仍走 `$omo:ulw-plan`，地图取代「口头 decree」成为票源真源。

**试点实证的三条教训**：

1. **「票被静默跳过」必须升级为 finding**——自动化派发脚本的条件分支若依赖司机自报的字符串格式（如 cherry-pick 清单是否含分支名），判否即静默跳票。机械判定要用结构化字段；汇总报告必须逐票核对落地状态，缺一张票 = 波次未收口。
2. **席位技能可能自带审批门**——`$omo:ulw-plan` 流程会写完 plan 后停机等 approve 关键字（三轮无响应自落 blocked）。派发 brief 应声明「审批权已前置授予地图裁决，plan 落盘即视为已批」；或调度者备好 approve 关键字及时解阻（勿重发原 brief）。
3. **席位可能漏提交 plan 文件**——commit footer 的 `Plan:` 指向的文件必须随波入仓；调度者收尾核对每个 footer 指向的文件存在，缺失即调度者入档补齐（不改写席位 commit）。

**复审的复利实证**：T-D 交叉审的 d-F5（step 6 断言可能静默跳过）在收口修复第一跑即暴露更深一层的假绿——探针 POST 走 APIRequestContext 绕过页面网络栈，SW 拦截断言从未真实生效。异镜头审查抓到的不是「这一处错」而是「这一类断言通道不可信」，验证了「验证性工作默认隔离」的成本正当性。
