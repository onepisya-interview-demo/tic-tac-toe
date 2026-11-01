# 全仓 .omo 文档状态总图

- **版本**：2026-09-27 裁决落档版（2026-09-28 两次落档叠注在案；同日按主公要求重排格式、并随终裁刷新全部状态——内容零删减）
- **基线**：dev @ `2f11c36`，与 origin/dev 齐平
- **上一版**：[doc-status-map-20260926.md](doc-status-map-20260926.md)（`01283ed` 入档静态快照）
- **备查台账**：47+1 份更新清单与 130 份全景判定外移至 [doc-status-map-20260927-ledger.md](doc-status-map-20260927-ledger.md)（【2026-10-24 勘注】＋1＝ulw-readme-shots 状态线——判定日漏列项，2026-10-04 D25 卫生票 `5cb599a` 补列，见台账 §甲#48；原 47 系判定日清单口径，与本图 §四标题同步改口径、「全部 done」结论不变）

---

## 快速读法

- 想知道「现在还有什么要我决策」→ 只读 **§二**。答案：**无待决项**——三件套已两清，仅余 dev-stable tag 等正式上线打标（§二②）。
- 想知道「接下来做什么」→ **§三**：规则机械化唤醒是下一件事。
  > 【2026-10-09 叠注】唤醒已于 2026-10-01 收口（awaken 材料 87ec30f，主公裁「我回去读的」、D9–D18 缓读未裁未驳）；10-07 缺口图谱波＋decisions 自排期队列 17 项转化为验证基建路线图并 17 票全 pass（plans/ulw-verification-infra-roadmap-20261007.md）——最新路线态以该档与决策台账为准，本行 09-27 语境不改。
- 其余各节均为留档备查，无需通读。

---

## 一、主公 2026-09-27 十一项裁决（全文留档）

> 以下十一条与总排序指令系主公 2026-09-27 在聊天中给出，如实照录（不添不改）；档案层落档动作见 §五。

### Q1 · 多用户档结案或唤醒（multi-user-stats-future-work.md）

> 直接终结——我们不要多用户的方案了，不然还要密码加密之类的东西，还要登录页面，太麻烦了。现在的缺陷是我们知道、并且接受的：其他人能删除你的房间，如果他知道你的房间名。

### Q2 · 匿名行缺失 UX 裁决（ulw-anonymous-online-server-row-missing-20260922.md）

> 主公不理解来龙去脉——把说明更新成人类可读的版本；出路选型待说明更新后另作裁决。

> 【2026-09-28 注】该计划已转调研并得结论——本卡前提经证据推翻，四条出路无需再选，归档与否待主公确认（见 §二① 与计划档「2026-09-28 调研补注」节）；本行 09-27 原文不改。
> 【2026-09-28 终裁注】主公已终裁直接归档并接受已知缺陷不修（QA/QB 原话见 §二① 终裁块与计划档「2026-09-28 终裁（归档）」节）。

### Q3 · 弹框波余三问待裁（ulw-homedialog-flaky-fix-20260926.md，Q-C/Q-D/Q-E）

> 全部先待定——现在质量还不满意，还达不到打 tag 配 cron 的程度。

### Q4 · TTL 修复欠两决（ulw-ttl-channel-and-cleanup-20260926.md，验收结论+稳定 tag）

> 待定——达不到主公的验收标准。

### Q5 · 文档治理余项待裁（alignment-20260926-doc-governance.md）

> 待定。

### Q6 · TTL 波收尾两签（handover-20260926-ttl-channel-cleanup-wave.md）

> 待定。

### Q7 · 验收与密钥两决策（handover-20260926-two-plans-wave.md）

> 待定。

### Q8 · 评测 MCP 唤醒（evals-mcp-practice-map.md）

> 这是后续的继续——需要先把手上的文档梳理好、哪些可以确定了，之后才会考虑这个内容。

### Q9 · 规则机械化唤醒裁决（research-rules-mechanization-20260926.md）

