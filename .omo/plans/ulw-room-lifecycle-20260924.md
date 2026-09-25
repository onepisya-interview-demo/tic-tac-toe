# 计划：房间生命周期管理——删除 / 退出 / TTL 自动回收 / 预防强化（ulw）

> 性质：执行计划，待主公批准后派发。裁决来源：主公 2026-09-24——「A 退出 + B 销户删除 + C TTL 自动回收 + D 预防强化全做；退出/删除时本地战绩清零」。裁决动机：Turso demo 库免费额度有限，数据本来就要定时清（C 不是锦上添花是运维必需）。
> 关联：T-M1（合并弹框身份锁定 + 首次回写，[ulw-sync-dialog-identity-lock-20260924.md](ulw-sync-dialog-identity-lock-20260924.md)）已批待派，本计划与其串行衔接。基线：dev @ b980b39。

---

## 一、主公裁决评估（调度者意见，已附票面）

| 项 | 评估 |
|---|---|
| A+C 组合 | ✅ 自洽且必要——C 直击 Turso 免费额度现实，把数据清理从产品功能升级为运维刚需；孤儿账本（无 PII 计数器）由 TTL 兜底 |
| B 销户删除 | ✅ 攻击面（知道房间名即可删）在 demo 语境可接受，且**自愈路径存在**：删除后对原房间 `POST /api/rooms` 幂等重建全零账本——损害封顶为「账本清零」而非永久损坏；另一设备视角已有现成契约（rooms-race step 5 验证的 404 + OutcomeErrorBanner） |
| D 预防 | ✅ 近零成本；大部分已具备（hint / isRoomName whitelist / n/24 计数），增量是提交确认文案 |
| 退出清零 | ✅ 正确——保留战绩换绑会把 T-M1 堵住的「战绩投错房间」口子重新打开 |

**与既有裁决的衔接修订**（本计划必须显式处理，否则统一语言/R6 打架）：
- D-1（否决 DELETE 行）边界澄清：否决的是 *reset 场景*删行（清计数≠销户）；本计划引入的是**用户主动销户**新语义，两者并存。
- D-5 术语表 `_Avoid_「删除房间」`**解禁并转正**：产品从此有真实删除操作，CONTEXT.md 同步定义「删除房间（delete-room）」vs「清空（reset-room-stats）」vs「退出（leave-room，若做）」。
- D-2 的「动作端点家族」惯例延续，但本票语义就是资源销毁——**用 `DELETE /api/rooms/[room]` 资源动词**（此时它不再有歧义）。

## 二、票面

### T-N1：服务端销户——service + DELETE 端点 + 单测

- **service**：`lib/db.ts` 新增 `deleteRoomByRoom(room)`：`withWriteLock` + `db.transaction` 包裹内 `DELETE FROM game_stats WHERE room = ?`；返回具名结果 `{ ok: true, deleted: true }` / `{ ok: false, reason: 'not-found' }`（防静默建档同款纪律，缺行也是合法的删除终态——幂等语义见 AC）。
- **端点**：`app/api/rooms/[room]/route.ts` 新文件，`DELETE` handler：200 `{ ok: true }` / 404 `room-not-found`（problem+json，复用现役 slug，零新增或最小新增）/ 422 `invalid-room-name` / 500 `db-unavailable`；`runtime='nodejs'` + `dynamic='force-dynamic'`。
- **行为契约**（写入 service 注释 + README 边界注）：删除后原房间名可被重新 `POST /api/rooms` 幂等重建为全零账本；删除时刻起对原房间的 outcomes/merge 返回 404/409（现役 banner 链路承接，rooms-race step 5 已验证）。
- **单测**：service 层（含 not-found、withWriteLock 串行、事务包裹）；transport 层 status 映射。
- **AC**：vitest 基线不减全绿；typecheck/lint 绿；R6 零违例；负面清单：不碰 merge/outcomes/reset 现役端点、不碰前端。

### T-N2：前端双入口——退出房间（A）+ 删除房间（B）

