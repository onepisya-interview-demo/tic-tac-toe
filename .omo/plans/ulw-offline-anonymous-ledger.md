# Plan: ulw-offline-anonymous-ledger —— offline 无名也记账（本机账本无条件累加）

- **日期**：2026-09-20
- **分支**：dev
- **状态**：维护者 2026-09-20 拍板（语义变更决议），计划入档即执行
- **前置阅读**：.omo/plans/ulw-room-migration-home-landing.md（正在进行的大迁移，本计划是其增补波 W4）

---

## §0 背景与语义溯源

1. **维护者报告**：「离线模式下也没有战绩了」。期望语义：**离线模式无论有没有名字都记账**；回到首页的那一瞬间弹框询问是否同步；只有输入了 name 之后才会同步，并且创建 name（房间）。
2. **溯源（measured）**：守卫不是 W2 迁移引入——`git log -S "无名不记"` 实锤它来自 `7765b3f`（refactor(db+store): /api/stats 链退役 + mode online|offline 平移 + 无名不记守卫），是当时的产品语义；`ulw-room-migration-home-landing` W2 忠实保留了它（store.test 单测全绿恰恰因为语义被原样平移）。所以这不是回归，是**语义变更决议**。
3. **实弹复现（measured，:3198 产线构建）**：全新匿名上下文 `/offline` 开局，点击序列 0,3,1,4,2 打满（O 方胜上排 0,1,2），`window.localStorage['ttt.offline.stats.v1']` 对局前后均为 `null`——无名不记守卫生效，战绩零增长。
4. **探测纪律备注（给执行席的探针警告，调度者实弹踩过的坑）**：
   - `sync-confirm-dialog` 是常驻 `<dialog>`（关闭态也在 DOM），检测必须查 `hasAttribute('open')`，`page.$` 命中≠打开；
   - 胜局后 /offline 自动切 stats 视图有延迟（useTransition + timer），断言前要留足等待或显式等待 `play-again-offline` 可见；
   - 落子序列 0,3,1,4,2 是 pass-and-play 轮流：先手随机时 O 方可能胜上排——判定胜局别假设「我方=X」。

---

## §1 决议与变更设计

| # | 决议 | 实现面 |
|---|------|--------|
| D-1 | **offline 无名也记账** | `lib/store.ts:makeMove` 摘掉 **offline 分支** 的 `isAnonymous` 早退（win 与 draw 两条路径都要摘）：`recordOutcome + persistOfflineStats` 无条件执行。**online 分支守卫保留**（未知名 POST outcome 必 404 anti-silent-create，守卫语义正确）。注释里的「无名不记守卫」叙述改写为「online 无名不记（offline 无条件记）」。 |
| D-2 | **回首页瞬间弹框问同步** | 既有 `HomeDialogMount`（mount/focus/visibility/storage 监听，`pending > declined && pending > 0`）在 D-1 落地后自动覆盖匿名玩家（匿名局 → pendingSyncCount=N>0 → 弹框）。**预期零代码改动**，需回归验证。 |
| D-3 | **收名才同步，且创建房间** | 既有 `SyncConfirmDialog` 内嵌收名流：主 CTA「合并并清空」→ `postRoomSession`（创建/进入房间）→ `postMerge` → 本地清空 + baseline 写 0。「保留本地」零网络写。**预期零代码改动**，需回归验证。 |
| D-4 | **匿名卡文案反转** | `components/OfflineStatsPanel.tsx` 的 `offline-stats-anonymous` 卡：从「无名不记」语义改为「本机匿名记账中——回首页可命名并入云端房间」类文案（精确措辞执行席定，遵守文案红线：零「玩家名/注册/登录」，房间术语）。testid 不变。 |