> 这是文档梳理好之后要做的第一件事情。

### Q10 · 全仓文档快照总图（doc-status-map-20260926.md §二第4项，session-orthogonality 误列 open）

> 选 A——改判已采纳结档。

### Q11 · 多席台账核销留档（sessions.local.md）

> 选 A——确认结案（台账纯运行记录，各波 commit 9/9 实存，无未决票）。

### 总排序指令

> 所有事情都要在当前文档相关的事情处理好之后，然后执行规则机械化唤醒裁决，然后才考虑其他的事情。

---

## 二、待主公决策（本节决策面仅剩 1 项长期待定）

### ① 匿名行缺失出路 —— ✅ 已终裁归档（2026-09-28）

**主公终裁原话（逐字）：**

> anonymous 计划直接归档，我们没有这个需求了。

> 对于 进房间的时候 有房间， 提交的时候被别人删除了， 这个是我们本来就已经知道的缺陷。 我们不解决这个问题。 因为有人猜到了你的房间名字，才有可能删除你的房间， 那说明你的房间名很简单，谁都能猜测到。 要么你泄露了你的房间名，所以我们直接返回报错，显示提示没有问题。

**终裁语义：**

- 计划已标 **ARCHIVED**——没有这个需求，A/B/C/E 四条出路随之作废；
- 已知缺陷**接受不修**：进房时行存在、提交时被他人删 → 战报上传 404 不入账；
  - 理由：能删你房间的前提是对方猜到或拿到你的房间名（房间名太简单或已泄露）——与 Q1 multi-user 终结块已知缺陷同源；
- **报错显示已核实：会显示提示（有条件，条件很宽）**——online + 有名完局遇 404 必置 `outcomeError`，/result 页必渲染「战报未上服／战报上传失败（房间不存在）」红色 Alert；
  - 看不到的例外仅四类：硬刷新/直接 URL、回首页、开新局、离线与匿名；
  - 即现状已满足「直接返回报错，显示提示」，零改动。

**细档指针**：计划档 `ulw-anonymous-online-server-row-missing-20260922.md`「2026-09-28 终裁（归档）」节（条件与 file:line 明细在其第 3 点）。

**调研背景（2026-09-28，结论=主公观察正确）**：卡面前提「输入房间名 → 行不存在」被代码证据推翻——加入路径自起源 `d9ad855`（2026-09-18）起一直补建（`registerOrLoginRoom`，lib/db.ts:737-752），vitest 55/55 复核；「不补建」红线只约束注册后写路径（outcomes/merge/reset）。完整调研存计划档「2026-09-28 调研补注」节。

### ② 质量达标时点 —— 🔶 三件套两清，仅余 dev-stable tag（待正式上线）

**主公批注原话（2026-09-28 逐字）：**

> 这个先待定。

**2026-09-30 进展**（主公亲测功能无恙 = 达标信号）：

1. **验收结论 ✅**——四条已落地业务语义（清空/退出/删除三分术语、删除自愈、TTL 30 天口径、同步弹框身份锁定边界）经主公亲测通过；
2. **CRON_SECRET ✅**——经 vercel CLI 注入 Vercel Production（主公授权直接操作）+ .env.local 同步；PR #18 合流部署（`37326b9`）后验证：裸请求 401、带 secret POST/GET 均 200 `{deletedCount:0,cutoffDays:30}`，`vercel crons ls` 注册确认（`0 3 * * *` → /api/maintenance/purge，生产域 **3t.onepis.net**）；首次自动触发待 2026-10-01 北京 11:00–11:59 窗口 Cron 日志验证；→ **10-04 核销**：10-01 窗口无信号系锚点口径错位（当日披露改口），10-02 SELECT 复测 **fired**（详 [research-verification-trust-20260930.md](research-verification-trust-20260930.md) §六）；
3. **dev-stable tag ✅**——主公 2026-09-30 深夜判定「刚才验证过后说明了我们可以打这个标签了，因为验证了它确实生效了」，已打 **`dev-stable-20260930`** → `2bf1663`（本地 tag 不推远端，惯例同 0922/0923）；涵盖验证闭环：TTL 边界实证（删 5 留 3）+ Cron 上线两态 + CI 首跑全绿 + 主公亲测。次日自动触发（10-01 北京 11–12 点 Cron 日志）为观察项非打标前置。

