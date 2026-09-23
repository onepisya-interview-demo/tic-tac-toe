# W-RF 输入素材：本波执行层观察（调度者记录，2026-09-22）

> 本文件是调度者对 ulw-quality-hardening-opt-20260922 波次执行过程的客观记录，供 W-RF distiller 席消费。只记录实测事实，不写结论（结论由 distiller 验证 §六 假设后成文）。

## 1. 执行拓扑实况

- 计划 §五原定：herdr tab + fresh codex 多席 + Pi 原子化工具。
- 实际执行：**混合运行时**。第一波 4 席走 ZCode Agent 子代理（并行发出），因主公中途插话（消息打断）2 席被取消（W-RV、W-OPT-a）；主公随后明示「herdr 也一起用起来，codex fresh session 用起来」→ 被取消的 2 工单改派 herdr codex 重跑，后续全部席位走 herdr codex（rvreview / opta / wt / woptb / woptc / wmut / wab 共 7 席）。
- **Pi 未使用**：W-DIFF 原定 Pi 执行，实际用 ZCode 子代理完成（能力超集，报告质量含 git 指针全带）。
- 同一工单零重复执行（被取消的 2 席未产出任何产物，重派即首跑）。

## 2. 各席墙钟与产出（measured，来自 herdr/codex 记录）

| 席 | 工单 | 墙钟 | 产出 |
| --- | --- | --- | --- |
| ZCode 席A | W-T0 | ~11 min | coverage 工具链修复（根因比 plan 记载深一层：lib/AGENTS.md 被当源码解析 + include 缺 components/**，两个独立原因被 plan 合并为一个因果） |
| ZCode 席C | W-DIFF | ~8 min | 四维度对比报告（121 提交实测，修正 plan §2.4 的过时数字 116） |
| herdr opta | W-OPT-a | 4m26s | D-1 落地 8 步探针全绿 |
| herdr rvreview | W-RV | 9m27s + 1 次追加输出（findings 前半段滚出终端需重新索取） | 11 findings（0 P0/P1） |
| herdr woptb | W-OPT-b | 5m21s | bundle 定性 0 win（三层已合理，书面论证） |
| herdr wt | W-T | ~55 min | 90 个新测试，全局 stmts +13.6pp |
| herdr woptc | W-OPT-c | ~30 min | 处置表 11/11 + SW cache-bust 真修 + 1 笔重构 + 1 个后续 plan 骨架 |
| herdr wmut/wab | W-MUT/W-AB | 进行中 | — |

## 3. 对齐与摩擦点（调度者现场观察）

1. **plan 与实况的偏差被执行席自行修正**（正向）：W-T0 发现 plan §2.2 把两个独立故障合并为一个因果；W-DIFF 发现 plan §2.4 数字过时；W-OPT-c 处置 P2#1 时发现评审报告引用的「README 边界注」实际不存在并修正。**执行席在 brief 的「可基于代码实况修正」授权下自行纠偏，未产生返工**。
2. **裁决预留生效**：W-OPT-c 遇 P2#4（服务端无 row 盲区）不在授权内 → 按 brief 指示立后续 plan 骨架（ulw-anonymous-online-server-row-missing-20260922.md）而非自行修——「dismiss + plan」模式避免了范围蔓延。
3. **herdr 终端 scroll buffer 是报告交接瓶颈**：rvreview 的 findings 前半段滚出终端窗口，read recent-unwrapped 取不到 → 追加一轮 prompt 让它重新输出 findings 清单（多一轮往返 ~2 分钟）；后改用 codex session jsonl 直读（task_complete.last_agent_message）零损耗。**教训：长报告应落文件而非只输出终端**（W-OPT-b 起的 brief 已改为「报告落库 reports/ + 终端输出」双通道）。
4. **commit-msg hook 的隐性规则在 brief 里没写全**：subject-case 规则拒绝大写开头（W-DIFF 提交主题「W-DIFF …」被拒，改写后通过）——调度者首次遇到，靠 commitlint 输出定位。brief 模板可补一句「主题不以全大写词开头，header ≤100 字符」。
5. **工单卡粒度实检**：W-T（盲区补齐）是本波最大工单（55 分钟、36+ 测试文件面），接近单 session 上限但仍完成——验证了拆分四问的「上下文预算」项估算偏保守（实际容量比预估大）；W-OPT-b 的 0 win 结论说明「优化类工单」的完成判据必须允许「书面证明无可行动项」这种合法空产出的完成态，否则会逼出硬造优化。

## 4. 主公协作节奏（本波新增观察）

- 主公在 goal 执行中两次插话：「herdr 也一起启动起来」「刚才 4 个子代理都取消了？和 herdr 重复吗？不重复的话继续吧」——运行时选择的指令是**增量式**的（先 goal → 再补 herdr → 再确认不重复），调度者需要在插话时即时澄清「已完成/已取消/重派」的映射关系并继续，而非停机等重新对齐。
- 插话打断的代价实测：2 席被取消（~1-2 分钟的工作丢失，无产物损失）；澄清成本 1 轮对话。**远低于 plan 落档前的对齐成本**（§六.0 同日三版成档）——「执行中插话」与「起草中漂移」是两种不同成本量级的交互。

## 5. W-MUT/W-AB 完成补记（2026-09-22 12:36-12:40）

- **首席故障与重派**：W-MUT 首席（codex）遭遇运行时故障（所有工具调用被拒——「Tool runtime is rejecting every call」，2m18s 诚实停机，未伪造产出）；W-AB 首席执行漂移（无视 brief 钉死的对象，基于 main 私建 worktree 消融了已退役的历史对象：View Transitions / solo 零写探针 / PlayController）。两席均 fresh 重派（mut2/ab2，tab close + 重建）。
- **W-AB 漂移的纠正手段实测**：重派 brief 加「硬性负面清单」（点名禁消融对象 + 禁新 worktree + 禁 main）后一次通过——**负面清单比正面描述更能钉住边界**（ab2 报告 §6.3 逐条复述未触碰项，说明负面清单被读进去了）。
- **mut2**：10.5 分钟。store.ts mutation 83.23%→87.74%（+4.51pp，补 25 kill）、game.ts 96.75%；23 枚存活 100% 处置（21 EQUIVALENT + 1 Stryker quirk）；测试 453→467。commit 9dbd457 已合入 dev。
- **ab2**：~11 分钟实验 + 报告。六项消融因果全验（D-1 消融 → 探针 STEP02 RED 实证因果；SW sweep 消融 → ablated 残留/current 清扫；测试加深消融 → 覆盖回落实测；三警告门禁 keep 裁决）。TSV 日志 32 行。commit 81d4fa4（b1d51c5 合入）。
- **重派成本**：两席故障/漂移的重派总成本 ≈ 一轮 tab 重建 + brief 修正（~10 分钟墙钟），无产物污染（wab 首席错位产物已清理，未入库）——「独立 worktree + 完成判据可跑」使坏产出在合入前就被拦截。
