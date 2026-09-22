# ulw: 质量加固与优化波（v2）——测试加深 + review + 消融 + 优化 + dev/main 对比 + 反思沉淀

- 日期: 2026-09-22
- 状态: **executing**（2026-09-22 主公下达 `/goal 执行计划` 执行令 = §九审批门通过；按 §四依赖序派发）
- 分支: dev
- 基线: tag `dev-stable-20260922` @ `6c1a972`（前置 tag 已完成）；origin/dev 同步至 58eb271，Vercel 已部署新版
- v1→v2 变更: 新增 W-DIFF（dev/main 对比）、W-RF（反思沉淀为可复用资产）、§三 证据优先-验证方法论红线（pstack 融入）、§五 执行拓扑（herdr tab / fresh codex / Pi 分工 / omo 钩子）、§四 波次细化为单会话工单卡
- v2→v2.1 变更: 主公六项裁决入档（§九）——消融双对象、review 全仓、findings 全修 + 纯内部重构授权、`@deprecated` 保留豁免、mutation 移至最末（W-MUT 独立工单）、Pi 定位修正（原子化修改 + 大上下文探索 + 可调命令行）；状态 drafting → ready-for-approval
- v2.1→v2.2 变更: 主公三批补充——意图漂移与需求对齐成本分析扩容（W-RF 输入增 .omo/plans/ 演化史 + 实测数据 §六.0）、产出资产增「需求对齐协议」（统一语言背景下的精确描述）、单 session 拆分判据操作化（§四拆分原则）、审批门升级为「理解一致确认」（§九）
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

> 拆分原则：整体计划跨多会话执行；每张工单绑定一个 fresh 会话（子代理或 herdr agent runtime），完成判据全部可跑。**「单 session 能完成」的操作判据（拆分四问）**：① 上下文预算内（输入文件 + 产出可在单会话读毕写毕，无需中途换脑）；② 文件面窄（写触面 ≤10 文件或单一只读分析域）；③ 完成判据可跑（exit code / 报告落库，无主观验收）；④ 与其他卡只经 plan 中声明的产物交接、无进行中协调。**前提（主公明示）：需求已真正对齐——理解是统一语言背景下的精确描述；未对齐不开拆**。依赖序：W-T0 → W-T；W-RV ∥ W-T（只读与测试互斥面）∥ W-DIFF；W-OPT-a/b/c 消费 W-RV/W-T；W-MUT 在 W-T 与 W-OPT-c 全部完成后进行（Q4 裁决，可与 W-AB 并行）；W-AB 依赖 W-OPT 完成；W-RF 于全波收口前；W-V 压轴。