**历史冻结判语原文留档**（2026-09-27/09-28，已被上述进展取代）：「待定——质量未达验收标准，tag/cron 全线冻结」「这个先待定。」

澄清照旧：冻结实质只锁 Q-C/Q-D，Q-E 两子项各有所归（项5 已终裁归档见①、项6 已定下一件事见 §三②）。

### ③ alignment 项7 追认 —— ✅ 已追认结档（2026-09-28）

**主公批注原话（逐字）：**

> 这个 运行时我们当时调研过了吧？ 说是使用 nodejs 作为运行时，并且 vercel 也把 edge 废弃了。 这个好像是早有定论的吧。

**核实结论：主公「早有定论」成立。** 定论日 **2026-09-10**，当天三连 commit 落库、此后 18 天无反复：

- 当天尝试 runtime='edge' 部署 /api/stats——build 过但 vercel --prod 被拒（node:path/node:fs 不支持）+ Next.js 16 抛弃用警告；尝试代码从未 commit（`git log -S "runtime = 'edge'" --all -- app/` 零命中）；
- 当天即回退定案「Vercel Node.js runtime」：`7781857`（runtime='nodejs' + 弃用理由注释落库）→ `71511c9`（部署文档同步）→ `27e32ec`（三份 plan 入档）；
- 延续至今：app/ 全部 7 个 API route 均 `export const runtime = 'nodejs'`；本仓 Next 16.3.5 本地官方文档多处明标 edge deprecated；
- edge-runtime-migration.md 头部 ARCHIVED 标注经核实与事实一致，标注不动。

**两处措辞精确化（如实留档，不影响结论）**：

1. 弃用（deprecated）声明主体是 Next.js 16 框架侧；Vercel 侧事实是拒绝了那一次 edge 部署（native 模块不可 bundle）——「Vercel 拒 + Next 弃」双事实；
2. 定论形成方式是「尝试失败 → 当天弃案」，非先案头调研再定论。附勘误：alignment:20 所引「全分支零命中」不精确（限定 `-- app/` 代码目录才零命中），实质结论不受影响。

> **本节现状（2026-09-30 深夜更新）**：①已终裁归档、③已追认结档、②三件套**全部收口**（验收 ✓ / CRON_SECRET ✓ / dev-stable-20260930 已打）——**决策面清零，无任何挂起动作**。除以上 3 条外全图无其他待决：Q1/Q10/Q11 已裁结档，Q8/Q9 转入 §三 路线图执行，无硬凑项。

---

## 三、路线图（按主公总排序指令）

### 1. 文档相关事项 —— ✅ 已收尾

遗留尾巴（清单外小卫生，不影响任何状态判定）：

- 反馈1-4（alignment §四）主公未提、均未动；其中反馈2（总图接 AGENTS.md L1 路由）属「无异议默认按愚见执行」的收尾项；
  > 【2026-10-09 叠注】反馈2 已于 2026-10-05 落地（c6eed4f 总图入路由，AGENTS.md L1 现含 doc-status-map-20260927.md 指针）；反馈1/3/4 本轮未核、不作断言。
