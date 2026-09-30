# 匿名 online 行缺失 UX 路径（plan 骨架，dismissed from W-OPT-c）

> [ARCHIVED 2026-09-28 弃案：主公终裁「anonymous 计划直接归档，我们没有这个需求了。」——本卡前提经 2026-09-28 调研推翻、需求不复存在，A/B/C/E 出路不再选；已知缺陷（进房时行存在、提交时被他人删除 → 战报上传 404 不入账）主公明示接受不修，后继：无]（2026-09-28 终裁落档，详见下「2026-09-28 终裁（归档）」节）。以下为计划态原文存档。

- 日期: 2026-09-22
- 状态: **ARCHIVED（2026-09-28 主公终裁归档）**——「anonymous 计划直接归档，我们没有这个需求了。」已知缺陷接受不修（W-RV P2 #4 follow-up；W-OPT-c 范围外；详见「2026-09-28 终裁（归档）」节；改判前状态线：drafting → 前提经证据推翻，归档待主公确认——【2026-09-28】调研补注已入档：卡前提被推翻，四条出路无需再选）
- 分支: dev
- 出处: reports/review/RC-quality-20260922.md P2 #4（已读）；AGENTS.md §本项目反模式「POST /api/rooms/{room}/stats/outcomes 404 防静默建档」
- 关联: `.omo/plans/ulw-quality-hardening-opt-20260922.md`（本 plan 为该波次 follow-up 之一）

## 背景速读（人类可读版，2026-09-27 应主公要求补）

> 【2026-09-27 主公裁决 Q2】主公不理解来龙去脉——把说明更新成人类可读的版本；出路选型待说明更新后另作裁决。本节即该说明；计划状态保持 drafting 不动（出路仍待裁）。
> 【2026-09-28 注】本节第 1 点「行不存在时服务端不会自动补建」的前提经 2026-09-28 调研推翻（加入路径一直补建）；本节系 09-27 原文按历史纪律不改写，勘误与证据见下节「2026-09-28 调研补注」。

1. **场景（这事怎么发生的）**：玩家在一台新设备上打开游戏，输入房间名进了在线房间。但这台新设备连到的服务端里，并没有这个房间的「账本行」——行不存在时服务端不会自动补建，这是防「已删除的房间被复活」的红线设计，故意这么做的。
2. **现状（玩家会看到什么）**：这一局打到完胜后，战报往服务端上传会收到 404（房间不存在），屏幕上只弹一条错误横幅（`873a255` 已加「战报上传失败（房间不存在）」文案）。这局棋不入账（战绩不记录）、不庆祝（胜利庆祝不出现），玩家也没有任何出路（不知道接下来该怎么办）。
3. **缺口（到底少了什么）**：入账、庆祝、出路——三样都没有。
4. **四条出路（各自一句话大白话）**：
   - **A 静默跳回本地离线版**：什么都不问，直接把玩家带回本地离线版接着玩。
   - **B 弹框让玩家选**：弹一个框，让玩家自己挑「重新输入房间名」还是「匿名继续，记在本地」。
   - **C 一进房就先检查拦下**：进房那一刻就先查服务端，发现房间不存在当场拦住，不让玩家白打一局（对「进房时行就不存在」的本场景管用；但若房间是进房之后才被删，这招就盖不住了）。
   - **E 挂起不修**：先放着不动——因为生产环境从没真实遇到过这种情况。
   - （原 D 方案「服务端自动补建」已排除：它违反防复活红线。）
5. **主公要决定的就一件事**：选哪条出路（或者挂起不修）。

## 2026-09-28 调研补注

> 触发：主公 2026-09-28 批注（逐字）：「这个问题还需要调研， 我测试中它好像是会自动创建的？ 没有你说的这个情况？」调研复核与本节同日落档；本节以上各章（含「背景速读」）系历史原文，按裁决记录纪律不改写，事实以本节为准。

