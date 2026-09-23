# ulw · solo 本地真源 + name 登录身份（单表模型 + 回首页弹框）

- **日期**：2026-09-18
- **状态**：APPROVED（主公 2026-09-18 御批「现在你可以派发任务了」；四决策点 D1-D4 同日对齐问答照准）
- **触发**：主公 2026-09-18 重申旧 brief 并下新谕——solo 页残存网络请求必须清零、name 改登录身份、数据库单表化、线上数据永不进 localStorage、弹框改回首页时机
- **基线**：dev @ 3ad82e8（V4 终验 ACCEPT-WITH-NOTES + CR 评审 0 P0/2 P1 已入档；工作树仅 next-env.d.ts 生成漂移，随 W1 归位）
- **执行体**：fresh codex（herdr **tab**，非 split pane），调度者只拆解、派发、独立验收、沉淀

---

## 0. 对账（先查 git logs 之答）

**已落地勿重做**（86e1469..3ad82e8 五提交 + 前案）：拆分单机/复用组件、四页 ViewTransition、一屏收紧、
四页宽恒等、sticky 紧凑 header、restart 不现于战绩视图、结算动画单次、52 法则对照 + 玩家名调研 + 截图重制、
README 双语、solo 玩局零 auto-POST、V4 终验、CR 评审。

**违谕现状**（本轮实修面，rg 全量定位）：

| # | 现状 | 违背的谕令 |
|---|---|---|
| V-1 | `SoloStatsPanel.tsx:117-119` 挂载即按名 GET 线上 | 「solo 页面零网络请求」「清空后下次进来不得从线上拉」 |
| V-2 | `SoloStatsPanel.tsx:166` + `PlayerNameForm.tsx:58` PUT 存名（覆盖式） | 「name 不允许覆盖，只允许新增」 |
| V-3 | `SoloStatsPanel.tsx:178` + `StartGameButton.tsx:85` /sync 后回拉合并行 | 「线上的数据永远不进 localstorage」 |
| V-4 | `StartGameButton.tsx:99` 死 `void fetchSoloStats(name)`（CR P1-4） | 同上 + 死代码 |
| V-5 | `db/schema.ts` 双表（game_stats + solo_records） | 「数据库模型只有一套，仅多一个 name 字段」 |
| V-6 | 弹框时机 = 首页起战拦截（StartGameButton） | 「只要返回首页的时候才回跳弹框」 |

**全新需求**：name 注册/登录语义（先到先得、不可改、重名提醒=登录）；统一表 + name 列；
未设名时弹框内先输入才许同步；登录后线上战绩只读展示。

---

## 1. 目标定义

**一句话模型**：localStorage 是 solo 战绩的唯一真源，线上 DB 是 name 之下的唯一真源；
两界之间唯一的数据流是「回首页时用户确认后，本地数字按字段累加进线上 name 行，然后本地清零」；
name 是线上身份（先到先得、永不可改、重名即登录），换设备输名 = 登录 = 只读查看线上战绩，绝不写入本地。

分条目标：

- G1 solo 页零 name、零网络、零同步按钮；战绩纯本地展示与清空。
- G2 name 是线上身份：首页输入框（每台手机都有一个）+ 弹框内嵌输入共用同一套注册/登录语义。
- G3 同步 = 用户确认后的单向 push（local → name 行累加）+ 本地清零；防重复由清零 + 哨兵保证。
- G4 线上战绩只在 UI 只读展示，任何网络响应不写 localStorage。
- G5 弹框只出现在「带未同步局数返回首页」时机；起战路径零打断。
- G6 ranked 双人模式「和原来一样」：outcome POST 与共享行（id=1）不动。

## 2. 已御批决策点

| # | 决策 | 御批 |
|---|---|---|
| D1 | 弹框时机 | ✅ 返回首页时弹出（起战拦截废除） |
| D2 | 跨设备「重新加载历史战绩」 | ✅ 只读展示线上战绩（DB→UI，不落 localStorage） |
| D3 | solo 页 name 表单与同步按钮 | ✅ 全部撤出（同步只走首页弹框，未设名弹框内先输入） |
| D4 | name 已存在行为 | ✅ 重名即登录（先到先得、不可改名、提醒「已存在，已登录」） |

---

## 3. 数据模型与 API 目标形状