- ulw-readme-shots-bilingual-20260913：缺头部状态线，上版漏列 47 清单未补；
- ulw-offline-anonymous-ledger：前置阅读行「正在进行的大迁移」过时（room-migration 已随 V9 收官）；
- ulw-room-lifecycle-20260924：关联行 T-M1 仍写「已批待派」（实已 `d685cf6` 落地）；
- vercel-deploy-runbook：正文 todo 13–17 仍标 [!] BLOCKED，与 F1–F4 [x] 及文末 Final state 矛盾；
- ulw-ttl-channel-fix-tp1-20260926：AC 表两个 AC-2 重复编号（既有笔误）；
  > 【2026-10-24 勘注】上述 5 条欠账（readme-shots 状态线／offline-anonymous 前置阅读行／room-lifecycle T-M1 行／runbook todos 13-17／AC-2 重复编号）均已被 2026-10-04 D25 卫生票 `5cb599a` 清掉——状态线补记、前置阅读行改「已收官」、T-M1 改「已落地 `d685cf6`」、todos 13-17 翻勾对齐、重复 AC-2 拆 AC-2a/2b/2c（五处 diff 经 `git show 5cb599a` 逐条核实）。本清单仍未清者仅反馈1/3/4（反馈2 见上注）与末两条非欠账判定。
- ulw-solo-mode-split-view-transitions：§3.4 实录段历史性表述——实录性质按纪律保留，非欠账；
- ulw-tb1-audit-scope-20260927：§八与交付 footer 指向 homedialog 总档——plan 自身规定，属设计决定。

### 2. 规则机械化唤醒 —— ⏭ 下一件事

- 依据：Q9 裁决原话「这是文档梳理好之后要做的第一件事情」+ 总排序指令。
- 唤醒即拉 `research-rules-mechanization-20260926.md` §五候选清单立票。
- **C2（文档契约测试）已实质兑现于 T-P1**（`2d7709b` 落地的 tests/api/maintenance-purge.test.ts:114/:129 即「route handler 不含 purgeStaleRooms 字面实参」契约测试）——无需另立票。
- 故届时实际先评 **C1**（anti-patterns「机械化状态」字段台账，小）；C3 ast-grep 进 CI（中）/ C4 eslint --fix+format（小，diff 噪声取舍需主公裁决）/ C5 派发红线断言模板化（小）备选另票。
- 「先评 C2+C1」系执行层安排（与 alignment 项6 愚见 a 一致），非主公裁决原文——归因已更正入档。
- 调研档维持「不立项不开坑」至唤醒。

> 【2026-10-09 叠注】本节已过时——唤醒已于 10-01 收口（87ec30f，C1–C9 裁决卡备齐，主公裁「我回去读的」、D9–D18 缓读未裁未驳）；10-07 转化为验证基建路线图（plans/ulw-verification-infra-roadmap-20261007.md）并 17 票全 pass；候选终态：C1 兑现 887591c／C5 兑现 b31139a／C4 部分兑现 22af9e1／C6 主面兑现 fce7af1／C8 部分兑现 a6bc793／C2 早已兑现 2d7709b／C3 未动；「不立项不开坑」至唤醒已失效。原文零改写。

### 3. 之后才考虑：evals-mcp 等

- Q8 裁决=后续的继续；docs/evals-mcp-practice-map.md 的 P1–P5 全部未排期未开坑。
- 唤醒时先读该档 §2/§3 再写各自 plan；最短路径 P1（evals harness+基线）+ P2（LLM 对手）连打。

---

## 四、47+1 份更新清单 —— ✅ 全部 done（零未完成）

> 明细外移至 [doc-status-map-20260927-ledger.md](doc-status-map-20260927-ledger.md) §甲（48 号＝判定日漏列的 ulw-readme-shots，2026-10-04 D25 卫生票 `5cb599a` 补列；【2026-10-24 勘注】标题口径由 47 与台账 §甲同步为 47+1，「全部 done」结论不变）。

- 上版 §四 47 份 needsUpdate 逐份执行完毕：44 份由更新波完成、3 份（#7/#40/#42）随裁决落档完成（47 系上版清单判定日口径；另漏列 1 份 ulw-readme-shots 经 D25 `5cb599a` 补列同判 done——合计 47+1，台账 §甲#48）；
- 抽验 44 份全部通过（ok=44/44，零内容问题）。

---

## 五、裁决落档详情（4 份文件动作 + 1 份确认类）