| 工单 | 目标（一句话） | 完成判据（可跑） | runtime | 依赖 |
| --- | --- | --- | --- | --- |
| W-T0 | 修 coverage 工具链 PARSE_ERROR，产出含 components/ 的完整报告；vmThreads 评估（只评估不动，有实据另立单） | `pnpm test:coverage` exit 0 且报告含 components/ 行 | fresh codex | — |
| W-T | 盲区表逐项补齐（分支覆盖优先；`@deprecated` 面按裁决豁免不补）+ mutation 移出本卡（见 W-MUT） | coverage 报告盲区清零（deprecated 面书面豁免）；`pnpm vitest run` 全绿 | fresh codex | W-T0 |
| W-RV | 五维只读评审，**范围 = 全仓**（§2.5 功能面四提交 + 高危存量面 + 全部 lib/components/app/sw.js），findings 带 file:line + 分级 | 全仓 findings 报告（每条带证据指针）；不改任何文件 | fresh codex（只读） | — |
| W-OPT-a | D-1 落地：layout 拆 preload + sw-console-hygiene 强化 + sw.js 注释同步 | 强化版探针 exit 0（含 Link 头零 font 断言 + reload 场景）；六层门禁全绿 | fresh codex | plan 已裁决 |
| W-OPT-b | 性能优化，**优先级序：bundle → 渲染 → 网络缓存**（bundle 先定性 gzip 后 vendor/app 占比；每项可行动优化带前后实测） | 每个 accepted win 一个 commit，带 before/after 实测值（hillclimb 纪律） | fresh codex | W-RV |
| W-OPT-c | 代码优化：**W-RV findings 全修**（fix；dismiss 须带具体反证）+ **授权范围内纯内部重构**（DRY/拆复杂度/减层，行为不变） | findings 处置表 100% 覆盖；重构提交行为不变证明（vitest 全绿 + 相关探针绿） | fresh codex | W-RV、W-T |
| W-DIFF | dev vs main 差异对比报告（§2.4 四维度）+ main 推进建议 | 对比报告入 docs/（分类占比、行为变化、风险面、建议）；数据全带 git 指针 | Pi（只读 git 分析 + 报告） | — |
| W-RF | 反思蒸馏：本波时间花销与需求对齐复盘 → 可复用资产（**需求对齐协议** + 调度模板修订 + docs 经验条目） | 资产清单落库（每条带本波实例佐证）；§六输入全数消费，§六.0 实测数据逐条归因 | distiller 席 | 全波收口前 |
| W-AB | 消融实验**双对象**（Q1 裁决）：(a) 本波优化变更 baseline vs ablated 因果对比（如 D-1 前后警告频次/包体/耗时）；(b) 验证门禁组件消融（候选：commit-audit R4 trailer 门 / 探针层 / coverage 门，按仓库先例 `agents-orthogonality-audit` 范式选代表组件） | (a)(b) 各带对比数据 + keep/kill/校准结论，配 TSV 决策日志 | scientist 席 | W-OPT 完成 |
| W-MUT | mutation 测试（Q4 裁决：耗时大，**其他所有事情完成之后**再进行；对象 lib/game.ts / lib/store.ts 高危面） | Stryker 报告 + 存活 mutant 处置表（kill / 书面保留理由） | fresh codex | W-T、W-OPT-c 完成 |
| W-V | fresh-context 对抗终验（全波产出）+ V13 报告入档 | 终验报告 ACCEPT；信产物不信自报 | fresh 终验席 | 全部（W-MUT 后） |

## 五、执行拓扑（herdr 纪律 + runtime 分工）

- **herdr tab 优先**（不 split pane）；`herdr --session <name> tab create` → `agent start <name> --kind codex` → `agent prompt --wait --until done` → `agent get/read` 轮询。
- **fresh codex 多席**为默认执行体（跨文件修复/测试/评审）；**old session** 仅用于强接续任务（如 W-OPT 内部跨日续作，须先 session-pickup：把既有轨迹当权威，不重推）。
- **Pi**（`/Users/onepisya/.vite-plus/bin/pi`，Q5 确认 + 定位修正）：**原子化工具**——单文件小修改、文件读取与探索（1M 大上下文优势，适合快速扫全仓）、调用命令行工具（git/rg/curl 等）；W-DIFF 类分析报告、探针小修、脚本验证均适用。**仍禁跨文件重构**（无 LSP，能力边界见 AGENTS.md §运行时能力边界）。
- 每席独立 git worktree（`git worktree add ../ttt-<seat> -b ulw/<wave>`，终验席 `--detach`）；QA 端口分片；rebase + ff-only 合入保线性；委派先 teach-back，产出独立验证前视为未完成。
- omo 钩子：工单 plan 文件名一律 `ulw-` 前缀；主公侧可用 `$omo:ulw-plan / ulw-loop / ulw-research / start-work / ultrawork` 驱动。

## 六、W-RF 反思输入：意图漂移与需求对齐成本（主公点名深挖；调度者初步假设 + 实测数据，distiller 验证/补充后成文）

反思命题：**为什么花了这么多时间？需求为什么才对齐？**

### 六.0 实测数据（2026-09-22 只读侦察）