**1. 调研结论：主公观察正确，本卡前提被推翻——「输入房间名加入」路径一直补建行。** 唯一人类入口是 RoomGateDialog（首页门 RoomGateMount 与 /online 页内门 OnlineGateMount 共用），确认即 `postRoomSession → POST /api/rooms → registerOrLoginRoom`（components/RoomGateDialog.tsx:122 → app/api/rooms/route.ts:65 → lib/db.ts:737-752，补建在 :742-745）：行缺失时 upsert `emptyStats()` 全零行并返回 `existed:false`，UNIQUE 冲突重读兜底、race-safe。该行为自起源 commit `d9ad855`（2026-09-18，registerOrLoginName）至今逐字未变，从未有过「加入不建行」的版本（`git log -S registerOrLoginRoom` 无任何改行为 commit）；本卡落笔当天 `9fe08aa`（2026-09-22）与 HEAD `2f11c36` 逐字一致。故本卡头条场景「新设备输入房间名 → 行不存在 → 白打一局」**结构性不可能**：真新设备 localStorage 为空必走弹框，弹框必 POST /api/rooms 必建行。复核佐证（hermetic 本地 file 库、零远程写；因 .env.local 指向远程 Turso 生产库，按指令跳过了 dev-server + curl 实验）：`npx vitest run tests/db/db.test.ts` 55/55 PASS——registerOrLoginRoom 是全部 recordOutcome 用例的种子原语（db.test.ts:337-341），反向钉子 db.test.ts:446-454（'ghost' 不 register 直接记局 → ok:false）防「偷渡成 upsert 复活」；端到端探针 tests/qa/rooms-race-qa.mjs step 9(e)（:758-760）明文钉「重进同名房间 POST /api/rooms → 200 existed:false + stats 全零（fresh ledger，不复活旧数据；registerOrLoginRoom 的 read-then-upsert 路径天然支持）」——正是主公观察的机器化版本（该 Playwright 探针本次未重跑，需 production build，仅引其代码与 BR-12 绑定，如实说明）。

**2. 红线真实落点（本卡前提错在哪）**：「防复活」约束的不是加入路径，而是「已注册后」的四条写路径。docs/business-rules.md 对账（注：调研档原引 :15/:16，实测行号为 :20/:22，内容一致）：① BR-10（business-rules.md:20）「合并/上报不静默建档」，探针 rooms-race-qa.mjs step 5（outcomes→404）/ step 8（merge→409）——约束 merge + outcomes；② anti-patterns L1-11 与 BR-7——约束 reset 缺行 404；③ BR-12③（business-rules.md:22）**明文批准加入路径补建空行**：「删除后重进同名房间 → 全零新账本，不复活旧数据」——「不复活」约束的是旧数据不得回来（fresh 全零行合法），不是行不得被创建。代码现状与之完全对齐：outcomes 404（lib/db.ts:499-501）、merge route 预检 409（app/api/rooms/[room]/stats/merge/route.ts:59-67）、reset 404（lib/db.ts:571-573）、DELETE 404（lib/db.ts:641-647）、join 补建（lib/db.ts:742-745）。BR-10/BR-12 与代码自洽，需要修的只是本卡与「背景速读」的前提表述（历史原文保留，以本节为准）。唯一潜在不一致面：service 层 mergeRecordByRoom 自身缺行会以 emptyStats() 为底折叠并 upsert（lib/db.ts:427-435），仅靠 merge route 预检挡住——推断：新增 transport 直调该 service 会破 BR-10。

**3. 404 触发条件（收窄后）**：需四条件叠加——① 本浏览器 localStorage `ttt.room.name.v1` 残留旧房名（旧会话残留；真新设备为空必走弹框必建行）；② 服务端该行事后经四通道之一消失：/result 页删除按钮 DELETE（`0817519`，2026-09-25 起）、手工 curl DELETE、TTL 30 天 cron 回收（`c5aac38`，2026-09-25 起）、getDb() schema 重建（lib/db.ts:249-273）；③ 玩家不经弹框进房：首页 CTA（StartGameButton.tsx:74-88 直接导航，不发 POST）或硬刷 /online（OnlineGateMount.tsx:76-87 仅从 localStorage hydrate，无服务端校验）；④ 打完整局结胜 → POST outcomes → 404。另勘误本卡「三缺」为「两缺」：404 局**照样庆祝**——ResultNavigator 在 awaitOutcomeWrite 落定后（吞错、成败皆落定）写 just-won 哨兵再 push（components/ResultNavigator.tsx:90-121），ResultCelebration 只认哨兵（components/ResultCelebration.tsx:46-55），/result 两分支均挂它（app/result/page.tsx:97、173）；真实缺口只有「不入账」（/result 空态，result/page.tsx:136-143）与「无出路」（仅一条可关闭横幅，OutcomeErrorBanner.tsx:20-25，无下一步指引）。`873a255`（2026-09-23）加的正是这条横幅（'not-found': '战报上传失败（房间不存在）'），只改 UI、未改任何建行逻辑。