1. **multi-user-stats-future-work.md**（Q1 终结）——头部状态区改「已终结（declined）」+ 裁决块照录 Q1 原话；原占位正文经 git diff 验证保留未删。
2. **doc-status-map-20260926.md**（Q10 改判）——§二第4项后加【2026-09-27 改判】行；仅 +1 行、原条目零改动（历史快照加注不改原文）。
3. **ulw-anonymous-online-server-row-missing-20260922.md**（Q2 说明重写）——状态行后插「背景速读（人类可读版）」五点；其后 09-28 历经「调研补注」与「终裁（归档）」两次增补，计划已 ARCHIVED（→§二①）。
4. **alignment-20260926-doc-governance.md**（Q3–Q7 回执，7 处）——头部加总排序注；项1/项2 质量冻结（→§二②）；项5 说明已更新（→§二①）；项6 Q9 原话+愚见 a（→§三②）；项7 维持待定（→§二③）；§五 multi-user 定性处加 Q1 终结注。【2026-09-28 追加】项5 落主公批注与终裁、项7 落追认批注（→§二①③）。
5. **sessions.local.md**（Q11 确认结案，无文件动作）——gitignored 运行台账（.gitignore:134）；各波 commit 9/9 实存、无未决票。

---

## 六、130 份全景对账 —— 外移备查

> 全表（120 plans + 10 根级）外移至 [doc-status-map-20260927-ledger.md](doc-status-map-20260927-ledger.md) §乙，按状态分组列表。

- 判定日 2026-09-27（52 行带【09-27 更新】叠注）；
- **anonymous / edge-runtime-migration / alignment 三行已随 2026-09-28 终裁叠注刷新**（【09-28 更新】），最新终态以 §二 为准。

---

## 七、方法与盲区

### 本波做了什么（09-27 裁决落档波）

1. 执行 47 份更新清单，全部 done，零未完成（§四）；
2. 落档主公十一项裁决：4 份档案文件动作 + 1 份确认类（§五）；
3. 抽验 44 份更新档案：44/44 ok，零内容问题；
4. 重写本图：§一 照录裁决、§二 噪音清零、§三 按总排序定路线、§六 继承 130 份全景；
5. 亲跑核查：`git rev-parse HEAD`（=`2f11c36`，与基线一致）；通读上一版总图全文 454 行；实读 4 份落档档案现状与 rules-mechanization 章节结构，均与落档 JSON 一致；图内全部裸 hash 逐一 `git rev-parse --verify` 批验在档；
6. 独立冷读修订六条（四处 A/B/C/D 陈旧裁决面加注改 A/B/C/E、C 选项短板自洽、Q-E 归路统一、「先评 C2+C1」归因更正、sessions.local 表述消歧、决策最小集+真源指针）。

### 2026-09-28 两次增量（本图现状的来源）

- **三决策波**：主公对 §二 三条批注落档 + 双调研（匿名行前提被推翻、edge 定论核实）——§二①③ 改写、alignment 项5/项7 批注位追加；
- **终裁波**：anonymous 计划 ARCHIVED + 已知缺陷接受不修 + 报错显示核实（会显示，条件宽）——§二① 终裁块、计划档终裁节。

### 什么没核（诚实清单）

1. **六层验证零复跑（本图撰写波）**：vitest/typecheck/lint/build/commit-audit/浏览器探针未跑；台账 §甲#34 所记门禁数值系更新波复跑所得，非本波独立复现；
2. **130 份档案原文未逐份重开**：§乙 未叠注行的判定转自上一版总图（其证据已由上版成图脚本批验 303/303 在档）；叠注行转自更新/落档结果 JSON；
3. **Vercel Dashboard 侧 CRON_SECRET** 配置状态本机无法验证（仓库侧无泄漏、.env.local 无该键系上版已验结论，未复跑）；
4. **运行区不入图**：drafts/、evidence/、ulw-loop/、start-work/、boulder.json 未逐份核；sessions.local.md 系唯一例外（因 Q11 裁决单独列出），仅确认结案；
5. **GitHub 远端操作类交付**（ulw-handoff-governance 的 Copilot issue/Discussions）无仓内 commit 可证，沿旧图盲区未验。

