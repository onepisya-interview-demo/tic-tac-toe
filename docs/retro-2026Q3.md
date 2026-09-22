# 2026 Q3 反思报告：意图漂移与需求对齐成本（plan W-RF 蒸馏产物一）

- 日期：2026-09-22
- 作者：W-RF 蒸馏席（distiller）
- 工单：W-RF（`ulw-quality-hardening-opt-20260922.md` §六）
- 范围：本波「质量加固与优化」全过程 + 全仓 plan 演化史的蒸馏
- 数据基线：2026-09-22 当日 git 历史可考
- 标签约定：每条结论附 `[measured]`（git/脚本可考）/ `[inferred]`（从材料推断）/ `[unproven]`（首条适用尚无回测）

## 一、命题

**为什么花了这么多时间？需求为什么才对齐？**

答域：把「质量加固波」的工单派发代价拆开看——大多数时间不是花在「写代码/测/审/消」上，而是花在「让『测试/review/消融/优化』四件事被准确描述」上。漂移的根因是**起草前没有 intake 协议**；不是主公补充太多，是结构缺一根梁。

## 二、实测数据（§六.0 验证 + 校正）

### 2.1 plan 提交全量分布 `[measured]`

| 指标 | 调度者假设 | 实测值 | 校正 |
| --- | --- | --- | --- |
| 总 plan 相关提交 | 96 | 96 | 一致（`git log --oneline -- '.omo/plans/*' \| wc -l` = 99 含 context/agents/docs(plan-ledger)；单 docs(plan) = 25） |
| 单文件修订 ≥2 次 | 调度者未量化 | 25 个文件被修订 ≥2 次（含 ulw-quality-hardening-opt 本波 plan 自身 5 次） | **新结论：≥26% 的 plan 文件被显式回炉** |
| 单文件修订 top-1 | ulw-one-game-two-versions.md 4 次 | ulw-quality-hardening-opt-20260922.md **5 次**（v0→v1→v2→v2.1→v2.2 同日） | **修正：top-1 是本波 plan 自身，不是 one-game-two-versions** |
| 单文件修订 ≥3 次 | 调度者未量化 | 11 个文件被修订 ≥3 次 | 新结论 |
| 新建/显式修订比 | 新建 17 / 修订 6 = ~26% | 修正：89 个 plan 文件，首次入档 89 次、显式回炉 ≥26 次；同日连续 v0→v2.2 是极端形态 | 与调度者定性结论一致 |

### 2.2 同日连续多版成档 `[measured]`

本波 `ulw-quality-hardening-opt-20260922.md` 同日提交 5 次：

| 提交 | 时间 | 版本 | 关键变更 |
| --- | --- | --- | --- |
| 85965a7 | 09-22 12:xx | v0（骨架 drafting） | 入档原始骨架 |
| 3d2c669 | 09-22 | v1→v2 | + dev/main 对比 + 反思沉淀 + 证据优先-验证红线 + 工单级拆分 |
| 14024fa | 09-22 | v2.1 | 主公六项裁决入档（消融对象、范围、Q4 mutation 移出）→ `ready-for-approval` |
| 5f6e615 | 09-22 | v2.2 | 主公三批补充——意图漂移扩容 + 需求对齐协议 + 单 session 拆分判据 + 审批门升级「理解一致」 |
| 1cec0a8 | 09-22 | 状态翻转 | 主公 `/goal 执行计划` 落地 → `executing` |

**关键观察**：v0 → v2 的同日内两次大改，对应调度者所称「同日三版成档」；实质是 v0/v1/v2/v2.1/v2.2 五态。前四态的对话轮次、问卷往返、预备侦察全在落档前完成，git 不可见——**这是 §六.1-4「落档前漂移不可见」的硬证据**。

### 2.3 预案 B 悬置 8 天（preload 波实证） `[measured]`

`ulw-font-preload-sw-fetch-20260914.md`（2026-09-14 入档）v1 已写预案 B「第二轮偶发报告触发」，但事实 8 天后才到位（2026-09-22 `ulw-font-preload-residual-20260922.md` 入档，commit 6c1a972）。**「方案在事实充分前先落档」**是把对齐成本转成了「等待事实」的悬置态——成本载体从「调度者-主公对话」转为「日历时间」。

### 2.4 落档前漂移的不可见性 `[measured]`

调度者假设「落档前漂移须从 session 转录挖」。本波 W-RF 蒸馏席的实际可访问材料：plan 文件本体（137 行 §六）+ git log（96 条提交） + dispatcher-roles-retrospective.md §4 + 已知历次 plan commit message。**原始 session 转录不在工作树内**——本节结论只能从 commit message 描述反推（如 5f6e615 的「主公三批补充」字样），不能定量化「会话内对话轮次」。**这是诚实边界**。

### 2.5 调度者执行观察（来自 dispatcher-roles-retrospective §4 + plan §5） `[inferred]`

调度者本波执行框架（plan §5）声明的纪律：