**4. 对 A/B/C/E 的影响**：**A 静默回离线**——收益面收窄：庆祝本来就有，只解决「不入账+无出路」两缺，且仅剩 localStorage 残名场景触发；用户困惑成本不变，性价比进一步降低。**B 弹框自选**——增量价值缩水：「重新输入房间名」分支与现状重叠（重输名字 = registerOrLoginRoom = 本来就补建），真实增量只剩「匿名记本地」一条。**C 进房先检查**——出现更优变体：进房发现 localStorage 有名时先补一发幂等 POST /api/rooms，行在则 existed:true 照常、行不在则补建全零行，404 被**根治**而非拦截；该变体与 BR-12③ 同构（删除后重进=全零新账本本就是钦定行为），不触 BR-10 红线（红线禁 outcomes/merge 孤儿请求建档，不禁 join 补建）；原 C 的「弹框拦截」在新前提下反而过度设计（走弹框的路径行必存在，无从拦截），「进房后才删盖不住」的残余仍在但概率进一步收窄；死导出 ensureRecordByRoom（lib/db.ts:710，当前零调用方）可顺手清理或接给 C-变体复用。**E 挂起标 ARCHIVED**——可辩护性显著上升：前提部分错误 + 四条件叠加 + 生产从未观察到（§二.3 自述）+ 两缺中较痛的「不庆祝」实为误述；若标 ARCHIVED，建议卡内留一行残余触发条件备注（即本节第 3 点）。

**5. 待主公终裁一件事**：四条出路无需再选——本计划是否直接标 ARCHIVED 归档（归档则本节第 3 点即残余触发条件备注）。

## 2026-09-28 终裁（归档）

> 触发：主公 2026-09-28 终裁批注。QA（逐字）：「anonymous 计划直接归档，我们没有这个需求了。」QB（逐字）：「对于 进房间的时候 有房间， 提交的时候被别人删除了， 这个是我们本来就已经知道的缺陷。 我们不解决这个问题。 因为有人猜到了你的房间名字，才有可能删除你的房间， 那说明你的房间名很简单，谁都能猜测到。 要么你泄露了你的房间名，所以我们直接返回报错，显示提示没有问题。」本节系终裁落档；以上各章（含「背景速读」「2026-09-28 调研补注」）系历史原文，按裁决记录纪律不改写。

**1. 终裁语义**：本计划无此需求，直接归档（ARCHIVED）——头部状态行已改 ARCHIVED 终裁态并加弃案标注；上节调研已证卡前提被推翻（「输入房间名加入」路径一直补建行），四条出路 A/B/C/E 不再选。

**2. 已知缺陷接受（主公明示不修）**：「进房时房间行存在、提交时被他人删除 → 战报上传 404、当局不入账」（即上节第 3 点四条件叠加场景）系本仓已知缺陷，主公明示接受、不解决。理由：有人能删除你的房间，前提是对方猜到了你的房间名字（说明房间名太简单、谁都能猜测到），要么就是你泄露了房间名；此情况下服务端直接返回报错、界面显示提示，没有问题。该缺陷与 multi-user 终结块已知缺陷（Q1，2026-09-27 declined：「知晓房间名者可删除他人房间」）同源——同一前提（房间名可被猜到或已泄露）、同一接受口径。

**3. 报错显示核实（对主公 2026-09-28 配套核实任务「我们会显示提示报错吗」的直接回答）**：**会显示（有条件，条件很宽）**——玩家在线模式、有房间名、打完整局（胜/平自动上传战报）时房间行已被删，POST 必返回 404 → `outcomeError` 置位 `'not-found'`（lib/store.ts:364/392；吞错契约 awaitOutcomeWrite 只吞 rejection、不拦置位，lib/store.ts:447-458）→ 导航 /result 后必然看到红色 Alert「战报未上服／战报上传失败（房间不存在）」（app/result/page.tsx:173 挂载，app/online/page.tsx:49 同挂；components/OutcomeErrorBanner.tsx:26 文案；服务端根源 lib/db.ts:499-501 行不存在即 not-found → route 404）。现状已非静默吞——案② c 修复已落地（lib/store.ts:80-83 注释、tests/store/store.test.ts:867-901 回归钉），无需任何代码改动即满足本终裁。看不到提示的例外仅四类：①硬刷新/直接输入 URL 打开 /result 或 /online（`outcomeError` 系 zustand 内存态不持久化，lib/store.ts:84,148）；②离开 /result 回首页（首页不挂 Banner）；③点「再来一局」开新局（components/PlayController.tsx:68-71 自动 restart+startGame 清掉，lib/store.ts:308/411）；④离线对战与匿名 online（不发请求，无 404）。横幅仅「关闭」按钮、无重试/重建指引；role="status" 屏幕阅读器可播报（components/OutcomeErrorBanner.tsx:26,43,45,53）。

**4. 残余触发条件备注（归档留痕）**：即上节第 3 点四条件叠加（localStorage 残名 + 行事后消失 + 不经弹框进房 + 打完结胜）——已接受不修；后续若被重提，以本节与上节为准。

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

> 【2026-09-27 口径更新】选项集已改 **A/B/C/E**：D 已排除（违反 anti-silent-create 红线），新增 E「挂起不修、本档标 ARCHIVED」；完整说明见本档头部「背景速读」节，现行裁决面见总图 §二①。上行 A/B/C/D 系 09-22 原文留档不改。
