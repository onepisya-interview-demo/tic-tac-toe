# 业务规则清单（Business Rules）

> **主公 decree 的外化真源。** 每条用户可见行为规则必须：(1) 正向 + **反面**场景都写明；(2) 挂可执行探针（tests/qa/*.mjs 或组件测试，指明文件）；(3) 注明来源。
> **为什么存在**：2026-09-22 合并弹框事件——467 测试全绿但业务规定被破坏（[learnings §32](learnings.md)）。六层门禁只验 code-vs-spec；spec-vs-intent 只有本文件 + aligned 门能拦。
> **新增规则流程**：主公 decree → 本文件加条目（反面场景必填）→ 补/改探针 → 翻转组件测试 → plan 入档。改任何「触发时机 / 拦截 / 弹框」类代码前，先过本清单。

## 规则索引

| # | 规则 | 正向场景（什么时候发生） | 反面场景（什么时候**不**发生） | 探针 |
| --- | --- | --- | --- | --- |
| BR-1 | **合并战绩弹框仅在「离线局 → 首页」导航转换时出现** | 在 /offline 玩完局 → 点「返回首页」软导航回 `/` 且 pending > declined → 弹框 | 直接打开 / 硬刷新首页不弹；从 /online、/result 回首页不弹；同会话 pending 无增量（≤ declined 哨兵）不弹 | `home-return-qa.mjs`（负向 step + step02/04）+ `HomeDialogMount.test.tsx` |
| BR-2 | 首页「开始对战」零拦截 | 无名点开始 → RoomGateDialog 引导；有名点开始 → 直接进对局 | 首页起战不因合并弹框被拦（弹框不抢焦点导航） | `home-return-qa.mjs` step03 + `online-direct-qa.mjs` |
| BR-3 | 首页零 API 写 | 首页渲染 / 起战全程 `/api/*` 写 = 0 | —（无例外） | `home-return-qa.mjs` step03 强断言 |
| BR-4 | /offline 100% 纯本地 | 离线局全程零网络、战绩写 localStorage | 断网可完整玩 + 记录 | `offline-qa.mjs` / `offline-mode-qa.mjs` |
| BR-5 | POST /merge 仅用户主动确认 | 弹框点「合并并清空」才发 merge | 确认前零调用；409 防静默建档；用户拒绝 = 零网络写 | `home-return-qa.mjs` step04/05 + `merge-sync-qa.mjs` |
| BR-6 | 同名并发 last-write-wins | 两设备同名并发合并，后写胜出 | —（无例外） | `concurrent-surface-qa.mjs` |
| BR-7 | 重置清零保留身份 | POST /reset 清零战绩，房间名保留 | 重置不丢身份；前端入口需确认 | `room-reset-qa.mjs` |
| BR-8 | /online 直达门控 | 未完成身份引导时直达 /online 被 RoomGate 拦截引导 | 门控不产生静默建档 | `online-direct-qa.mjs` |
| BR-9 | 弹框初焦落主 CTA | 合并弹框打开后初焦点落「合并并清空」（rAF） | 初焦不落在「保留本地」/输入框 | `HomeDialogMount` 关联组件测试 |
| BR-10 | 合并/上报不静默建档 | merge 对未登记房间 409；outcomes 对未知房间 404 | 服务端不因孤儿请求静默创建行 | `merge-sync-qa.mjs` |

## 维护约定

- **反面场景列是必备半边**——写不出反面场景的规则说明还没想清楚边界，退回 aligned 门。
- 「⚠ 未探针化」的条目 = 规则已 decree 但缺可执行探针，补探针前该规则只有文档约束力。
- 本表初版（2026-09-22）由既有 plan/anti-patterns 蒸馏 + BR-1 新 decree 合成；蒸馏条目的反面场景列建议主公抽查一次（aligned 门），BR-1 已当面 decree。
- 来源标记：BR-1 = 主公 decree 2026-09-22（[plan](../.omo/plans/ulw-home-merge-trigger-spec-20260922.md)）；BR-2..10 蒸馏自 `docs/anti-patterns.md` L1 条目与对应 ulw plan 验收。