- `.omo/plans/` 全量 **96 个 plan 相关提交**；提交主题粗分：新建「入档」17 个、显式「修订/补充」6 个（落档后返工 ≥26% 的 plan 被改过）。单文件修订 top：`ulw-one-game-two-versions.md` 4 次；另有 10 个文件 3 次。
- **落档后修订只是冰山一角**：真正的意图漂移多发生在落档前的会话内（主公多轮口头补充才成 plan，git 不可见，须从 session 转录挖）。活例：本波 quality plan **同日三版成档**（v1 骨架 → 主公一批补充出 v2 → 二批裁决出 v2.1），每版之间的对话轮次、预备侦察、问卷往返全是对齐成本。
- **早拍板返工形态**：preload plan（`ulw-font-preload-sw-fetch-20260914.md`）v1 就写了预案 B，但事实（第二轮偶发报告）8 天后才触发——方案在事实充分前先落档，本质是把对齐成本转成了「等待事实」的悬置态。

### 六.1 漂移形态分类（distiller 验证假设）

1. **指令欠维**：初始指令只有动词（如「测试/review/消融/优化」），范围/深度/形态/边界默认假设起跑 → 主公补充多轮才收敛（本波实证）。根因：起草前无结构化 intake。
2. **词汇歧义**：「消融实验」「清空战绩」等多义概念未先对齐 CONTEXT.md 就动工；CONTEXT.md 是领域术语契约，但**需求表达层没有对应的对齐协议**。
3. **事实依赖未显式化**：plan 里写了「待事实确认后触发」的分叉（预案 B），但没写触发判据与等待成本，悬置成隐性返工。
4. **落档前漂移不可见**：会话内多轮补充不进 git，复盘时低估真实对齐成本——需从 session 转录定量（本波轮次 distiller 可数）。

### 六.2 沉淀方向（每条须回答「哪个硬门强制它」）

1. **需求 intake 协议**：起草 plan 前五维清单（范围/深度/形态/边界/验收），未答不起草；其中**词汇步**：需求描述中的名词先映射 CONTEXT.md，缺位术语显式对齐（入 Pending 或御定），不带默认假设开工。硬门：调度者委派协议 + plan 模板必填段。
2. **需求对齐协议（统一语言背景下的精确描述，主公明示）**：对齐完成的定义不是「主公没说不行」，而是**双方对同一组术语、同一组验收场景描述一致**——plan 落档前先用 Given-When-Then 式验收场景复述给主公确认（specifier.spec 范式），确认后才进审批。硬门：§九审批门升级为「理解一致确认」。
3. **plan 状态机增 aligned 门**：`drafting → aligned（主公确认精确描述）→ ready-for-approval → executing`；显式对齐轮次计为成本入档，杜绝「边跑边对齐」。硬门：plan 模板状态行枚举固定。
4. **单 session 拆分四问**（§四拆分原则，已操作化）：上下文预算 / 文件面窄 / 判据可跑 / 产物交接——模型在窄而深的小任务上发挥更好（pstack 无畏并行前提：单 agent 深度工作 + 可验证）。
5. **事实依赖显式化**：plan 里的一切「待确认分叉」必须带触发判据 + 悬置成本声明，否则降级为非承诺备注。
6. **调研路径顺序**（preload 波实证）：机制级未知问题先走 14+ 场景内部复现矩阵、后才命中 Chromium 现有 bug——「为什么类」问题应外部已知证据检索先行（Chromium/上游 issue、7 类证据源），内部复现矩阵降级为确认手段而非发现手段。硬门：调研类工单的执行序模板。
7. 产物落点候选：`docs/retro-2026Q3.md`（复盘五问 + §六.0 数据）、`docs/requirement-intake.md`（intake 协议）、AGENTS.md 调度者节增补、dispatcher-roles-retrospective.md §4 增补。

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
- **审批门（v2.2 升级）**：本 plan 待主公最终审批。审批的语义 = 主公确认**统一语言背景下的理解一致**（§六.2-2 需求对齐协议的首次适用）：对齐项为 §四工单卡拆分、§五执行拓扑、§六反思沉淀方向、§三方法论红线——主公可通过、可指出偏差、可继续补充；通过前零派发、零代码改动。
