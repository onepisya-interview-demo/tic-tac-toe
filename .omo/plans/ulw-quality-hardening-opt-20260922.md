# ulw: 质量加固与优化波——测试加深 + review + 消融 + 代码/性能优化

- 日期: 2026-09-22
- 状态: **drafting**（骨架与侦察实据已入档；§七列有待主公补充信息的裁决点，补齐后定稿派发）
- 分支: dev
- 基线: tag `dev-stable-20260922` @ `6c1a972`（主公指令「修改代码前先打 tag」已完成；origin/dev 已同步至 58eb271，Vercel 已部署新版，主公确认「功能上都是我想要的内容了」）
- 关联: `.omo/plans/ulw-font-preload-residual-20260922.md` D-1（preload 拆除，已裁决未执行，并入本波 W-OPT）

## 一、目标（主公指令直译）

1. 补充**更充分的测试**；
2. 补充 **review**（独立评审）；
3. 补充**消融实验**；
4. 进行**代码优化与性能优化**。
   前置（已完成）：功能稳定 tag；执行全程不 push、不绕 hook。

## 二、侦察实据（2026-09-22，只读，tag 基线上测得）

### 2.1 测试盲区（`pnpm test:coverage`，363/363 全绿下）

| 盲区 | 现值 | 未覆盖点 |
| --- | --- | --- |
| `lib/sound.ts` | stmts 94.6% / **branch 73.3%** | 41-46,57,70,82-93（AudioContext 懒创建与降级分支） |
| `lib/offline-stats.ts` | **stmts 80.3%** / branch 79.6% | 103,149（`@deprecated` helpers 面） |
| `lib/api-problem.ts` | **stmts 80%** | 96（typeUriFor 边缘形态） |
| `lib/db.ts` | 83.9% / **branch 76.6%** | 120,171,185,436-440,473-475（getDb reconcile 与错误分支） |
| `lib/store.ts` | 91.4% / branch 88.2% | 180-187,210,264（W-F seam 邻域） |
| `db/schema.ts` | 50% | 42（drizzle 声明，低风险，可豁免） |
| **components/** | **完全不可见** | 见 2.2 工具链故障 |

### 2.2 coverage 工具链故障（W-T0 修复项，盲区定位的前置）

- `@vitest/coverage-v8` 生成报告时抛 **rolldown `PARSE_ERROR`**（`parseAstAsync` 链路），导致 components/ 整目录从报告消失——当前 90% 的数字是**残缺报告**，「更充分的测试」必须先修工具链否则盲区定位失真。
- vitest 报告：jsdom 每 file 重建 ×30（20.89s，占 57% 时长）；官方建议 `pool: 'vmThreads'` 或 `isolate: false`——测试基建提速候选（需评估隔离性代价）。

### 2.3 性能面快照

- bundle：最大 chunk 224KB + 160KB + 112KB（未压缩；gzip 后待定性——vendor/app 占比分析未做，W-OPT 侦察项）。
- D-1（已裁决）：`Geist({preload:false})` 拆除 Link 头 font preload，两类偶发警告源断根；代价由 font-display:swap + Geist Fallback（size-adjust 校准）兜底。
- 既有待办（历史缓议，不在本波强承诺）：`lib/db-path.ts` 单一常量源抽取消（RC-drift §4.1 P1-4/P1-5）。

### 2.4 review 面（W-RV 输入清单）

功能面四提交：`9fe08a0`（reset 端点家族 + ResetRoomStatsButton）、`e15e049`（ResultNavigator W-F seam）、`1c3899e`（ResultCelebration）、`2d8f8d4`（OnlineGateMount）。高危存量面：`lib/store.ts`、`lib/db.ts`、`components/Board.tsx`、`public/sw.js`。

## 三、波次草案（正交拆解，herdr 派发）

| 波 | 内容 | 席位角色 | 产出 |
| --- | --- | --- | --- |
| W-T0 | coverage 工具链修复（PARSE_ERROR 定位与修复）+ vitest pool 评估 | worker.coder（小改） | 完整 coverage 报告可复现 |
| W-T | 测试加固：§2.1 盲区逐项补齐（分支覆盖优先）+ mutation 触发评估（lib/game.ts、lib/store.ts 高危面） | worker.test | 盲区清零或显式豁免清单 |
| W-RV | reviewer.code 只读评审 §2.4 清单（正确性/可读性/架构/安全/性能五维） | reviewer.code | patch-anchored findings |
| W-OPT | 代码优化（消费 W-RV findings）+ 性能优化（D-1 拆除 + bundle 定性与可行动项） | worker.coder | 优化提交（逐项原子） |
| W-AB | 消融实验（对象见 §七 Q1） | scientist.ablation | keep/kill/校准提案 |
| W-V | fresh-context 对抗终验 + V 报告入档 | auditor.acceptance / 终验席 | V13 报告 |
| 收尾 | digest sync（AGENTS.md 三文件）+ sessions capture + tab 清场 | 调度者 | 契约同步 |

依赖序：W-T0 → W-T；W-RV ∥ W-T（只读与测试互斥写入面）；W-OPT 消费 W-RV + W-T；W-AB、W-V 收口。

## 四、验收标准（草案，定稿时逐条机器化）

1. coverage 完整报告（含 components/）产出且 PARSE_ERROR 消除；盲区表逐项闭合（补测试或书面豁免）。
2. review findings 逐条处置（fix / 显式不修 + 理由），无静默忽略。
3. D-1 落地后 `sw-console-hygiene`（强化版）全绿；Link 头零 font 条目断言生效。
4. 六层门禁每 commit 全绿；lore trailer + Plan footer 齐全；零 push。
5. 消融实验带 baseline/ablated 对比数据与 keep/kill 结论。
6. 终验 fresh-context 对抗通过后 V13 入档。

## 五、红线（延续既有契约）

六层门禁；禁 `--no-verify`；禁 `git add . / -A`；push 等主公指令；主 worktree :3000 dev 在线时禁 build（波次构建走独立 worktree）；herdr 每席独立 worktree、QA 端口分片、rebase + ff-only 保线性；`NEXT.JS 16 agent-rules` 块不可动。

## 六、风险与缓议

- vmThreads/isolate 调整可能改变测试隔离语义——W-T0 只评估、有实据再动，不与 W-T 混装。
- bundle 224KB chunk 若为 React/Next vendor 主体，可行动空间有限（无依赖增删约束），W-OPT 只做「定性 + 可行动项」，不为压数字引入风险。
- schema.ts 50% 为声明性代码，建议书面豁免不硬凑。

## 七、待主公补充信息（补齐后定稿）

- **Q1 消融对象**：主公所言「消融实验」指（a）对本波优化变更做 baseline vs ablated 因果对比（如 D-1 拆除前后的警告频次/FOUT 时长），还是（b）沿用仓库先例对验证门禁组件做消融（`.omo/plans/agents-orthogonality-audit.md` 范式），或两者都要？
- **Q2 优化偏好**：性能面优先级排序（bundle 体积 / 运行时渲染 / 网络与缓存 / 测试基建速度）；代码优化接受度（纯内部质量重构是否在授权内，还是仅修 review findings）。
- **Q3 review 范围**：仅 §2.4 功能面四提交，还是扩展到全仓核心面（store/db/Board/sw.js 全量）？
- **Q4 测试加深边界**：mutation 测试是否本波触发（耗时显著）；`@deprecated` 旧 surface（offline-stats 103,149）补测试还是随退役清理。
- **Q5 执行形态**：多席并行（herdr 四席）推进，还是小波串行逐席汇报？
- **Q6 其他补充**：主公提及「还有很多要补充的信息」——补充后并入本节或修订波次。
