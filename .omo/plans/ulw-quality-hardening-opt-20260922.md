# ulw: 质量加固与优化波（v2）——测试加深 + review + 消融 + 优化 + dev/main 对比 + 反思沉淀

- 日期: 2026-09-22
- 状态: **ready-for-approval**（v2.1：§九裁决已全部入档；待主公最终审批，通过后才派发执行）
- 分支: dev
- 基线: tag `dev-stable-20260922` @ `6c1a972`（前置 tag 已完成）；origin/dev 同步至 58eb271，Vercel 已部署新版
- v1→v2 变更: 新增 W-DIFF（dev/main 对比）、W-RF（反思沉淀为可复用资产）、§三 证据优先-验证方法论红线（pstack 融入）、§五 执行拓扑（herdr tab / fresh codex / Pi 分工 / omo 钩子）、§四 波次细化为单会话工单卡
- v2→v2.1 变更: 主公六项裁决入档（§九）——消融双对象、review 全仓、findings 全修 + 纯内部重构授权、`@deprecated` 保留豁免、mutation 移至最末（W-MUT 独立工单）、Pi 定位修正（原子化修改 + 大上下文探索 + 可调命令行）；状态 drafting → ready-for-approval
- 关联: `.omo/plans/ulw-font-preload-residual-20260922.md` D-1（并入 W-OPT）

## 一、目标（主公指令汇总，七件套）

1. 更充分的**测试**；2. 独立 **review**；3. **消融实验**；4. **代码与性能优化**；5. **dev 与 main 差异对比**；6. **反思**「为什么花了这么多时间 / 需求才对齐」并沉淀为**可复用资产**；7. 全程践行**证据优先-验证**（方法论见 §三）。前置（已完成）：功能稳定 tag。

## 二、侦察实据（2026-09-22，tag 基线只读实测）

### 2.1 测试盲区（`pnpm test:coverage`，363/363 全绿下）