**统一表**：`game_stats` 加 `name TEXT UNIQUE`（可空；NULL = ranked 共享行 id=1，行语义不变）；
`solo_records` 整表退役（push 冻结中生产无真实数据，直接 DROP，不做搬迁脚本；本地/测试 schema 同步）。
GameStats 五数形状（totalGames/xWins/oWins/draws/currentStreak）两端已一致，`recordOutcome` 复用不变。

| 端点 | 处置 | 语义 |
|---|---|---|
| `POST /api/player-session` | **新增** | body `{name}` → isPlayerName 校验 → 无行则建（`{stats, existed:false}` 注册）、有行则返回（`{stats, existed:true}` 登录）。name 一经建行不可改（无改名端点 + UNIQUE 兜底） |
| `GET /api/solo-stats?name=` | 保留 | 只读按名行（登录后线上战绩卡的数据源）；客户端禁止把响应写入 localStorage |
| `POST /api/solo-stats/sync` | 改造 | body `{name, stats}` 不变 → 语义改为「本地 stats 按字段累加进 name 行」→ 返回 name 行新值（仅展示）；name 行不存在 → 409（防静默建档，弹框流程保证先注册/登录） |
| `PUT /api/solo-stats` | **删除** | 覆盖式存名废弃（curl → 405） |
| `POST /api/solo-stats`（单局累加） | **删除** | postSoloOutcome 已无调用方，端点随之退役 |
| `/api/stats` + `/api/stats/outcome` | 不动 | ranked「和原来一样」 |

**localStorage 契约**：`ttt.solo.stats.v1`（solo 唯一真源；仅「清空按钮」与「合并并清空成功」两个写/删点）；
`ttt.player.name.v1`（线上身份记忆；首页输入框与弹框共用注册/登录成功时写入）；
`ttt.solo.server.synced.v1`（哨兵保留）；**新增** `ttt.solo.sync-declined.v1`（**sessionStorage 会话级**：
「保留本地」时记录当时 pending 值，同会话内 pending 无增量不重弹；新局产生 pending 超过记录值 → 再弹；关标签页即忘）。

---

## 4. 波次设计（串行单写者 + 并行只读调研）

| 波 | 主题 | 改动面 | 门禁增项 |
|---|---|---|---|
| W1 | 单表 + name 注册/登录 API（**加法先行**） | db/schema.ts（加 name 列、solo_records 退役）、lib/db.ts（registerOrLoginName、按名累加复用 accumulate 纯函数）、app/api/player-session/route.ts（新）、tests/db+api。既有 solo-stats 端点本波不动（调用方仍在）；删除/改造跟随调用方清零：W2 删单局累加 POST、W3 删 PUT 与 sync 409 化——保每 commit 绿 | 六层 + db/api 单测（注册/登录/422/UNIQUE；409/405 判定顺延 W3 后验收） |
| W2 | solo 页纯净化 | components/SoloStatsPanel.tsx（撤 GET/PUT/同步按钮，纯本地展示+清空）、components/PlayerNameForm.tsx 自 solo 面移除、lib/store.ts（删 soloSync 僵尸态 + V-1/V-2 调用点）、lib/solo-net.ts 收敛、AGENTS.md 契约行 | 六层 + **Stryker**（store.ts ≥ 50.49）+ pure-local-qa 强化（设名态挂载零请求断言） |
| W3 | 首页身份区 + 回首页弹框 | app/page.tsx（PlayerNameForm 改注册/登录语义 + 线上战绩只读卡）、components/StartGameButton.tsx（删拦截 + V-4 死 GET）、components/SyncConfirmDialog.tsx（内嵌 name 流 + 新触发契约）、sessionStorage declined 标记、tests/qa/home-return-qa.mjs（新）、弹框单测 ≥4 it（P1-5） | 六层 + UX_STRICT=1 9/9 + 新探针全绿 |
| W4 | 账清 + 文档 | F1（新弹框语义下重判 catch-up 文案）/F3/F4/F5/F6/F7/F8 + P3 顺手清；F2 由新弹框天然预填，验证后关；AGENTS.md 全量契约行重写、README 双语、DESIGN.md why-not 补段、UI 有变则重截图 | commit-audit + visual-qa 双端 + 人工目验 |
| V5 | fresh-context 对抗终验 | 独立 codex、零共享 session，只许写 reports/review/V5.md + :3101 探针 | 结构对齐 V4：teach-back / 六层自跑 / A1-A12 逐条 / 对抗矩阵 / slop 抽查 / 终判 / MINOR / 资源自扫 |

