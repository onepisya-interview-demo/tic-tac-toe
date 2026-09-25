# 计划：合并弹框身份锁定（ulw）

> 性质：执行计划，待主公批准后派发。裁决来源：主公 2026-09-24 发现「合并时改房间名也能并进去 / 结果页永远绑定 onepisya」，经代码取证后主公裁决：**A 案（有身份时输入锁定）+ 首次收名回写身份**。
> 基线：dev @ b980b39，vitest 505+8 skip 全绿。

---

## 一、事实链（已核实）

| # | 事实 | 证据 |
|---|---|---|
| 1 | 合并弹框输入框可自由编辑，预填本机身份名 | `components/SyncConfirmDialog.tsx:232`（`onChange={setName}`） |
| 2 | 确认时用**输入框里的名字**发 `POST /api/rooms`（幂等：新名=静默注册新房间）+ `POST /merge` | `runMergeSequence()`（SyncConfirmDialog.tsx:150 附近） |
| 3 | 确认链**不回写** localStorage 身份 | `handleConfirm` → `onConfirm(trimmed)`（HomeDialogMount 只做清零+基线） |
| 4 | 身份唯一写入点是 online 入口 RoomGateDialog（验证通过才写） | `components/RoomGateDialog.tsx:27`（`ok → 此刻才写 localStorage (setRoomName)`） |
| 5 | `/result` 从 URL `?room=` 取账本，在线模式带的永远是本机身份 | `app/result/page.tsx:53` |
| 6 | 输入框正下方 hint：「房间名永久属于该账本，创建后不可修改。」 | `sync-confirm-lock-hint`（SyncConfirmDialog.tsx:240 附近） |
| 7 | BR-1..10 对弹框改名语义零覆盖 | `docs/business-rules.md` |

**根因**：弹框输入框实为「本次战绩的投递目标选择器」，但交互上像改名框。改名合并 → 战绩进目标房间、本机身份不变 → `/result` 永远显示本机身份账本 → 投出去的局「消失」；且 hint 承诺锁定、行为允许投递，自相矛盾。

## 二、主公裁决（2026-09-24）

1. **A 案**：本机已有身份时，弹框输入框只读、显示当前房间名（不可改）；无身份时保留输入（首次收名是弹框设计职责，不能砍）。
2. **首次收名回写**：无身份用户在弹框首次收名、登记成功后，**应写入 localStorage**（`setRoomName`）确立身份——否则每次合并都要重收名，且之后 online 收名会再造新账本，战绩分散。

## 三、票面

### T-M1：SyncConfirmDialog 身份锁定 + 首次回写（fresh codex 席）

- **改动**：
  - 有身份（`initialName` 非空）→ `<input readOnly>`（或等价只读实现，保留可读样式与锁定 hint）；无身份 → 可输入（现状）。
  - 确认序列成功后：若此前无身份 → `setRoomName(trimmed)` 回写（store + localStorage 镜像，复用 `lib/store.ts` 现有 action，与 RoomGate「登记成功才写」契约对齐）；有身份 → 身份不变（现状）。
  - 文案核对：锁定 hint 与新行为自洽，无需改文案（若实现上无身份时 hint 不显示，保持现状）。
- **单测**（SyncConfirmDialog.test.tsx）：
  - 有身份：input 只读断言 + 值 = 身份名；
  - 无身份：可输入；确认成功后 `setRoomName` 被以输入名调用；
  - 有身份：确认成功后身份不变（不产生回写调用）。
- **BR-11 补条**（docs/business-rules.md，R6 探针映射同步）：
  - decree：合并投递目标 = 本机身份；无身份时首次收名确立身份。
  - 反面场景：①有身份时输入框不可编辑；②合并成功不改变既有身份；③首次收名成功后身份落 localStorage。
  - 探针映射：home-return-qa 追加 step（有身份 → 弹框输入只读 + 合并后身份不变）。
- **探针**（tests/qa/home-return-qa.mjs 追加 step）：页面内通道断言弹框 input `readOnly` 属性 + 合并动作后 `localStorage['ttt.room.name.v1']` 不变（或首次场景被写入）。
- **验收（AC）**：①单测全绿且 vitest 基线不减；②typecheck/lint exit 0；③探针全步 PASS（生产构建惯例）；④R6 校验零违例；⑤负面清单：不碰 lib/db.ts、lib/game-net.ts、服务端五端点、RoomGateDialog。
- **预估**：30-45 分钟，herdr codex fresh 席（worktree 隔离，cherry-pick 合入）。

## 四、正交性与波次

单票单席（T-M1），司机模式复用既有配方；调度者终验（探针 + 六层门禁）+ 收口批注。

## 五、边界声明

- 「改名=换账本（旧账不迁移）」的产品语义不变（room UNIQUE 永久锁定）；本票只堵「有身份时改投其他房间」的口子，不引入改名功能。
- B 案（弹框改名即换身份）已被主公裁决否决，理由留档：手滑风险 + 与永久锁定 hint 冲突。
