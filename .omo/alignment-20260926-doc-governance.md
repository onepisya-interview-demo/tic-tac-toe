# 对齐报告：文档治理全景 + 待主公裁决与反馈清单（2026-09-26）

> 性质：主公对齐报告。来源：主公 2026-09-26 令「给我一份持久化报告，我读后回复，统一想法；需要反馈的你问我，需要我裁决的写进去」。
> 方法：汇总当前**全部** open 决策面——TTL 波交接（[25b250a](handover-20260926-ttl-channel-cleanup-wave.md) §三）+ 两计划波交接（[74a26cb](handover-20260926-two-plans-wave.md) §五/§六 存量）+ 匿名行计划（[§九](plans/ulw-anonymous-online-server-row-missing-20260922.md)）+ 规则机械化调研（[§五](research-rules-mechanization-20260926.md)）——再加本会话文档状态对账波（01283ed）的新发现与两处勘误。原文各文件不重复展开，本文给足裁决所需事实。
> 读法：每项独立成块，末尾留**批注位**。可直接在文件里批注，也可聊天回复「项 N：选 X」。批注后调度者沿 [decisions-pending](decisions-pending-20260924.md) 先例转已决入档。

---

## 一、30 秒全景

- **两波并行且都已收口**：TTL 通道波（`2d7709b` fix(api) + 交接报告 25b250a）与文档状态对账波（13 份状态线修正 + [总图](doc-status-map-20260926.md) + 01283ed）。两波文件面零交集，全程无冲突。
- **dev 与 origin/dev 齐平、树干净**：三笔均已进远端（2d7709b / 01283ed / 25b250a），push 项闭环（原 Q-A 已消）。
- **文档状态真源**：[.omo/doc-status-map-20260926.md](doc-status-map-20260926.md)——117 份计划逐份对账的产物；此后查「某计划实现了没」用 `Plan:` footer 反查 git log，**别信状态行**（13 份曾陈旧）。
- **真正 open 的裁决面**：本文 §三共 7 项（1 项验收 + 1 项配置 + 2 项开票裁决 + 1 项产品裁决 + 1 项调研唤醒 + 1 项小卫生）；§四共 4 项反馈征询。

## 二、诚实记录：本波两处勘误 + 一个时效观察

1. **勘误（归属）**：总图 findings 初版把「Q2/Q6 待主公」记到 [decisions-pending-20260924](decisions-pending-20260924.md) 名下——**错误**。该文件四项早在 2026-09-24 全部裁决关闭（文档已转决策记录）；Q2/Q6 实为两计划波交接的遗留，现由 TTL 交接的 Q-C/Q-D 承接（本文项 2/项 1）。
2. **勘误（事实）**：调度者早前曾向主公说 edge-runtime-migration「执行过、按决议回退」。对账实证：`git log -S "runtime = 'edge'"` 全分支**零命中**——edge 迁移**从未落库**（27e32ec 自述：Vercel 拒 + Next.js 16 弃用），属「入档即弃案」。处置建议见 §三 项 7。
3. **时效观察**：对账波 04:14 取快照，核查员在波中逮到并行会话 03:50 刚落的 `2d7709b`，当场把 TTL 计划状态线改判「已实现」——事后调度者独立复核确认无误。总图快照不含 04:52 的 25b250a。多会话并行下「快照型产物」的时效纪律，见 §四 反馈 2。

---

## 三、待主公裁决项（7 项，按建议处理顺序）

### 项 1：验收结论 + 稳定 tag（原 Q6 → TTL 交接 Q-D）＋ 想法统一区四条语义确认

- **事实**：惯例是主公业务语义抽查后给「未发现业务不符合」结论，令打 `dev-stable-*` annotated tag（只留本地）。上波交接 §六有四条已落地语义等主公逐条确认对齐：
  1. **三分语义**：清空 reset-room-stats（保留身份）／退出 leave-room（清本地身份+战绩，零网络写，服务端账本保留）／删除 delete-room（服务端+本地全清，唯一销户通道）；
  2. **删除自愈**：删除后同名 `POST /api/rooms` 幂等重建全零新账本，不复活旧数据；
  3. **TTL 口径**：30 天不活跃（`updated_at` 严格小于 cutoff，等于不删），凌晨 3 点 UTC 每日；
  4. **身份锁定**：有身份弹框只读、首次收名成功回写 localStorage；改名=换账本（旧账不迁移），未引入改名功能。
- **选项**：a) 逐条确认无异议 → 给验收结论 + tag 指令；b) 指出哪条与理解不一致 → 调度者出修订票，不擅自改语义。
- **愚见**：a；tag 可含本波 2d7709b。

> **主公批注位（项 1）**：