**设计法则依据**（/Users/onepisya/code/UI Propmt/skills/elegant-ui/52-design-principles，执行席落文案前读对应文件）：
- **反馈环**：账本必须可见——玩家做了动作（下棋）就要看到记录（stats 面板数字增长），否则系统状态不可感知；
- **心智模型**：「我玩过的都记着呢」是用户默认假设，匿名不记违背它；弹框收名时一次性补记（merge）符合「补登账」直觉；
- **蔡加尼克效应**：未完成的同步任务（有 local 未并入云端）在回首页瞬间以弹框形式回来，正是「未完成事项在合适时机重新呈现」。

## §2 分支闭环表（单测 + 实弹断言）

| ID | 分支 | 断言要点 |
|----|------|---------|
| F1 | 无名 offline 胜局 | ledger `totalGames`/对应胜场 +1；`persistOfflineStats` 写入 localStorage |
| F2 | 无名 offline 平局 | 同 F1（draws +1） |
| F3 | 有名 offline | 行为不变（本地累加） |
| F4 | 无名 **online** | 守卫保留：零网络写、零本地写（不回退） |
| F5 | 匿名局后回首页 | `sync-confirm-dialog[open]` 为真；文案 N 局 = 实际 pending |
| F6 | 弹框收名合并 | POST /api/rooms（existed:false 建房）→ POST merge → 本地清空 + baseline 0 → 房间名写入 store + localStorage |
| F7 | 弹框「保留本地」 | 零网络写；同会话无增量不重弹（declined 哨兵） |
| F8 | 匿名卡文案 | offline-stats-anonymous 显示新语义文案，零「玩家名/注册/登录」 |

## §3 验收标准（AC）

| AC | 内容 | 验证 |
|----|------|------|
| A1 | F1-F4 单测全绿（store.test 翻转 + 新增） | vitest |
| A2 | 实弹：匿名 offline 一局 → ledger 增长；回首页弹框 `[open]`；收名 → 建房+合并+清空 | 调度者验收烟测（:3197 独立端口 + 新 tmp DB） |
| A3 | online 无名守卫不回退（F4） | 单测 |
| A4 | 文案红线：用户可见文案零「玩家名/注册/登录」 | grep + DOM 断言 |
| A5 | 六层门禁：vitest/typecheck/lint/build/commit-audit 绿；浏览器探针**本波豁免**（tests/qa 由并行的 rw3p 席占用，匿名语义断言对齐由调度者在 rw3p 落地后统一小波处理） | 每 commit |
| A6 | 不碰 `tests/qa/**`（rw3p 席工作区）、不碰 docs（be653e1 已定稿） | 边界审计 |

## §4 执行协议

1. **W4 修复席**：fresh codex（herdr tab），独立 worktree `../ttt-room-w4`（基于 dev@cace8f4）。改动面：`lib/store.ts` + `components/OfflineStatsPanel.tsx`（+文案相关单测 `OfflineStatsPanel.test.tsx`、`tests/store/store.test.ts`）。
2. 调度者只做拆解/派发/实弹验收/合入；teach-back 后动手；:3197 端口 + 全新 tmp DB 自证。
3. tests/qa 对齐小波（W5，调度者或轻量席位）：rw3p 落地合入后，把 offline-qa / one-identity-qa 中编码「无名不记」旧语义的断言翻转为 F1-F8 新语义。
4. V9 终验席（fresh-context）继续按原计划在全部波次合入后执行，AC 增补本计划 §3。

## §5 Rejected alternatives 与风险

- **online 也摘守卫**：Rejected——未知名 POST outcome 必 404（anti-silent-create 是服务端契约）；且 /online 入口本有 RoomGateDialog 拦截，守卫是纵深防御。
- **改 HomeDialogMount 触发条件**：Rejected——`pending > declined && pending > 0` 已天然覆盖匿名（D-1 后 pending 必然正确），加条件是 subtract-before-you-add 的反面。
- **风险 R-1**：匿名记账后，从未回首页的纯 offline 用户账本只存本机——这正是 pure-local 既有语义，无新增风险。
- **风险 R-2**：rw3p 正在迁移的探针可能编码了「无名不记」断言 → W5 小波翻转，冲突面已知且可控（tests/qa 与 W4 改动面零交集）。