### 与历史版本的差异

- 对 09-26 版（01283ed，117 份）：其 §二 四项 open 中——匿名行已终裁归档（§二①）、规则机械化转入 §三② 在途、handover 余 Q2/Q6 归入质量冻结（§二②）；第4项 session-orthogonality 系误列（Q10 改判结档）；
- 对 09-27 上一版（同日成图）：11 张决策卡 → 3 条 → **09-28 两波后决策面仅剩质量冻结一项**。

### 入档状态

本图与全部落档改动系工作树未提交变更；沿「计划入档即停，执行须主公明令」纪律，commit 与 push 待主公指令。

> 【2026-10-09 叠注】本图已于 2026-09-30 随 d2296e5 入档，后续 2bf1663/b8e3e0c/6a63887 三笔回写；截至 2026-10-09 对账波前，本图与台账工作树无未提交改动（本叠注自身属对账波待提交变更）；push 仍归主公（表述口径：dev 32 笔 8390a2b..c451ee5 待推＋对账波另计）。
> 【2026-10-24 叠注】上段「dev 32 笔 8390a2b..c451ee5 待推＋对账波另计」口径**作废**——该 32 笔连同此前未推的路线图入档笔 `8390a2b` 与对账波 2 笔，共 **35 笔**已随单笔 push 上 origin/dev（push 前后 tip `23d5866`→`5165933`，`git rev-list --count 23d5866..5165933`＝35；`5165933` 系 reword 前旧哈希）；补写波 fetch 后实测 dev 与 origin/dev **0/0 齐平**（tip `80b2f3e`），**PR #22 已合并**（dev→main squash 单亲 `4ac5acf`，`gh pr view 22` 实测 MERGED @ 2026-10-24T10:16:04Z）。10-09 后三波档案侧动作补记：**10-14**——决策审批表 17 项分诊入档（[decision-approval-sheet-20261014.md](evidence/decision-approval-sheet-20261014.md)，档面自述「分诊终裁 17 项（含 PROTO-STD）」）；**10-21**——发版波 `022c1b4`（D-1 修正案：EVIDENCE_DIR 下挪 step 级）＋`c966292`（ci-verify stripAnsi 修正）；**10-24**——PR #21 依赖升级并回 dev（`343e51c`）、R3 收紧（`e5104ed` 失败测试复现＋`38e4933` commit-audit 正文显式 WHAT/WHY/HOW token 硬要求）、`311d91c`（ruleset 命名错位修复＋D-1 终判「展开」）、五笔 reword（`fd8db3f`→`1ad6bd5`／`5165933`→`6f0377f`／`d9c608b`→`022c1b4`／`c303d8b`→`c966292`／`35ac680`→`311d91c`，五枚旧锚经 `git branch --all --contains` 实测零分支可达）、PR #22 创建并 squash 合并入 main（`4ac5acf`）。最新路线态以 [plans/ulw-verification-infra-roadmap-20261007.md](plans/ulw-verification-infra-roadmap-20261007.md) 与决策台账为准。
> 【2026-10-27 叠注】误导注释 sweep 波收口（dev 5 笔 `8abcff6..HEAD` 动态枚举实测：`0f5f339` ADR-0001＋sweep 台账立卷／`0eb2edd` AGENTS.md L0 依赖政令／`bcc40a4` 生产面 15 文件 17 处／`db6f80f` 测试面 16 文件 38 处＋收口 `docs(omo)` 1 笔，均未 push）。新档登记：[ADR-0001](plans/adr-0001-github-committer-exemption-20261026.md)（P2-e「留」终局，第四类豁免 GitHub squash 产物按 committer 身份免检）与**执行台账** [plans/comment-misleading-sweep-20261026.md](plans/comment-misleading-sweep-20261026.md)（`0f5f339` 立卷、收口笔回填全量：poteto 调研结论内嵌 §1.1 未另立调研档——身份纠正 poteto＝Lauren Tan 非「Hiroshi Tsubokura／zenn 系」；判据清单 §1.2；7 分区扫描实收 109 候选/108 确认/1 证伪 §1.3；reportedOnly 12 条 §1.4）。六层门禁 `node scripts/verify-all.mjs` 收口波实跑 exit 0。待主公裁决新增 2 项＋维持 3 项见台账 §三：P2-c／P3-b／P4-a（实测未处置维持待裁，rollout §六 n 不回写）＋新增只报告项处置（§三.6）与源头抑制技能提案（§三.7，推荐缓立重技能、轻量判据入 conventions 可先行）。
> 【2026-10-25 叠注】注释分诊 rollout 四阶段收口（dev 7 笔 `0ca1dc3..fa0d4e9`＋收口 `docs(omo)` 1 笔，均未 push）。两档新入：**存档方案** [plans/comment-triage-practice-v2-20261024.md](plans/comment-triage-practice-v2-20261024.md)（v2 终稿原样存档，`6759b3b` 入档；含已知过期 `--branch dev` 基线，纠偏一律记台账不改存档）与**执行台账** [plans/comment-triage-rollout-20261025.md](plans/comment-triage-rollout-20261025.md)（`6759b3b` 立卷，`54eeb6a`／`06c7358`／`fa0d4e9` 逐阶段回写，收口波填 Phase 4 §五）。定策：预判「可删面极薄、止步机制层即最优」被 Phase 3 fresh-eyes 分诊**证实**（scripts/ 9 文件 63 块删 5／转化 0／留 58，教科书面 slop 五类全零命中）→ **不启动全量清理役**；机制层终态＝R8 pre-commit＋range 面／M2 eslint `no-warning-comments`／M4' 守卫 `scripts/batch-clean-guard.mjs`／B3 7/7 补理由；六层门禁 `node scripts/verify-all.mjs` exit 0（8 步＋探针 20 条全绿，337.0s）。待主公裁决 4 项见台账 §六：P2-c（ci.yml 加 commit-audit `--range` job vs 维持现状，收口波推荐维持）、P2-e（known-issue `4ac5acf` 三选项）、P3-b（.sh 纳入口径）、P4-a（`scripts/ci-verify.mjs:570` 用途声明失真候选）。
> 【2026-11-01 叠注】P2-c 裁决 A＋落地波收口（dev 3 笔 `3a81f1b8..HEAD` 动态枚举实测：`e4894ea` workflow 落地／`70aef91` 三文档口径回写／`8cd120b` 修障叠注，＋收口 `docs(omo)` 1 笔，均未 push）。新档登记：**调研存档** [plans/p2c-remote-trigger-research-20261101.md](plans/p2c-remote-trigger-research-20261101.md)（P2-c 裁决 A+ 的决策依据——dwfrun-bab6c3a9 终稿要点原样收录：触发面／PR 机理（fetch-depth 深浅克隆 fatal 实证）／ruleset 实况（main-gate id 23195249 required 11 项）／提案史四发现＋未覆盖清单；裁决位 [rollout 台账 §六 P2-c 叠注](plans/comment-triage-rollout-20261025.md)，含落地实收与 pending 三件）。落地：独立 workflow `.github/workflows/commit-audit.yml`（三触发 push→dev＋PR→main＋dispatch、`fetch-depth: 0`、零依赖 job、advisory 未登 ruleset——R6/R8 首个远程自动触发点）；沙箱 3 场景全过=true（全量克隆零 node_modules 实跑 range 面 exit 0＋YAML 关键字段断言＋depth=1 反向对照复证）；六层门禁 verify-all exit 0。待主公 3 件：push 批准（本地待推 18 笔，`origin/dev..HEAD` 实测）、升格 required＋ruleset 登记（PUT rulesets/23195249 追加「Commit audit (commit-audit --range)」→12 项）、真实 dev push 首跑实证（runner 实况系调研未覆盖面，若红按浅克隆崩溃形态诊断）。