### 项 2：CRON_SECRET 配置（原 Q2 → TTL 交接 Q-C，主公亲手项）

- **事实**：端点已按 `Authorization: Bearer ${CRON_SECRET}` 落地；配值须 Vercel Dashboard 操作（调度者无凭据）。
- **选项**：a) 主公 `openssl rand -hex 32` 自生成，配 Vercel（Production），本地 `.env.local` 同步一份（启用 operations.md 手动 curl 通道）；b) 只配 Vercel，本地临时 env。
- **愚见**：a（demo 语境，本地留存可接受）。

> **主公批注位（项 2）**：

### 项 3：commit-audit 层⑤口径裁决（TTL 交接 Q-B，工具口径问题）

- **事实**：docs/commands.md 层⑤承诺 `--branch main` 0 violations，现查 main/dev 全史均 fail=164——全是 ≤2026-09-24 的存量（PR merge / dependabot / 旧格式），规则逐波叠加后回扫旧史必然欠账；先例 `ae02a33` 曾豁免 dependabot 复绿，其后又欠。上波交接「`--branch dev` 0 violations」记载与今查矛盾（引用交接数字前应现查——已入调度者记忆）。
- **选项**：a) 层⑤收窄为本波 commit 面（`origin/main..HEAD` 或逐 commit `--message-file`；hook 已天然逐 commit 把关）；b) audit 加历史豁免基线（沿 ae02a33 先例，欠账清单进配置）；c) 全史改写清理。
- **愚见**：a——零工具改动，语义就是「本波合规」；b 可作为规则机械化调研的活案例一并评估（见项 6）。

> **主公批注位（项 3）**：

### 项 4：HomeDialogMount 既有 flaky 是否开票（TTL 交接 Q-F）

- **事实**：`components/HomeDialogMount.test.tsx:288`（「合并并清空」按钮 not.toBeDisabled）全量并发下约 1/6 概率假红，单文件 3/3 绿。属 T-M1 域，与 TTL 波零交集；放着会随机打红未来六层门禁。
- **选项**：a) 下波开 ulw 小票修（嫌疑：确认钮 disabled 态异步竞态）；b) 暂留档观察。
- **愚见**：a——小票，主检 disabled 态驱动链路即可定位。

> **主公批注位（项 4）**：

### 项 5：匿名 online 行缺失 UX 路径——A/B/C/D 产品裁决（plan §九，09-22 起挂账）

- **问题**：新设备进房后服务端 row 不存在（admin DELETE / forged reset / 迁移丢失）→ 首局完胜 → outcomes 404 → **零记账 + 零庆祝 + 零反馈**。anti-silent-create 要求服务端 404 拒绝偷渡建档——契约正确，缺的是客户端 fallback。
- **边界**：生产从未观察到此症状；admin DELETE 当前无现实触发者。
- **方案**（plan §三原文浓缩）：

| 方案 | 改动 | 优点 | 缺点 |
|---|---|---|---|
| A 静默重定向 /offline | 404 catch → router.replace('/offline') | 零 UI 改动 | 无预期，像 bug |
| B 显式 resync 弹框 | 404 → 弹「该房间服务端无记录」：重新输入房间名 / 匿名继续（本地） | 用户可控 | 多一步；与 SyncConfirmDialog 视觉同质需文案区隔 |
| C 进房时检测拦截 | RoomGateMount 对注册异常提前拦截 | 提前挡 | 盖不住「玩到一半 row 被删」的主场景；多一轮 HTTP |
| D 服务端 404→自动建档重试 | server 端 auto-register | 客户端零改动 | **违反 anti-silent-create 红线（删除会被复活），不可选** |

- **愚见**：B 最对症（在 404 catch 点给用户显式选择）；若主公判断「生产零观察 + 无触发者」不值得动，也可裁「挂起不修、计划标 ARCHIVED」——该选项 plan 原文没有，但裁决权在主公。
- 若选 B：还需裁 §五三小项（弹框文案用词、复用 RoomGateDialog 还是新窄弹框、「匿名继续」的 offline 持久化语义）。

> **主公批注位（项 5）**：

### 项 6：规则机械化调研——唤醒条件③已触发，是否现在评估 C2

- **事实**：调研（82758cc）定四条唤醒条件，其中 **③「Q3 批注落地时顺手评估 C2」已于今日满足**（2d7709b 落地 Q3）。且 TTL 波又送来第二个活案例：项 3 的 audit 回扫欠账正是报告「规则演进回扫欠账」洞察的实例。
- **候选**（§五原文）：C1 anti-patterns 加机械化状态字段（小）／**C2 文档契约测试（R6 推广）**：vitest 断言 route 不含 `purgeStaleRooms` 字面实参（小-中）／C3 ast-grep 进 CI（中）／C4 eslint --fix + format（小，噪声取舍需裁决）／C5 派发红线断言模板化（小）。
- **选项**：a) 现在拉报告 §五立票，先评 C2（C1 台账字段顺手带上）；b) 继续待命，按其余三条件（三犯法则 / t-n4 再犯 / 主公点名）唤醒。
- **愚见**：a——Q3 刚落地正是 C2 设计输入最新鲜的时候，负对照（`rg 'purgeStaleRooms\([^)\s]' app/` 零命中）已经写好，固化成本最低。