- **入口位置**：`/result` 页房间管理区（与 `ResetRoomStatsButton` 同区，语义分组：「清空战绩」（保留身份）/「退出房间」（A）/「删除房间」（B））；按钮文案与上述一致。
- **A「退出房间」**：轻确认弹层（明示「本机 N 局战绩将一并清除，服务端账本保留——其他设备可继续使用该房间」）→ 单次确认执行：`setRoomName(null)` 清身份 + offline stats 清零 → 导航回首页（无身份态）。零网络写。
- **B「删除房间」**：确认弹层：明示后果（「服务端战绩与本机绑定将一并删除，多设备同房间将看到 404 错误条，可重新进入房间重建」）+ **type-to-confirm**（输入房间名完全匹配才可执行——行业标准模式）→ 执行序列：`DELETE /api/rooms/{room}` → 成功后本地全清（`setRoomName(null)` + offline stats 清零）→ 导航回首页。
- **失败路径（B）**：404（已不存在）视为成功继续本地清；网络失败 → 错误提示、本地不清（不留半清除态）。
- **单测**：两个弹层的确认逻辑（A 轻确认 / B type-to-confirm 匹配）、成功/404/失败路径、本地清理调用断言、A 零网络写断言。
- **AC**：同 T-N1 门禁标准；负面清单：不碰 SyncConfirmDialog（T-M1 领地）、不碰 service 层。
- **依赖**：B 依赖 T-N1 端点契约；A 纯前端无依赖。

### T-N3：TTL 自动回收——purge service + 维护端点 + Vercel Cron

- **service**：`purgeStaleRooms(maxAgeDays = 30)`：`withWriteLock` 内 `DELETE FROM game_stats WHERE updated_at < :cutoff`，返回 `{ deletedCount }`。
- **维护端点**：`app/api/maintenance/purge/route.ts`（POST + GET 同 handler）：校验 `CRON_SECRET`（Authorization Bearer / header），未授权 401；执行 purge 返回 `{ deletedCount, cutoffDays }`。
- **调度**：`vercel.json` 增 `crons: [{ path: "/api/maintenance/purge", schedule: "0 3 * * *" }]`（Hobby plan 支持每日 1 次，上限内）；`CRON_SECRET` 进 Vercel 环境变量（部署注记写入 operations.md，**不入仓不入探针**）。
- **本地/手动通道**：`docs/operations.md` 补手动触发命令（curl 带 secret）与 TTL 语义说明；`pnpm` 侧不加脚本（运维低频，curl 足够）。
- **单测**：service（cutoff 边界、返回计数）；端点鉴权（401/200）。
- **裁决默认值**：TTL = **30 天不活跃**（`updated_at` 口径），主公可改一个常数。
- **AC**：同标准；负面清单：不碰用户侧五端点。

### T-N4：预防强化（D）——提交确认文案

- **范围**：RoomGateDialog 与合并弹框的无身份收名路径，提交前回显「将创建/进入房间【X】——房间名永久绑定该账本，创建后不可修改」（复用现役 hint 文案做成确认层或按钮旁强提示，二选一以最小改动为准）。
- **输入规范化**：现状已具备 trim / whitelist / n/24 计数，无增量改动（票面确认即可，不为改而改）。
- **AC**：单测覆盖确认文案渲染；门禁标准同上。

### 探针与业务规则

- **BR-12 补条**（docs/business-rules.md）：房间生命周期——decree：删除房间销户服务端数据并可重建；TTL 兜底孤儿；删除是唯一销户通道。反面场景：①对不存在房间 DELETE → 404 不静默；②删除后 outcomes → 404 banner（现役链路）；③删除后重进 → 全零新账本（不复活旧数据）。
- **探针**：rooms-race-qa 追加 step 9（建 → DELETE → 404 → 重进 → 全零），替换 step 5 的直连 DB 模拟为真 API 双验证（step 5 保留，两条通道互补）。
- **CONTEXT.md**：D-5 术语修订（见 §一）。

## 三、正交性与波次

| 票 | 文件面 | 并行性 |
|---|---|---|
| T-M1（已批） | SyncConfirmDialog + store 身份语义 | 先派（身份语义先行，T-N2 消费其心智模型） |
| T-N1 | lib/db.ts + 新 route | 契约定死后可与 T-N3/T-N4 并行 |
| T-N2 | result 页区新组件 | 依赖 T-N1 契约，文件面与 T-M1 不相交可并行 |
| T-N3 | lib/db.ts purge + 新 route + vercel.json | 与 T-N1 同文件面（lib/db.ts）→ **同席串行或分波** |
| T-N4 | RoomGateDialog 文案 | 独立可并行 |

**建议波次**：波1 = T-M1（先派，已批）；波2 = T-N1 + T-N3 同席串行（共享 lib/db.ts 面）∥ T-N2 ∥ T-N4；波3 = 探针 + BR-12 + CONTEXT.md 收口（调度者亲自动或随 T-N2 席带）。合流后调度者终验（六层门禁 + Vercel Cron 注记核对——cron 实际生效需部署后看 Vercel Dashboard，列入移交主公项）。

## 四、移交主公项（部署侧）

1. Vercel Dashboard 配 `CRON_SECRET` 环境变量（值不入仓）；
2. 部署后在 Vercel → Cron Jobs 确认任务注册与首次执行；
3. TTL 天数如需调整（默认 30 天）改 `purgeStaleRooms` 默认参数一处。
