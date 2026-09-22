# 匿名 online 行缺失 UX 路径（plan 骨架，dismissed from W-OPT-c）

- 日期: 2026-09-22
- 状态: **drafting**（W-RV P2 #4 follow-up；W-OPT-c 范围外，等主公裁决）
- 分支: dev
- 出处: reports/review/RC-quality-20260922.md P2 #4（已读）；AGENTS.md §本项目反模式「POST /api/rooms/{room}/stats/outcomes 404 防静默建档」
- 关联: `.omo/plans/ulw-quality-hardening-opt-20260922.md`（本 plan 为该波次 follow-up 之一）

## 一、问题陈述（inferred from probe code + 评审原文）

`tests/qa/online-direct-qa.mjs` F7 注释明确标注：

> 服务端无 row 时 outcomes 404 零记录是既有边缘，见报告「偏差与未决」。

场景：用户在新设备 / 新浏览器打开首页，从 RoomGateDialog 输入房间名
（`ttt.room.name.v1` localStorage 有名）→ 进入 /online → 服务端因
admin DELETE / forged reset / 早期迁移数据丢失等原因 row 不存在 →
首局 online 完胜 → `POST /api/rooms/{room}/stats/outcomes` 返回 404
stats-not-found → `lib/store.ts:apiRecordOutcome` 走 404 catch 路径
返回 `{ ok: false, reason: 'not-found' }` → 客户端 abort 当局记局
→ **UI 上零记账 + 零庆祝 + 零错误反馈**（用户赢了，但战绩 + 庆祝
全无）。

anti-silent-create 纵深防御要求服务端 404 拒绝「未注册行被偷渡
upsert」——契约正确；问题在客户端 fallback 缺位。

## 二、已知边界（评审报告 §未见过的面）

1. **真实 Turso HTTP 远端路径**：prod 部署未实测，admin DELETE 路径
   当前未见实际触发场景；prod 数据库理论上无自动 DELETE 行（除
   manual admin intervention）。
2. **跨设备数据库隔离**：Vercel + Turso 部署为单库；本地 sqlite
   测试库每次 hermetic 启动是独立库（不会跨 session 复用 row）。
3. **生产从未观察到此症状**：本评审期间未在 prod logs / 用户反馈
   中发现 404 stats-not-found 报告。

## 三、候选 UX（按改动幅度排序）

| 方案 | 改动 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **A. 静默重定向 /offline** | ResultNavigator 404 catch → router.replace('/offline') | 零 UI 改动 | 用户对 online → offline 切换无预期；可能误以为是 bug |
| **B. 显式 resync 弹框** | 同上 → 弹一个"该房间服务端无记录"对话框，让用户选「重新输入房间名」/「匿名继续（本地）」 | 用户可控 | 多一步；可能与 SyncConfirmDialog 视觉同质混淆 |
| **C. 进入房间时检测 + 拦截** | RoomGateMount 收到 POST /api/rooms 409 (重复) 之外的 422 / 5xx 时弹"输入的房间名无法注册，请换一个" | 提前拦截，避免玩到一半掉链子 | 多一轮 HTTP；可能 422 与服务端抖动混淆 |
| **D. 服务端 409 → 自动重新 register** | server 把 404 stats-not-found 改成「auto-register empty row then retry outcome」 | 客户端无改动 | 违反 anti-silent-create（admin DELETE 的 row 会被自动复活，丢失删除意图） |

## 四、产品裁决待主公

主公对 online 路径 UX 的偏好，决定方案选择。当前主公意见无；
本 plan 待 §九审批门通过后方可派发。

## 五、技术裁决待主公

若选 B 方案，需决定：

1. 弹框文案（对齐 AGENTS.md 词汇表"房间" vs "记录"）
2. 「重新输入房间名」路径：复用 RoomGateDialog（弹框已存在）还是
   新建一个更窄的 ResyncRoomDialog？
3. 「匿名继续」语义：若用户在 anonymous 模式下被服务端拒绝，
   "匿名继续"实际上是「不再尝试 online，记到本地」，是否需要
   单独的 offline 持久化路径（避免战绩丢失）？

## 六、依赖与阻塞

- 依赖：主公 §四 / §五 裁决
- 阻塞：本波不实现
- 不影响：W-OPT-c 其余 10 条 findings 处置；W-RV 其余 6 条 P3 处置

## 七、验收（定稿后逐条机器化）

[草案，§九 审批通过后展开]

## 八、红线

- anti-silent-create 纵深防御零回退（404 / 409 防偷渡 upsert）
- 不删除 admin DELETE 路径语义
- 不在 /offline 引入 roomName 展示（AGENTS.md 反模式）

## 九、审批

主公裁决：选 A / B / C / D，签字生效后 plan 翻 ready-for-approval。