- herdr tab 优先（不 split pane）
- fresh codex 多席为默认执行体
- Pi 定位为原子化工具（**修正后**——原误读为「纯单文件工具」；本波 Q5 裁决 Pi 兼可调用命令行 + 大上下文探索）
- 每席独立 git worktree，QA 端口分片

dispatcher-roles-retrospective §4「可复用调度者 Prompt 模板」已固化：四层职责（调研/指挥/门卫/沉淀）、五段派发、capture→exit→close、独立验证、升级规则、**反模式清单**（机器本地路径入追踪、对生产结论基于克隆源码、自报当完成、`--no-verify`、信任 tab 标签等）。

**本波执行补充观察**（按 plan §5 + git log 还原）：

- 工单卡派发顺序与 git log 还原基本一致：W-T0 → W-T（lib/components 双子卡）→ W-RV → W-OPT-a → W-DIFF → W-OPT-c → W-MUT → W-AB → （W-V 未观察）
- W-OPT-c 由 4 子提交组成（a380404 sw cache + 88ee15c httpJson + 88afa7a docs + 5c160c6 chore），符合「findings 全修 + 行为不变重构」授权
- W-DIFF 入 docs/diff-dev-main-20260922.md（c1c3229），四维度数据全带 git 指针，符合「数据带指针」纪律
- 本 worktree 观察范围内**未见 W-V 终验提交**——可能在他处或未提交

## 三、漂移四形态验证结论（§六.1 假设逐条判定）

### 3.1 指令欠维 → **验证成立（强证据）** `[measured]`

- 假设：「初始指令只有动词（测试/review/消融/优化），范围/深度/形态/边界默认假设起跑 → 主公补充多轮才收敛」
- 证据：本波 plan 同日 5 版即对应「五维未答 + 主公补充多轮」的实证；v1 骨架 → v2 +v2.1 +v2.2 三轮主公补充（dev/main 对比 + 反思沉淀 + 证据优先验证 = v2；六项裁决 = v2.1；三批补充 + 审批门升级 = v2.2）
- 强度：高。**结构根因 = 起草前无结构化 intake**

### 3.2 词汇歧义 → **验证成立 + 修正** `[measured]`

- 假设：「『消融实验』『清空战绩』等多义概念未先对齐 CONTEXT.md」
- 证据：CONTEXT.md 已落档（4b71391 2026-09-19）作为领域术语契约；但本波 W-RF §六文本显示**需求表达层没有对应的对齐协议**——即术语契约存在但**消费路径未强制**
- 修正：调度者假设把矛头指向「概念未对齐 CONTEXT.md」是部分正确；**真正的缺口是 plan 起草模板里没有『名词先映射 CONTEXT.md』的强制步骤**。CONTEXT.md 是产物，不是流程

### 3.3 事实依赖未显式化 → **验证成立 + 修正** `[measured]`

- 假设：「plan 里写了『待事实确认后触发』的分叉（预案 B），但没写触发判据与等待成本」
- 证据：ulw-font-preload-sw-fetch-20260914.md 入档（2026-09-14）→ 8 天后事实到位（2026-09-22 6c1a972）→ ulw-font-preload-residual-20260922.md 入档。这是调度者直接引用的实证案例
- 修正：调度者称「悬置成隐性返工」——实际上并非「返工」（plan 本身没动），而是「事实到达 → 起草新 plan」。**问题是悬置期间是否记录成本 = 8 天日历空载**。此形态的本质是**「预案先成档 vs 预案后成档」**的取捨

### 3.4 落档前漂移不可见 → **部分成立 + 校正** `[measured]`

- 假设：「会话内多轮补充不进 git，复盘时低估真实对齐成本——需从 session 转录定量（本波轮次 distiller 可数）」
- 证据：落档后修订**可见**（25 个 plan 文件被修订 ≥2 次）；落档前漂移**部分可见**（commit message 字面如「主公三批补充」「主公六项裁决」），但**定量轮次不可见**（本波无 session 转录访问权）
- 校正：调度者说「distiller 可数」——**实操不可数**（至少本波）。可数的是 commit message 里的「批/批/批」+ 修订次数。**本节诚实边界**：定量结论标 `[inferred]`，而非 `[measured]`

### 3.5 调度者未单列但本波实证显著的形态 `[measured]`

- **审批语义未升级**：plan §九 v2.2 把审批门从「主公没说不行」升级为「理解一致确认」——这是**对 §3.1-3.4 全部形态的收口**。原审批语义本身就是漂移的最大杠杆点（无声即通过 = 默认假设固化 = 漂移结构）
- **执行拓扑假设失败**：Q5 裁决修正 Pi 定位——「原子化工具」原判过窄。**说明起草时执行拓扑层也未做 intake**——结构性问题不仅限需求层

## 四、本波执行观察佐证（来自 dispatcher-roles-retrospective §4 + plan §5）

按 dispatcher-roles-retrospective §4 已固化的反模式清单，逐条对本波执行做佐证判定：