| 盲区 | 现值 | 未覆盖点 |
| --- | --- | --- |
| `lib/sound.ts` | stmts 94.6% / **branch 73.3%** | 41-46,57,70,82-93（AudioContext 懒创建与降级分支） |
| `lib/offline-stats.ts` | **stmts 80.3%** / branch 79.6% | 103,149（`@deprecated` helpers 面） |
| `lib/api-problem.ts` | **stmts 80%** | 96（typeUriFor 边缘形态） |
| `lib/db.ts` | 83.9% / **branch 76.6%** | 120,171,185,436-440,473-475（getDb reconcile 与错误分支） |
| `lib/store.ts` | 91.4% / branch 88.2% | 180-187,210,264（W-F seam 邻域） |
| `db/schema.ts` | 50% | 42（drizzle 声明，建议书面豁免） |
| **components/** | **完全不可见** | 见 2.2 工具链故障 |

### 2.2 coverage 工具链故障（W-T0 前置修复项）

- `@vitest/coverage-v8` 报告生成抛 **rolldown `PARSE_ERROR`**（parseAstAsync 链路）→ components/ 整目录从报告消失，90% 是**残缺数字**。
- vitest：jsdom 每 file 重建 ×30（20.89s，57% 时长）；`pool: 'vmThreads'` 提速候选（隔离性代价需评估，与 W-T 不混装）。

### 2.3 性能面快照

- bundle：最大 chunk 224KB / 160KB / 112KB（未压缩；vendor/app 占比定性未做，W-OPT 侦察项）。
- D-1（已裁决待执行）：`Geist({preload:false})` 拆除 Link 头 font preload，双偶发源断根；代价由 font-display:swap + Geist Fallback 校准兜底。
- 历史缓议（不强承诺）：`lib/db-path.ts` 常量源抽取消（RC-drift §4.1 P1-4/P1-5）。

### 2.4 dev vs main 差异规模（W-DIFF 输入）

`git diff main..dev --stat`：**116 提交 / 169 文件 / +21734/-1905**；merge-base `51f164c`（2026-09-15）。main 停在功能重做之前——线上用户看到的与 dev 功能面差 116 提交。对比维度：提交分类占比（feat/fix/docs/test/chore）、用户可见行为变化清单、main 缺失的 bug 修复清单（风险面）、发布建议（main 是否推进，裁决归主公）。

### 2.5 review 面（W-RV 输入清单）

功能面四提交：`9fe08a0`（reset 家族）、`e15e049`（W-F seam）、`1c3899e`（ResultCelebration）、`2d8f8d4`（OnlineGateMount）。高危存量面：`lib/store.ts`、`lib/db.ts`、`components/Board.tsx`、`public/sw.js`。

## 三、方法论红线：证据优先-验证（pstack 思想融入，不照抄）

吸收自 `~/.hermes/memory/knowledge/pstack-notes.md`（不安装；需全文时按其 §4 路由表 Read ROOT 源文件）。**每条吸收点配对我们已有的硬门**（主公金训：答不出强制门的不吸收）：

| 吸收点 | 本波落点 | 强制硬门 |
| --- | --- | --- |
| 「It compiles is not evidence」 | 一切 done 宣布须对照真实产物 | 六层门禁（机械）+ 终验席信产物不信汇报（协议） |
| 5 级确定性阶梯（默认目标第 4 级「跑了，错了会响」） | 各工单完成判据必须可跑（探针/脚本/命令 exit code） | 验收标准逐条机器可判；无法到 4 级须标 `unproven` |
| 每句结论带证据或标签（measured/inferred/guess） | review findings、消融报告、反思报告的写作规范 | reviewer/distiller 席的产出契约里写死 |
| 验证方式 × 变更类型匹配 | UI→探针走真实流程；性能→前后 profile；存储→读回写入值；子代理产物→看 diff 不看自报 | 各波验收节按类型点名验证手段 |
| blast-radius「别信自己的分析报告」 | 跨文件工单的影响面声明须带可跑证据 | 调度者独立抽查（抽查即复跑） |
| show-me-your-work TSV 决策日志 | W-AB / W-V 长任务工单要求 append-only 日志（指针非散文） | 终验先查日志存在且非空 |

## 四、波次与工单拆分（每卡 = 单会话可完成；ulw- 前缀触发 omo 工作流）

> 拆分原则：整体计划跨多会话执行；每张工单绑定一个 fresh 会话（子代理或 herdr agent runtime），完成判据全部可跑。依赖序：W-T0 → W-T；W-RV ∥ W-T（只读与测试互斥面）∥ W-DIFF；W-OPT-a/b/c 消费 W-RV/W-T；W-MUT 在 W-T 与 W-OPT-c 全部完成后进行（Q4 裁决，可与 W-AB 并行）；W-AB 依赖 W-OPT 完成；W-RF 于全波收口前；W-V 压轴。

| 工单 | 目标（一句话） | 完成判据（可跑） | runtime | 依赖 |
| --- | --- | --- | --- | --- |
| W-T0 | 修 coverage 工具链 PARSE_ERROR，产出含 components/ 的完整报告；vmThreads 评估（只评估不动，有实据另立单） | `pnpm test:coverage` exit 0 且报告含 components/ 行 | fresh codex | — |
| W-T | 盲区表逐项补齐（分支覆盖优先；`@deprecated` 面按裁决豁免不补）+ mutation 移出本卡（见 W-MUT） | coverage 报告盲区清零（deprecated 面书面豁免）；`pnpm vitest run` 全绿 | fresh codex | W-T0 |
| W-RV | 五维只读评审，**范围 = 全仓**（§2.5 功能面四提交 + 高危存量面 + 全部 lib/components/app/sw.js），findings 带 file:line + 分级 | 全仓 findings 报告（每条带证据指针）；不改任何文件 | fresh codex（只读） | — |
| W-OPT-a | D-1 落地：layout 拆 preload + sw-console-hygiene 强化 + sw.js 注释同步 | 强化版探针 exit 0（含 Link 头零 font 断言 + reload 场景）；六层门禁全绿 | fresh codex | plan 已裁决 |
| W-OPT-b | 性能优化，**优先级序：bundle → 渲染 → 网络缓存**（bundle 先定性 gzip 后 vendor/app 占比；每项可行动优化带前后实测） | 每个 accepted win 一个 commit，带 before/after 实测值（hillclimb 纪律） | fresh codex | W-RV |
| W-OPT-c | 代码优化：**W-RV findings 全修**（fix；dismiss 须带具体反证）+ **授权范围内纯内部重构**（DRY/拆复杂度/减层，行为不变） | findings 处置表 100% 覆盖；重构提交行为不变证明（vitest 全绿 + 相关探针绿） | fresh codex | W-RV、W-T |
| W-DIFF | dev vs main 差异对比报告（§2.4 四维度）+ main 推进建议 | 对比报告入 docs/（分类占比、行为变化、风险面、建议）；数据全带 git 指针 | Pi（只读 git 分析 + 报告） | — |
| W-RF | 反思蒸馏：本波时间花销与需求对齐复盘 → 可复用资产（需求 intake checklist / 调度模板修订 / docs 经验条目） | 资产清单落库（每条带本波实例佐证）；见 §六 反思输入 | distiller 席 | 全波收口前 |
| W-AB | 消融实验**双对象**（Q1 裁决）：(a) 本波优化变更 baseline vs ablated 因果对比（如 D-1 前后警告频次/包体/耗时）；(b) 验证门禁组件消融（候选：commit-audit R4 trailer 门 / 探针层 / coverage 门，按仓库先例 `agents-orthogonality-audit` 范式选代表组件） | (a)(b) 各带对比数据 + keep/kill/校准结论，配 TSV 决策日志 | scientist 席 | W-OPT 完成 |
| W-MUT | mutation 测试（Q4 裁决：耗时大，**其他所有事情完成之后**再进行；对象 lib/game.ts / lib/store.ts 高危面） | Stryker 报告 + 存活 mutant 处置表（kill / 书面保留理由） | fresh codex | W-T、W-OPT-c 完成 |
| W-V | fresh-context 对抗终验（全波产出）+ V13 报告入档 | 终验报告 ACCEPT；信产物不信自报 | fresh 终验席 | 全部（W-MUT 后） |

## 五、执行拓扑（herdr 纪律 + runtime 分工）

- **herdr tab 优先**（不 split pane）；`herdr --session <name> tab create` → `agent start <name> --kind codex` → `agent prompt --wait --until done` → `agent get/read` 轮询。
- **fresh codex 多席**为默认执行体（跨文件修复/测试/评审）；**old session** 仅用于强接续任务（如 W-OPT 内部跨日续作，须先 session-pickup：把既有轨迹当权威，不重推）。
- **Pi**（`/Users/onepisya/.vite-plus/bin/pi`，Q5 确认 + 定位修正）：**原子化工具**——单文件小修改、文件读取与探索（1M 大上下文优势，适合快速扫全仓）、调用命令行工具（git/rg/curl 等）；W-DIFF 类分析报告、探针小修、脚本验证均适用。**仍禁跨文件重构**（无 LSP，能力边界见 AGENTS.md §运行时能力边界）。
- 每席独立 git worktree（`git worktree add ../ttt-<seat> -b ulw/<wave>`，终验席 `--detach`）；QA 端口分片；rebase + ff-only 合入保线性；委派先 teach-back，产出独立验证前视为未完成。
- omo 钩子：工单 plan 文件名一律 `ulw-` 前缀；主公侧可用 `$omo:ulw-plan / ulw-loop / ulw-research / start-work / ultrawork` 驱动。

## 六、W-RF 反思输入（调度者初步假设，distiller 验证/补充后成文）

反思命题：**为什么花了这么多时间？需求为什么才对齐？**

1. **需求对齐返工**：本波初始指令只有四个动词（测试/review/消融/优化），范围/深度/形态/边界未给，plan 起草后主公两轮补充（质量设施要求 + 执行形态约束）才收敛——根因假设：调度者未在起草前跑结构化 intake 清单，按默认假设先跑。沉淀方向：**需求 intake checklist**（范围/深度/形态/边界/验收五维，未答不起草）入 dispatcher 模板。
2. **调研路径顺序**：preload 偶发问题先走了 14+ 场景内部复现矩阵，后才命中 Chromium 现有 bug（外部证据）——反思假设：机制级未知问题应**外部已知证据检索先行**（为什么类问题的 7 类证据源），内部复现矩阵作为确认而非发现手段。沉淀方向：调研前置模板（外部证据优先序）。
3. **返工统计待挖**：116 提交中 fix/revert/redo 占比、V9-V12 各终验的返工条数——distiller 从 git log + session 转录定量，不凭印象。
4. 沉淀产物候选：docs/retro-2026Q3.md（复盘五问）、dispatcher-roles-retrospective.md §4 增补、AGENTS.md 反模式增补（若有新反模式实锤）。

## 七、验收标准（草案，定稿逐条机器化）

1. coverage 完整报告（含 components/）可复现，PARSE_ERROR 消除；盲区逐项闭合或书面豁免。
2. review findings 100% 处置（fix / dismiss 带具体反证），处置表入档。
3. D-1 落地：强化版 sw-console-hygiene 全绿；Link 头零 font 条目断言生效。
4. W-DIFF 报告入 docs/，四维度数据全带 git 指针；main 推进建议交主公裁决。
5. W-RF 资产清单落库，每条带本波实例佐证（非空泛教训）。
6. 消融带 baseline/ablated 数据 + keep/kill + TSV 决策日志。
7. 每工单 commit 过六层门禁 + lore trailer + Plan footer；零 push；终验 V13 fresh-context 对抗 ACCEPT。

## 八、红线（延续既有契约）

六层门禁；禁 `--no-verify`；禁 `git add . / -A`；push 等主公指令；主 worktree :3000 dev 在线时禁 build（波次构建走独立 worktree）；NEXT.JS 16 agent-rules 块不可动；CONTEXT.md 术语契约（产出物零 `_Avoid_` 别名）。

## 九、主公裁决记录（2026-09-22，全部入档，plan 定稿）

- **Q1 消融对象：两者都做** → W-AB 拆双对象 (a) 优化变更因果对比 + (b) 验证门禁组件消融（先例范式）。
- **Q2 优化优先级：bundle → 渲染 → 网络缓存**；**纯内部重构授权**；**findings 也需要修** → W-OPT-b 优先级序入卡；W-OPT-c 扩容为 findings 全修 + 行为不变的内部重构。
- **Q3 review 范围：全仓** → W-RV 扩容（功能面四提交 + 高危存量 + 全部 lib/components/app/sw.js）。
- **Q4 测试加深边界：`@deprecated` 保留**（豁免不补、不删）；**mutation 耗时大，其他所有事情完成之后再进行** → mutation 移出 W-T，独立为 W-MUT，依赖 W-T + W-OPT-c，W-V 前完成。
- **Q5 执行形态：确认**；Pi 上下文大，可帮助快速进行文件修改或文件读取与探索；它是原子化工具，但也可以让它调用命令行工具 → §五 Pi 定位已修正。
- **Q6 其他补充：暂时没有**。
- **审批门**：本 plan 待主公最终审批；通过后按 §四依赖序派发，未通过不改任何文件。