**并行只读调研**（W2-W3 期间择机派发，供 W3 文案）：R4 无密码用户名注册/登录的行业 UX 惯例
（重名提示文案、注册 vs 登录的界面区分、错误提示时机）——工具面 ddgs/ddgr/mcporter/firecrawl/gh。

---

## 5. 验收标准（机器可判）

| # | 验收项 | 判定 |
|---|---|---|
| A1 | solo 页零网络（设名/未设名两态） | 两态各：加载 /solo → 玩 3 局 → 清空 → 重进，`page.on('request')` 同源 `/api/` 计数 = 0（pure-local-qa 强化 step） |
| A2 | 线上永不进本地 | 登录已有名并浏览线上战绩卡前后，localStorage 全键快照逐字节一致（新探针断言） |
| A3 | 弹框时机全路径 | solo→回首页且 pending>0 → 弹框现；首页直接起战不弹不拦（dialog count=0 且导航成功）；「保留本地」零网络写 + 同会话 pending 无增量不重弹（含刷新）；再玩 1 局 pending 超记录值 → 回首页再弹（home-return-qa） |
| A4 | name 注册 | 新名 → `{existed:false}` + name 行建立（api 单测 + 探针） |
| A5 | name 登录与不可覆盖 | 已有名 → `{existed:true}` + UI「已存在，已登录」提醒；`curl -X PUT /api/solo-stats` → 405；UNIQUE 约束拒绝同名二插（单测） |
| A6 | 同步单向 + 防重 | 合并并清空 → name 行按字段累加（local 3 局 → 行 totalGames +3）→ 本地清零 + 哨兵更新；响应仅展示不落 localStorage；pending=0 后回首页不弹（merge-sync-qa 改造版 + 快照断言） |
| A7 | 跨设备只读恢复 | A 设备同步 3 局 → B 设备（fresh context）输名 → 线上战绩卡显示 3 局；B 的 solo key 全程为空；B 玩 solo 从 0 独立累计（跨 context 探针，替代旧 sync-qa step04b） |
| A8 | ranked 无回归 | /play 结算 outcome POST 照旧、共享行更新；visual-qa + ux-qa + solo-mode-qa 全绿 |
| A9 | 门禁 | 六层 × 每 commit 全绿；store.ts 触改波 Stryker ≥ 50.49；commit-audit 0 violations |
| A10 | V5 终验 ACCEPT | reports/review/V5.md 终判 ACCEPT（或 ACCEPT-WITH-NOTES 且 MINOR 均账级） |
| A11 | 文档一致 | AGENTS.md / README 双语 / DESIGN.md 与实现一致，slop 抽查零「未实现功能描述」 |
| A12 | 旧账清偿 | P1-4 死 GET grep 0 命中；P1-5 弹框 name 流单测 ≥4 it；F1-F8 关闭或在 V5 报告显式记录不修理由 |

---

## 6. 执行协议

- 分支：**dev**；Conventional Commits + 中文 WHAT/HOW/WHY 正文 + 全套 lore trailer + `Plan: .omo/plans/ulw-name-login-one-truth.md` footer；禁 `--no-verify`
- 执行器：fresh codex（herdr tab，每任务 fresh session；codex 通道禁 apply_patch，编辑一律 shell）
- 派发协议：接收方 teach-back 复述任务与验收 → 动手；产出未经调度者独立验证视为未完成
- 调度者（ZCode session）：拆解、派发、轮询、独立验收、终审沉淀；不亲自写主线代码
- worker 退场前采现 session id 记 `.omo/sessions.local.md`，再 /exit + `herdr pane close`
- 探针端口规约：QA 用 :3101，不触主公 :3000 活服
- 工作树前置：next-env.d.ts 生成漂移随 W1 commit 归位

## 7. Rejected（本轮不做）

- ❌ 线上→本地任何方向的写（含「拉回合并」旧语义）
- ❌ name 改名 / 找回（无密码体系下不支持；UNIQUE + 无端点双保险）
- ❌ CRDT / 时间戳合并（同名并发维持 last-write-wins per-field 累加，README 注边界）
- ❌ ranked 模式改造（「和原来一样」）
- ❌ 起战拦截路径保留（D1 已裁回首页时机）
- ❌ solo_records 搬迁脚本（生产无数据，直接退役）
- ❌ 动画库引入 / 专设同步页路由（沿用既有契约）