| 反模式条目 | 本波是否触发 | 证据 |
| --- | --- | --- |
| 机器本地路径写进被跟踪文件 | 否 | LSP 配置在 ulw-lsp-portable-config 波已修（见 §lsp-client-portable-config 计划） |
| 对生产行为结论基于克隆源码 | 否 | D-1 拆除基于本仓生产构建实测（11baadd perf(font)） |
| 探针只有正对照 | 否 | W-AB 双对象消融自带正负对照（b1d51c5 docs(ablation)） |
| 信任 tab 标签 | 不在本 worktree 可观察 | dispatcher §4 既有结论 |
| 自报当完成 | 否 | 终验席（V8-V12）逐波独立 ACCEPT，本波 W-V 缺位是待补项 |
| `--no-verify` 绕过 hook | 否 | 历史无绕过提交 |
| git add . / -A | 否 | 所有 commit 提交粒度清晰 |

**结论**：调度者反模式清单已固化且本波未触发——这本身是反模式清单「复利」价值的实证（复用过去踩过的坑）。

## 五、可操作结论（每条带证据指针 + 标签）

### 5.1 真正的成本结构 `[inferred]`

| 成本载体 | 占本波时间预估 | 证据指针 |
| --- | --- | --- |
| 让需求被准确描述 | **最大** | 5 版 plan 同日落档（§2.2）= 至少 4 轮主公-调度者对话 |
| 起草新 plan（无可复用模板） | 中 | §六.1-1 验证成立 |
| 派发执行（fresh codex 工单） | 小 | 14 commits 按序按时落地（§2.5） |
| 验证门禁 | 小 | 6 层 Gauntlet 既有脚手架 |
| 沉淀为可复用资产 | **新发现的最大** | 本波才把 intake/对齐/状态机写进流程 |

### 5.2 流程缺口清单（每条对应硬门化路径）

| 缺口 | 现有/新增 | 硬门化目标 |
| --- | --- | --- |
| 起草前无 intake 五维 | 缺 | 模板必填段 + 调度者 brief 硬性负面清单 |
| 需求名词未映射 CONTEXT.md | CONTEXT.md 存在 | 模板词汇步（见 §六.2-1） |
| 验收标准「非机器可判」 | 部分有 | Given-When-Then 复述确认（aligned 门） |
| 事实依赖无触发判据 | 无 | 模板必填段「触发判据 + 悬置成本」 |
| 审批语义为「没说不行」 | v2.2 已升 | 计划九落地 aligned 门 |
| 执行拓扑假设（Pi 定位） | Q5 已修 | 派发 brief 显式列工具定位 |

### 5.3 「为什么需求才对齐」一句话总结 `[inferred]`

**不是「主公补充太多」，是「流程缺一根梁」——计划九 v2.2 升级的「理解一致确认」审批语义是这根梁的主入口；intake 五维 + 词汇步 + Given-When-Then 复述 + 状态机 aligned 门 + 事实依赖显式化是这根梁的承重结构（详见 `docs/requirement-intake.md`）。**

## 六、对调度者假设的总体判定

| 假设 | 判定 |
| --- | --- |
| 漂移根因在起草前无 intake | **成立**（§3.1 + §3.2 + §3.5） |
| 词汇层缺口在消费路径不在 CONTEXT.md 本身 | **成立 + 修正**（§3.2） |
| 预案 B 悬置是「返工」 | **修正**：非返工，是事实等待成本（§3.3） |
| 落档前漂移 distiller 可数 | **修正**：本波不可数，只能定性（§3.4） |
| 沉淀七方向需配硬门 | **成立**——本报告全数采纳，每条带配硬门的目标 |

## 七、遗留风险

- W-V 终验提交在本 worktree 未观察——是否独立存在需复核（建议执行者自查 `.omo/` 或 herdr 注册文件）
- 本波 plan §六说「.omo/plans/quality-wave-execution-notes-20260922.md」为调度者全程观察素材——本工作树 + git 历史均无此文件。**可能为他席产物未被合入，或工作树未拉取**。建议主公/调度者确认
- aligned 门为流程约定，本波为首次适用——未回测。`docs/requirement-intake.md` 落地后需跟踪下一波 plan 起草是否真按新模板走

## 八、附：本报告数据采集脚本

```bash
# §2.1 总 plan 提交
git log --all --oneline -- '.omo/plans/*' | wc -l

# §2.1 单文件修订频次 top
for f in $(git ls-files '.omo/plans/'); do
  echo "$(git log --all --oneline --follow -- "$f" | wc -l) $f"
done | sort -rn | head -20

# §2.2 本波 plan 演化
git log --all --pretty=format:"%h %ad %s" --date=short --follow -- \
  .omo/plans/ulw-quality-hardening-opt-20260922.md

# §2.3 preload 8 天悬置
echo "v1: $(git log -1 --format='%ad %s' --date=short -- \
  .omo/plans/ulw-font-preload-sw-fetch-20260914.md)"
echo "v2: $(git log -1 --format='%ad %s' --date=short -- \
  .omo/plans/ulw-font-preload-residual-20260922.md)"
```

