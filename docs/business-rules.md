# 业务规则清单（Business Rules）

> **主公 decree 的外化真源。** 每条用户可见行为规则必须：(1) 正向 + **反面**场景都写明；(2) 挂可执行探针（tests/qa/*.mjs 或组件测试，指明文件）；(3) 注明来源。
> **为什么存在**：2026-09-22 合并弹框事件——467 测试全绿但业务规定被破坏（[learnings §32](learnings.md)）。六层门禁只验 code-vs-spec；spec-vs-intent 只有本文件 + aligned 门能拦。
> **新增规则流程**：主公 decree → 本文件加条目（反面场景必填）→ 补/改探针 → 翻转组件测试 → plan 入档。改任何「触发时机 / 拦截 / 弹框」类代码前，先过本清单。

## 规则索引

| # | 规则 | 正向场景（什么时候发生） | 反面场景（什么时候**不**发生） | 探针 |
| --- | --- | --- | --- | --- |
| BR-1 | **合并战绩弹框仅在「离线局 → 首页」导航转换时出现** | 在 /offline 玩完局 → 点「返回首页」软导航回 `/` 且 pending > declined → 弹框（`afterViewTransition` 推迟 showModal 出 150/250ms VT 窗口） | 直接打开 / 硬刷新首页不弹；从 /online、/result 回首页不弹；同会话 pending 无增量（≤ declined 哨兵）不弹；弹框开启不与 VT 快照同窗 | `tests/qa/home-return-qa.mjs`（负向 step + step02/02b/02c/04） + `components/HomeDialogMount.test.tsx` |
| BR-2 | 首页「开始对战」零拦截 | 无名点开始 → RoomGateDialog 引导；有名点开始 → 直接进对局 | 首页起战不因合并弹框被拦（弹框不抢焦点导航） | `tests/qa/home-return-qa.mjs` step03 + `tests/qa/online-direct-qa.mjs` |
| BR-3 | 首页零 API 写 | 首页渲染 / 起战全程 `/api/*` 写 = 0 | —（无例外） | `tests/qa/home-return-qa.mjs` step03 强断言 |
| BR-4 | /offline 100% 纯本地 | 离线局全程零网络、战绩写 localStorage | 断网可完整玩 + 记录 | `tests/qa/offline-qa.mjs` + `tests/qa/offline-mode-qa.mjs` |
| BR-5 | POST /merge 仅用户主动确认 | 弹框点「合并并清空」才发 merge | 确认前零调用；409 防静默建档；用户拒绝 = 零网络写 | `tests/qa/home-return-qa.mjs` step04/05 + `tests/qa/merge-sync-qa.mjs` |
| BR-6 | 同房间并发写精确累加（不丢不重） | 两设备同名并发记局/合并，单进程内账本精确 = 实际局数（进程内互斥 + 事务包裹，71ad38d） | 多实例部署仍 last-write-wins（README 边界注承担；E7 实测失败回滚泄漏文件锁需客户端回收） | `tests/qa/rooms-race-qa.mjs` step 1 + `tests/db/lost-update-mutex.test.ts`（10 轮精确断言） |
| BR-7 | 重置清零保留身份 | POST /reset 清零战绩，房间名保留 | 重置不丢身份；前端入口需确认 | `tests/qa/room-reset-qa.mjs` |
| BR-8 | /online 直达门控 | 未完成身份引导时直达 /online 被 RoomGate 拦截引导 | 门控不产生静默建档 | `tests/qa/online-direct-qa.mjs` |
| BR-9 | 弹框初焦落主 CTA | 合并弹框打开后初焦点落「合并并清空」（rAF） | 初焦不落在「保留本地」/输入框 | `components/HomeDialogMount.test.tsx` |
| BR-10 | 合并/上报不静默建档 | merge 对未登记房间 409；outcomes 对未知房间 404 | 服务端不因孤儿请求静默创建行 | `tests/qa/rooms-race-qa.mjs` step 5（outcomes→404） + `tests/qa/merge-sync-qa.mjs`（DISABLED 存根；merge→409 半边待 triage） |


## 探针列格式约定（机器可校验）

> 2026-09-23 立。`tests/qa/commit-audit.mjs` R6（`auditBrProbeBinding`）双向机械校验本表与探针文件的耦合。改动探针列 = 同步 PR；缺格式 = R6 阻断。

- **路径统一仓库根相对**：每个引用必须是仓库根相对路径（如 `tests/qa/home-return-qa.mjs`、`components/HomeDialogMount.test.tsx`），用反引号包裹；禁止裸文件名（`home-return-qa.mjs` 已退役，禁止新加）。
- **多个探针用「 + 」分隔**；步骤细节可放在括号里（如 `tests/qa/home-return-qa.mjs` step03 强断言）——R6 仅校验文件存在与头注释，步骤描述是给人看的。
- **探针头必须反向引用 BR**：每个被引用的探针/测试文件，前 20 行内须含 `// BR: BR-N[, BR-M]` 行（逗号分隔、按升序）。R6 检查文件首 20 行是否含 BR-N 文本。
- **缺探针条目标 `⚠ 未探针化`**：探针列直接写 `⚠ 未探针化` 即可豁免 R6；R6 只校验有路径的探针。
- **R6 失效 = 阻断**：`--branch dev` 模式跑全分支 audit，R6 失败 exit 1、commit-msg hook 同步阻止提交。

## 维护约定

- **反面场景列是必备半边**——写不出反面场景的规则说明还没想清楚边界，退回 aligned 门。
- **探针闭环强制**（2026-09-22）：新增/修订 BR 条目时探针列不得留空——留空的规则只有文档约束力，**禁止被后续 wave 的 plan 引用为「已对齐」**；探针缺口标「⚠ 未探针化」并在该 plan 内补齐或显式 defer（defer 须主公确认）。
- 「⚠ 未探针化」的条目 = 规则已 decree 但缺可执行探针，补探针前该规则只有文档约束力。
- 本表初版（2026-09-22）由既有 plan/anti-patterns 蒸馏 + BR-1 新 decree 合成；蒸馏条目的反面场景列建议主公抽查一次（aligned 门），BR-1 已当面 decree。
- 来源标记：BR-1 = 主公 decree 2026-09-22（[plan](../.omo/plans/ulw-home-merge-trigger-spec-20260922.md)）；BR-2..10 蒸馏自 `docs/anti-patterns.md` L1 条目与对应 ulw plan 验收。
- 意图块（Feature/Rule/Scenario）的 Rule 层直接引用本表 BR 编号——本表是「意图 → 探针」闭环的枢纽（[requirement-intake §4.3](./requirement-intake.md)）。
