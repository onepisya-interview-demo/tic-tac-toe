# Features 功能地图（BR decree → 功能面）

> **来源**：[docs/business-rules.md](./business-rules.md) 12 条 decree 的功能视角重排（验证基建路线图票 12 生成，Plan: `.omo/plans/ulw-verification-infra-roadmap-20261007.md` §七 票 12）。
> **分工**：规则真源仍是 business-rules.md（正/反面场景、来源、R6 探针列格式契约都在那边）；本地图回答「产品对用户呈现哪些功能，每个功能由哪些 BR 守着、从哪里验证」。两边冲突时以 business-rules.md 为准并回改本表。
> **用法**：验证/走查时按功能区块找探针入口；改「触发时机 / 拦截 / 弹框」类代码前先过本地图定位受影响 BR，再读 business-rules.md 对应条目的完整正反面场景。

## 功能区块总表

| 功能区块 | 覆盖 BR | 一句话（用户视角） | 主验证入口 |
| --- | --- | --- | --- |
| 首页引导与起战 | BR-2, BR-3, BR-8 | 首页零 API 写；无名点开始弹框收名，有名直达对局 | `tests/qa/home-return-qa.mjs` + `tests/qa/online-direct-qa.mjs` |
| 离线对局（纯本地） | BR-4 | /offline 100% 纯本地，断网可玩可记录 | `tests/qa/offline-qa.mjs` + `tests/qa/offline-mode-qa.mjs` |
| 在线对局与战绩账本 | BR-6, BR-10, BR-12 | 服务端权威精确累加，不静默建档，删除销户＋TTL 兜底 | `tests/qa/rooms-race-qa.mjs` |
| 战绩重置 | BR-7 | 重置清零战绩，房间身份保留 | `tests/qa/room-reset-qa.mjs` |
| 离线战绩合并（弹框） | BR-1, BR-5, BR-9, BR-11 | 仅「离线局→首页」导航转换弹框，确认才合并，初焦落主 CTA | `tests/qa/home-return-qa.mjs` + `components/HomeDialogMount.test.tsx` |
| 身份一致性（本机唯一） | BR-11 | 弹框投递目标＝本机身份，合并不改既有身份 | `tests/qa/one-identity-qa.mjs` + `tests/qa/home-return-qa.mjs` |

## 逐条 BR 功能行

> 探针路径均为仓库根相对（同 business-rules.md 探针列格式约定）；「组件/DB 测试」为 vitest 面，随层①跑。

### 首页引导与起战

- **BR-2 首页「开始对战」零拦截**——无名点开始 → RoomGateDialog 引导收名；有名点开始 → 直接进对局；起战不因合并弹框被拦。验证：`tests/qa/home-return-qa.mjs` step03 + `tests/qa/online-direct-qa.mjs`。
- **BR-3 首页零 API 写**——首页渲染/起战全程 `/api/*` 写 = 0，无例外。验证：`tests/qa/home-return-qa.mjs` step03 强断言。
- **BR-8 /online 直达门控**——未完成身份引导时直达 /online 被 RoomGate 拦截引导，门控不产生静默建档。验证：`tests/qa/online-direct-qa.mjs`。

### 离线对局（纯本地）

- **BR-4 /offline 100% 纯本地**——离线局全程零网络、战绩写 localStorage，断网可完整玩＋记录。验证：`tests/qa/offline-qa.mjs` + `tests/qa/offline-mode-qa.mjs`。

### 在线对局与战绩账本

- **BR-6 同房间并发写精确累加（不丢不重）**——两设备同名并发记局/合并，账本精确＝实际局数（进程内互斥＋事务包裹）。验证：`tests/qa/rooms-race-qa.mjs` step 1 + `tests/db/lost-update-mutex.test.ts` + `tests/db/turso-remote-race-feasibility.test.ts`（远程回归锚，双门跳过）。
- **BR-10 合并/上报不静默建档**——merge 对未登记房间 409；outcomes 对未知房间 404，服务端不因孤儿请求静默创建行。验证：`tests/qa/rooms-race-qa.mjs` step 5 + step 8。
- **BR-12 删除房间销户＋TTL 兜底**——DELETE 销户服务端行；同名重建幂等回全零账本；30 天不活跃 TTL 自动回收；对不存在房间 DELETE 404 不静默销户。验证：`tests/qa/rooms-race-qa.mjs` step 9 + step 5（双通道互补）。

### 战绩重置

- **BR-7 重置清零保留身份**——POST /reset 清零战绩，房间名保留；重置不丢身份。验证：`tests/qa/room-reset-qa.mjs`。

### 离线战绩合并（弹框）

- **BR-1 合并战绩弹框仅在「离线局 → 首页」导航转换时出现**——/offline 玩完局软导航回 `/` 且 pending > declined 才弹（`afterViewTransition` 推迟 showModal）；直接打开/硬刷新首页、从 /online /result 回首页、同会话无增量均不弹。验证：`tests/qa/home-return-qa.mjs` + `components/HomeDialogMount.test.tsx`。
- **BR-5 POST /merge 仅用户主动确认**——弹框点「合并并清空」才发 merge；确认前零调用；409 防静默建档；拒绝＝零网络写。验证：`tests/qa/home-return-qa.mjs` step04/05。（历史探针 `tests/qa/merge-sync-qa.mjs` 头注 DISABLED——ulw-name-login-one-truth W2/W3 退役面，不在走查清单，见 `scripts/verify-all.mjs` 探针清单。）
- **BR-9 弹框初焦落主 CTA**——合并弹框打开后初焦点落「合并并清空」（rAF），不落「保留本地」/输入框。验证：`components/HomeDialogMount.test.tsx`（组件测试，无浏览器探针）。

### 身份一致性（本机唯一）

- **BR-11 合并弹框投递目标＝本机身份**——有身份 → input readOnly 显示 current room name；无身份 → 可输入（首次收名），合并成功后身份落 localStorage（key = `ttt.room.name.v1`）；合并不改变既有身份。验证：`tests/qa/home-return-qa.mjs` step 10/11 + `tests/qa/one-identity-qa.mjs`（本机身份面整合探针）。

## 维护约定

- 本地图由 business-rules.md 派生：BR 条目增删/修订时同步本表（BR 覆盖须保持 12/12 对齐真源条数）；探针退役（如 DISABLED）时更新对应「验证」注记。
- 不在本表新造规则——新 decree 先入 business-rules.md（含反面场景与探针列），再回写本地图。
- 逐条 BR 的完整正/反面场景与来源标记见 [docs/business-rules.md](./business-rules.md) 规则索引表。
