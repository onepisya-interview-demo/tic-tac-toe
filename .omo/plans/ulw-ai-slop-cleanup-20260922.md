# 计划：dev @ 932835f AI slop 清理（共享谓词 + 删孤儿 JSDoc）

Intent: 在 dev @ 932835f vs main @ 51f164c 的 201 文件变更中，应用 `$omo:remove-ai-slops` skill 做行为不变的质量清理。
Scope：仓库内真实源码 / 配置（剔除 prose / binary / vendor / lockfiles）共 109 文件；本轮清理 4 文件。

## 基线（Phase 2 已确认）

- pnpm test: Test Files 37 passed (37), Tests 467 passed (467) —— 行为已锁定
- pnpm typecheck: 0 errors
- pnpm lint: 0 errors
- node tests/qa/commit-audit.mjs --branch dev: 333 commits, 327 pass, 6 skip, 0 fail
- 变更期变更面 4 文件，已逐文件审查；其余 105 文件无可识别 slop（WHY-注释 + boundary validators + documented intent，无须动）

## 删除阶梯（Phase 3）按文件

### lib/game.ts
- Ladder: simplify-in-place
- 唯一动笔：新增 `GAME_STATS_KEYS` 常量 + `isGameStats` 谓词（pure type guard，无 DOM / I/O 依赖，浏览器 + Node runtime 两侧皆可用）。
- 风险：低。两条新增导出（命名 + 文档 + 实现）；既有导出零变更。

### lib/offline-stats.ts
- Ladder: reuse（lib/game.ts 新增的 isGameStats）
- 删除本地 inline `isGameStats` 谓词（24 行 + 4 行说明性注释），改 import 共享谓词。
- 4 行说明性注释语义迁入 lib/game.ts 的 JSDoc（canonical 位置）。
- 风险：低；现有 5 个测试断言对 `loadOfflineStats()` 行为（missing / invalid / non-GameStats shape → emptyStats()）零变化。

### app/api/rooms/[room]/stats/merge/route.ts
- Ladder: reuse（lib/game.ts 新增的 isGameStats）
- 删除本地 inline `isGameStatsShape` 谓词（12 行），改用共享 `isGameStats`；`isMergeBody` 内部调用同步更新。
- 风险：低；现有 4 个测试（tests/api/rooms-stats.test.ts）覆盖 merge 路由 + body validator 行为不变。

### lib/db.ts
- Ladder: delete entirely（orphan JSDoc）
- 删除 314-316 行孤儿 JSDoc（"Close the cached client (used by tests / shutdown)." 注释下方紧跟另一个 JSDoc 中间无函数）。
- 实际 `closeDb` 函数在 483 行仍存在；测试通过 `import { closeDb } from '@/lib/db'` 引用（tests/db/db.test.ts 多处），零回归。
- 风险：极低；纯注释删除。

## 显式跳过（按 SKILL.md KEEP 规则）

- **OFFLINE_SYNCED_SERVER_KEY + 3 个旧 helpers**（loadSyncedServerTotal / persistSyncedServerTotal / clearSyncedServerTotal）：被 `tests/lib-offline-stats.test.ts` 5 处直接引用（语义 = "backward-compat reads + test surface"），Category 6 KEEP：removed-but-still-referenced code。
- **NAME_MAX = 24 三处重复**（lib/room-name.ts / RoomGateDialog.tsx / SyncConfirmDialog.tsx）：whitelist 层 vs UI 层 intent 不同，强行耦合反而制造分歧路径；Category 7 KEEP：incidental duplication。
- **void existed / void storeRoomName 两处**：JSDoc 显式标注「future use / lint appeasement」属显式合约决定；Category 4 KEEP：abstractions that provide real seam。
- **eslint-disable react-hooks/set-state-in-effect 五处**：每处上方均有 JSDoc 解释 cascading-render 顾虑不适用（mount-time 一次性 read external system → state），Category 2 KEEP：boundary pattern。
- **transport 边界 validators**（isRoomBody / isMergeBody / isOutcomeBody / isOutcomeValue）：HTTP 边界系统输入验证，Category 2 KEEP：system boundaries。

## 验收证据

- pnpm test: 467/467 PASS（基线 467，无新增）
- pnpm typecheck: 0 errors
- pnpm lint: 0 errors
- pnpm build: Compiled successfully (1.1s), 8 static + 5 dynamic routes
- node tests/qa/commit-audit.mjs --branch dev: 0 violations
- 负对照: 临时移除 `isGameStats` 导出 → tsc 报 TS2724 (route.ts + offline-stats.ts 双重依赖) → 门禁生效

## 行数对比

| File | +/- |
|---|---|
| lib/game.ts | +38 |
| lib/offline-stats.ts | -27 |
| app/api/rooms/[room]/stats/merge/route.ts | -17 |
| lib/db.ts | -3 |
| **净变化** | **+47/-39 = +8** |

## Commit

- type: `refactor(slop)`
- subject: 共享 game stats shape 谓词 + 删孤儿 JSDoc
- 一笔原子提交（4 文件同一主题）