> **主公批注位（项 6）**：

### 项 7：edge-runtime-migration 弃案标注（小卫生，10 秒事）

- **事实**：见 §二勘误 2——从未落库的弃案，头部无任何弃案标注，未来易误读为待执行。
- **选项**：a) 头部加一行 `[ARCHIVED 2026-09-26 弃案：edge 迁移从未落库（Vercel 拒 + Next16 弃用），后继见 runtime-cleanup-* 两档]`；b) 留原样。
- **愚见**：a。

> **主公批注位（项 7）**：

---

## 四、需要主公反馈的问题（非裁决，征询意见）

- **反馈 1：状态线修正的格式**。本次统一为「`- 状态: 已实现（hash 日期 一句话；状态线 2026-09-26 按 git 实况修正）`」，裁决记录类（APPROVED/已拍板）一律不动。格式合意吗？要更短的话可以只留「已实现（hash）」。
- **反馈 2：总图这类快照产物的维护策略**。a) 一次性快照，每波需要时重跑；b) 接入 AGENTS.md L1 路由做文档状态入口 + 立「计划收口必须回写状态行」纪律（可与项 6 的 C1 台账字段合并落地）；c) 不维护，随用随查。**愚见 b**——但「收口回写」成为硬纪律后，建议连 commit-audit 规则一起机械化（收口 commit 必须带上计划状态行 diff），否则又是靠自觉。
- **反馈 3：「已实现」的判定口径**。本次规则：有实现 commit 即 implemented（含「交付物本身就是文档」）；裁决记录（APPROVED/已拍板）即使执行完也不算误导、不动。open-source-readiness 因此被判 implemented（M1-M5 于 09-09 五笔落地）。主公认可这个口径吗？不认可我回滚该条状态线。
- **反馈 4：多会话并行的运行方式**。本次两波并行 + 对账波即时逮到并行落地，零冲突零误判（TTL 判定经主会话二次复核）。主公对这种「多会话并行 + 证据即时对账」有无反馈或要立的新纪律（比如快照型产物必须标注快照时刻——本次总图已标）。

---

## 五、无需主公操心的（已闭环，防误读）

- TTL Q3（删显式实参）/Q4（维持 30 天）/Q5（ulw/t-n4 等分支清扫）——`2d7709b` 落地，`git branch -a` 零残留，六层门禁全绿。
- push——origin/dev @ 25b250a，dev 齐平，树干净。
- decisions-pending-20260924 四项——09-24 已全部裁决落实（文档转决策记录）。
- 13 份陈旧状态线——01283ed 已修正，逐份带 git 证据。
- multi-user-stats-future-work——刻意占位（DO NOT implement），已被 rooms/stats v2 实质取代，维持不动。

## 六、如何回复

聊天里逐条回「**项 N：选 X**（+ 一句话理由，可选）」「**反馈 N：…**」即可；也可直接批注本文件对应批注位。收到后调度者：已决项转已决入档（沿 decisions-pending 先例）→ 按裁决立票/执行 → 本报告头部标注收口。

---

## 附：证据指针

| 事项 | 证据 |
|---|---|
| 文档状态总图（117 份对账产物） | [.omo/doc-status-map-20260926.md](doc-status-map-20260926.md)，01283ed |
| 本波计划档 | [ulw-doc-status-sync-20260926.md](plans/ulw-doc-status-sync-20260926.md) |
| TTL 波交付与交接 | 2d7709b + [handover-20260926-ttl-channel-cleanup-wave.md](handover-20260926-ttl-channel-cleanup-wave.md)（25b250a） |
| 两计划波交接（想法统一区 §六） | [handover-20260926-two-plans-wave.md](handover-20260926-two-plans-wave.md)（74a26cb） |
| 匿名行计划 A/B/C/D 原文 | [ulw-anonymous-online-server-row-missing-20260922.md](plans/ulw-anonymous-online-server-row-missing-20260922.md)（5c160c6） |
| 规则机械化调研（C1-C5 + 唤醒条件） | [research-rules-mechanization-20260926.md](research-rules-mechanization-20260926.md)（82758cc） |
| edge 弃案证据 | `git log -S "runtime = 'edge'"` 全分支零命中；27e32ec 正文自述 |
