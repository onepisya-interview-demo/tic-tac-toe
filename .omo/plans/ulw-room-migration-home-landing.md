# Plan: ulw-room-migration-home-landing —— 房间概念一步到位迁移 + 首页引导化

- **日期**：2026-09-19
- **分支**：dev
- **状态**：已实现（7586e82/c75cfdf 2026-09-19 W1 服务端+客户端一波迁移，e6bd762 2026-09-20 W3 探针迁移，a8abea9 终验 V9 ACCEPT-WITH-NOTES；状态线 2026-09-26 按 git 实况修正）
- **前置阅读**：AGENTS.md §查找入口 / §本项目反模式（DB schema drift 流程）、docs/verification-gauntlet.md

---

## §0 背景与决议

### 0.1 问题事实链（本轮 rg 精查确认）

1. **首页 focus 冗余 GET**：`GET /api/players/{name}/stats` 全仓库唯一消费者是首页
   `components/OnlineStatsCard.tsx:95-106`。触发点四个：mount、window focus（每次切回
   标签页都打一次）、`ttt:offline-stats-changed`（合并成功后）、playerName 变化。
   focus 路径的动机是「跨设备读恢复」，但该场景极低频；且 `/result` 页是 force-dynamic
   SSR 直读 DB，天然最新。focus 自动刷新是纯冗余轮询。
2. **首页信息架构错位**：战绩卡占据 CTA 之上首要位置；战绩完整主场本就是 `/result`
   页（SSR 战绩单）。首页进门先看仪表盘，引导性被稀释。
3. **常驻表单违反 Lazy Registration**：name 的真实消费点只有两个——进在线对战时
   POST outcome 归属、合并弹框内收名（`SyncConfirmDialog` 本就内嵌完整收名流）。
   首页常驻 `PlayerNameForm`（含折叠/编辑/清除/反向 hydration 一整套）是把
   「按需身份」做成了「进门注册」。业界标准模式是 Lazy Registration
   （UI-Patterns.com 收录：先给价值，需要时才收身份）。
4. **name 概念错位（用户领域直觉，成立）**：本应用两种模式都是同设备对战
   （业界术语 pass-and-play，Wiktionary：「通过传递设备轮流游玩」），X/O 两个玩家的
   胜负全记在同一个 name 下。所以 name 从来不是「对战中的玩家身份」，而是
   **这台设备上这一组人的战绩账本标识**——「房间」是准确概念：
   - 在线模式 = 账本在云端的房间（房间名定位账本，跨设备续记）
   - 离线模式 = 账本在本地的房间（线下面对面游玩空间）
   - 合并弹框 = 把线下账本并入云端同名房间

### 0.2 三决议（维护者 2026-09-19 拍板）

| # | 决议 | 内容 |
|---|------|------|
| D-1 | **首页改引导页** | 砍掉 `OnlineStatsCard` 与全部首页 API 请求；首页零表单。战绩展示主场归 `/result`。首页 = hero + 玩法引导 + 双 CTA + 战绩静态入口。 |
| D-2 | **按需弹框收名** | 新建 `RoomGateDialog`：点「在线对战」无名时弹框收名，成功后自动进局；线下 CTA 永远零拦截直行。`PlayerNameForm` 整体删除。 |
| D-3 | **改叫「房间」，一步到位** | UI 文案、API 路径、DB 列、localStorage key、代码标识符、测试、QA 探针一次迁完，不留旧 surface。 |
| D-4 | **数据可清空，从头来过**（维护者 2026-09-19 补充） | 当前部署无人使用：DB 存量行不保留、浏览器 legacy key 不迁移。DB 列迁移从「INSERT SELECT 数据保留」简化为「列集不符 → DROP 重建」；旧 `ttt.player.name.v1` 直接忽略并清理。 |

---

## §1 术语字典（概念映射表）

| 维度 | 旧 | 新 |
|------|----|----|
| 用户可见概念 | 玩家名 / 名字 / 注册 / 登录 | 房间名 / 创建房间 / 进入房间 |
| 代码标识符 | `playerName` / `setPlayerName` / `isPlayerName` / `normalizePlayerName` | `roomName` / `setRoomName` / `isRoomName` / `normalizeRoom` |
| lib 模块 | `lib/player-name.ts` | `lib/room-name.ts`（含一次性 storage 迁移） |
| 存储层 | `lib/db.ts: registerOrLoginName / loadRecordByName / recordOutcomeForName / mergeRecordByName` | `registerOrLoginRoom / loadRecordByRoom / recordOutcomeForRoom / mergeRecordByRoom`（以实际符号为准） |
| DB 列 | `game_stats.name TEXT UNIQUE` | `game_stats.room TEXT UNIQUE`（数据随列迁移保留） |
| API | `POST /api/sessions` | `POST /api/rooms` |
| API | `GET /api/players/{name}/stats` | `GET /api/rooms/{room}/stats` |
| API | `POST /api/players/{name}/stats/outcomes` | `POST /api/rooms/{room}/stats/outcomes` |
| API | `POST /api/players/{name}/stats/merge` | `POST /api/rooms/{room}/stats/merge` |
| localStorage | `ttt.player.name.v1` | `ttt.room.name.v1`（不迁移数据，legacy key 启动时清理，见 §2.5） |
| URL 参数 | `/result?name=<x>` | `/result?room=<x>` |
| 事件 | `ttt:player-name-required` / `ttt:player-name-changed` | `ttt:room-required`（gate 弹框触发；changed 随表单删除） |
| testid | `player-name-*` 全族、`online-stats-*` 全族 | `room-gate-*`（新）；`online-stats-*` 随卡删除 |
| 组件 | `PlayerNameForm`、`OnlineStatsCard` | 删除；新增 `RoomGateDialog` + `RoomGateMount`（宿主，仿 `HomeDialogMount` 模式） |
| 不变 | `ttt.offline.stats.v1` / `ttt.offline.last-merged-local.v1` / `ttt.offline.sync-declined.v1` | 语义仍是「线下账本」，不含 name 概念，不动 |
| 不变 | 路由 `/online` `/offline` `/result` | 路由名描述记账位置，语义仍准，不动（仅 `/result` 查询参数改名） |

**文案红线**：所有用户可见文案禁现「玩家名/注册/登录」；统一「房间名/创建房间/进入
房间」。/online 与 /offline 页内文案需注明「同设备对战」（防「在线=可远程联机」误解，
pass-and-play 语义），此误解风险在 §0.1-4 已确认，靠文案消解而非改路由。

---

## §2 变更设计

### 2.1 首页重做（app/page.tsx）

删除 `OnlineStatsCard`、`PlayerNameForm` 挂载。新结构（保持一屏预算，
one-screen-qa 契约不破）：

```
hero（井字棋 + 一句话价值主张，保留现有）
玩法引导区（新，纯 RSC 静态）：轮流落子 · 三连即胜 · 同设备传递（pass-and-play 说明）
双 CTA：
  线下房间 · 面对面同设备 · 本地记账 → /offline（requireName=false，永远直行）
  在线房间 · 同设备对战 · 战绩云端 → /online（无名 → RoomGateDialog；有名 → startGame + push）
战绩静态入口（新）：有 roomName 时渲染「查看 <room> 的战绩 →」链接去
  /result?room=<roomName>（纯 <Link>，零请求）；无名时不渲染。
HomeDialogMount（保留：合并弹框，文案改房间术语）
RoomGateMount（新宿主）
JSON-LD / SoundToggle / ViewTransition / force-dynamic 均保留
```

### 2.2 RoomGateDialog + RoomGateMount（新）

- `RoomGateMount`（首页挂载的 client 宿主）：监听 `window` 事件
  `ttt:room-required`（detail 携带 `{ mode, href }`），打开弹框。
- `StartGameButton` 改造：`requireName` 分支从「dispatch 事件让 PlayerNameForm
  聚焦」改为「dispatch `ttt:room-required`」；有名路径语义不变（startGame → push）。
- `RoomGateDialog`：单输入 + 主 CTA「创建并进入」/ 次 CTA「取消」+ n/24 计数 +
  ESC 关 + reduced-motion 无动效路径 + 初焦落主 CTA（requestAnimationFrame 模式，
  参照 SyncConfirmDialog F3 修复）。提交即 `postRoomSession(trimmed)`
  （POST /api/rooms）：
  - ok → 仅在此时写 localStorage（`setRoomName`）+ store.roomName →
    `startGame(mode)` + `router.push(href)` + 关闭
  - 422 / aborted / network-error → 就地错误文案，不写任何持久层，不导航，
    输入值保留可改可重试
  - existed:true 时成功文案「已进入房间 <room>」；existed:false「房间已创建」
- 命名对齐 `SyncConfirmDialog` 的既有交互词汇（同一套弹框纪律）。

### 2.3 API family 迁移（一步到位，旧路由直接删除）

- 新增 `app/api/rooms/route.ts`（POST，register-or-enter 语义，返回
  `{stats, existed}`）与 `app/api/rooms/[room]/stats/{route,outcomes/route,merge/route}.ts`。
  Handler 逻辑从现 four routes 平移，仅符号改名（normalizePlayerName → normalizeRoom）。
- 删除 `app/api/sessions/` 与 `app/api/players/` 整目录（无兼容 shim；本应用无外部
  API 消费者，QA 探针同波次更新）。
- 语义保持不变：GET 未知 room → 404 problem+json（客户端译为 `stats:null`）；
  outcomes/merge 未知 room → 404 / 409（merge 前必须先 POST /api/rooms 的
  anti-silent-create 契约原样保留）。

### 2.4 DB 列迁移（清空式重建，D-4 许可）

- `db/schema.ts`：`name: text('name').unique()` → `room: text('room').unique()`；
  表名 `game_stats` 保留（语义仍准）。
- `lib/db.ts` `getDb()` bootstrap 后 reconcile 收敛为**单一规则**：
  `pragma_table_info('game_stats')` 列集与 drizzle schema 预期不符
  （含 legacy `name` 列库、W1 遗留 NULL 行库等一切历史形状）→
  `DROP TABLE` + 按新形状重建。**数据不保留**（D-4：无人使用，清空
  从头来过）。趁势删除 db.ts 里历史多分支迁移逻辑（W1 ranked retire
  的 NULL 行退役分支等），bootstrap 只剩「列集相等？否则重建」一条路径。
- 服务函数改名（§1 映射），测试同波更新。
- 红线不变：探测必须存在——本地 file: 库与 Turso 生产库都是旧形状，
  没有探测的启动即 `no such column` 炸服（W1 实证）。

### 2.5 localStorage legacy 清理（lib/room-name.ts）

D-4 许可清空：**不迁移**。所有读写只认 `ttt.room.name.v1`；hydrate 点
（`lib/store.ts` 现有逻辑）若发现 legacy `ttt.player.name.v1` 存在，
直接 `removeItem` 清除（从头来过，旧名字视为无名）。单向、SSR 安全。

### 2.6 /result 页

- `?name=` → `?room=`（SearchParams 类型 + `pickName` → `pickRoom`）。
- SSR 查询 `loadRecordByName` → `loadRecordByRoom`。
- fallback 文案改房间术语（无名时引导语改为「在首页点「在线对战」创建房间后再来
  查看战绩」，因首页已无常驻表单）。
- 旧书签 `?name=` 按「无 room」处理走 fallback（不做 301，portfolio 无保留价值）。

### 2.7 客户端概念层改名（机械替换 + 编译面收敛）

`lib/store.ts`（playerName → roomName、setPlayerName → setRoomName、hydrate 点接
§2.5 legacy 清理）、`lib/game-net.ts`（四函数改名 + URL 改 `/api/rooms/...`）、
`components/ResultNavigator.tsx`（push `/result?room=` + roomName）、
`components/OfflineStatsPanel.tsx`（isAnonymous 读 roomName + 文案）、
`components/SyncConfirmDialog.tsx`（内嵌收名流字段与文案 → 房间）、
`components/HomeDialogMount.tsx`（setStoreName → setRoomName；保留
`ttt:offline-stats-changed` 对 pendingSyncCount 的重估用途，仅随 OnlineStatsCard
删除其 refetch 监听方）、`components/StartGameButton.tsx`（§2.2）。
`components/PlayController.tsx` / `RestartButton.tsx` 无 name 依赖（已确认），不动。

### 2.8 测试与探针迁移

- vitest 删除：`OnlineStatsCard.test.tsx`、`PlayerNameForm.test.tsx`。
- vitest 新增：`RoomGateDialog.test.tsx`（R1-R9）、`lib/room-name.test.ts` 增
  legacy 清理 describe（L1-L4）。
- vitest 改名/更新：`tests/api/players-stats.test.ts` → `rooms-stats.test.ts`、
  `tests/api/sessions.test.ts` → `tests/api/rooms.test.ts`、
  `tests/lib-player-name.test.ts` → `tests/lib-room-name.test.ts`、
  `tests/lib-game-net.test.ts`（URL 断言）、`tests/db/db.test.ts`（函数名 + 新增
  D1-D4 describe「legacy name-column rebuild」）、store / ResultNavigator /
  SyncConfirmDialog / OfflineStatsPanel / StartGameButton / PlayController 各测试的
  字段与事件名。
- QA 探针（生产构建 + BASE_URL 纪律不变）：`one-identity-qa.mjs`（c step 改走
  RoomGateDialog 收名流；新增首页零请求断言）、`home-return-qa.mjs`（step 07 的
  「OnlineStatsCard 前后 localStorage 快照不变」改写为「首页全程 /api/* 请求数 = 0」
  ——断言更强）、`offline-mode-qa / offline-qa / offline-result-qa / one-screen-qa`
  （文案与 testid 适配）、`visual-qa.mjs`（首页改版，基线截图更新）、其余探针跑绿
  暴露增量（`rg -l "player|name=" tests/qa` 已知 7 文件提及）。

---

## §3 分支闭环表

### §3.1 RoomGateDialog（RoomGateDialog.test.tsx，R1-R9）

| ID | 分支 | 断言要点 |
|----|------|---------|
| R1 | 无名点在线 CTA | dialog open；URL 不变（未导航）；零 POST |
| R2 | 合法名提交成功（existed:false） | POST body 为 trim 值；localStorage + store 写入；`startGame('online')` 调用；push('/online')；dialog 关 |
| R3 | 已有房间（existed:true） | 同 R2 且成功文案为「已进入房间」 |
| R4 | 422 | 就地错误；零持久层写入；不导航；输入保留 |
| R5 | aborted（超时） | 超时文案；同 R4 零副作用 |
| R6 | network-error | 网络文案；同 R4 零副作用 |
| R7 | busy 防重 | 提交中按钮 disabled；第二次点击零额外 POST |
| R8 | ESC / 取消 | dialog 关；零 POST；零写；零导航 |
| R9 | 输入含首尾空白 | POST body = trim 后值；localStorage 存 trim 值 |

### §3.2 legacy key 清理（tests/lib-room-name.test.ts，L1-L4）

| ID | 分支 | 断言要点 |
|----|------|---------|
| L1 | 旧 key 有 + 新 key 无 | 视为无名（null）；旧 key 被清除；零新写入 |
| L2 | 新 key 有 + 旧 key 有 | 正常读新 key 值；旧 key 顺手清除；新值不被影响 |
| L3 | 双 key 无 | 返回 null；零写入 |
| L4 | 无 window（SSR） | 返回 null；零异常 |

### §3.3 DB 清空式重建（tests/db/db.test.ts 新 describe「legacy name-column rebuild」，D1-D4）

| ID | 分支 | 断言要点 |
|----|------|---------|
| D1 | 手建旧形状库（name 列 + 种子行）→ getDb | 表重建为新形状：pragma 列集含 `room` 不含 `name`；旧种子行不保留（0 行起点，D-4 清空许可） |
| D2 | room UNIQUE 实证 | 同 room 第二行插入被 UNIQUE 拒绝 |
| D3 | reconcile 幂等 | closeDb + 重开后列集不变、仍可用（0 行） |
| D4 | fresh 库 | PRAGMA 列集与 drizzle schema 声明相等 |

### §3.4 API 白名单与语义（tests/api/rooms*.test.ts，N1-N5）

| ID | 分支 | 断言要点 |
|----|------|---------|
| N1 | POST /api/rooms 新 room | 200 `{stats, existed:false}`；空行落库 |
| N2 | 同 room 再 POST | `{stats, existed:true}`；不重复建档 |
| N3 | 控制字符 / 超长 / 空 | 422 problem+json |
| N4 | GET 未知 room | 404 problem+json（客户端译 stats:null） |
| N5 | outcomes/merge 未知 room | 404 / 409 语义与现实现逐字段一致 |

### §3.5 QA 探针（tests/qa/*，Q1-Q7）

| ID | 探针落点 | 断言要点 |
|----|---------|---------|
| Q1 | one-identity-qa 新 step | 首页三态（无名 mount / 有名 mount / focus 切换×3）`/api/*` 请求数 = 0 |
| Q2 | one-identity-qa c step 重写 | 无名→在线 CTA→弹框收名→/online 新局→上排胜→/result?room= SSR 含战绩；outcome POST 恰 1 次 |
| Q3 | one-identity-qa b step | 无名线下 CTA 直行零弹框零拦截（既有断言保绿） |
| Q4 | offline-result-qa | /result?room= 三分支 + 旧 ?name= 走 fallback |
| Q5 | home-return-qa | 合并弹框房间文案；合并流全路径；首页零请求强断言（替代原 step 07 快照断言） |
| Q6 | one-identity-qa 新 step | 预设旧 key → 打开首页 → 旧 key 已被清除、行为等同无名（房间术语） |
| Q7 | visual-qa | 首页新基线截图（引导页布局） |

---

## §4 验收标准（AC）

| AC | 内容 | 验证方式 |
|----|------|---------|
| A1 | 首页零 API：任何状态、任何 focus 行为下首页 `/api/*` 请求数 = 0 | Q1 探针硬断言 |
| A2 | 首页 = hero + 玩法引导 + 双 CTA + 战绩静态入口；一屏预算不破 | Q7 + one-screen-qa |
| A3 | 在线 CTA 无名 → RoomGateDialog 全分支（R1-R9） | 单测 + Q2 |
| A4 | 线下 CTA 永远零拦截零弹框 | Q3 |
| A5 | 新 API family 全语义等价；旧路径（/api/sessions、/api/players/*）已删除（请求得 404） | N1-N5 + A5 curl 审计 |
| A6 | DB legacy name 列库启动时清空式重建（列集符 / UNIQUE / 幂等 / fresh 相等，数据不保留） | D1-D4 |
| A7 | legacy localStorage key 被忽略并清理，行为等同无名 | L1-L4 + Q6 |
| A8 | /result?room= 三分支正常；?name= 优雅 fallback | Q4 |
| A9 | 概念零残留：`rg -n "playerName|isPlayerName|PLAYER_NAME|/api/sessions|/api/players|ttt\.player\.name" app components lib db tests` 零命中；用户可见文案零「玩家名/注册/登录」 | grep 审计（.omo/plans 与 reports 历史文档除外） |
| A10 | 六层门禁全绿：vitest / typecheck / lint / build / commit-audit / 浏览器探针 | 每 commit |
| A11 | on-demand 三层豁免声明：本波不改 lib/game.ts 纯规则面（store 仅机械改名，mutation 豁免理由入 Tested trailer；若审查不认则补跑） | trailer + V 席复核 |
| A12 | 对抗终验：独立 fresh subagent V 席出 reports/review/V9.md，判定 ACCEPT；自验收不认 | herdr 派发 |

---

## §5 执行协议

1. **波次与 commit 拆分**（原则：每 commit 六层门禁绿；收尾删净旧 surface，
   不留长期 shim；允许执行席按实际编译面微调边界）：
   - W1 服务端：schema + db.ts 清空式 reconcile + 新 API family + 旧 API 删除 +
     tests/api + db.test（D1-D4）。
   - W2 客户端：lib 三件套 + 全部组件 + 三页 + 首页重做 + RoomGateDialog +
     组件/单测（R/S/N 族落位）。
   - W3 探针与文档：QA 探针更新 + visual 基线 + README / DESIGN.md /
     AGENTS.md（根 + components/ + lib/ 三份代码地图）术语更新。
2. **herdr 派发**（沿用 ulw-result-play-again-loop 协议）：调度者（本 session）只做
   拆解/派发/轮询/独立验收/收尾；执行席 fresh codex（tab 不 split），teach-back 后
   动手，通道先验；生产构建探针在独立 git worktree + 独立端口，禁触 :3000。
3. **对抗终验**：W1-W3 收尾后开 fresh-context V 席（与执行席零共享状态），独立
   产线构建 + 自写攻击探针 + AC 逐条复核，产出 reports/review/V9.md
   （`git add -f` 入档）。V 席判定 ACCEPT 前不得宣布完工。
4. **超规说明**：改名迁移波及面 ~40 文件，超出 PR <500 LOC 指南；理由：机械改名
   无法再拆而不破编译，plan footer 注明。

---

## §6 Rejected alternatives 与风险

- **只改文案层渐进迁移**（API/DB 保留 name）：维护者明确选一步到位；渐进会长期
  违反 ubiquitous language（代码与概念两张皮）。
- **保留战绩卡只砍 focus 刷新**：维护者选引导页；战绩主场 /result 的 SSR 语义更准。
- **路由改名（/online→/room 等）**：路由名描述记账位置不含 name 概念，改名无概念
  收益、成本（探针/文档/书签）高。Rejected。
- **「棋桌/牌桌」候选词**：语感好但「房间」与用户心智一致且已拍板。存档备查。
- **保留数据的 INSERT SELECT 列迁移**（AGENTS.md 经典 drift 流程）：D-4 许可
  清空后不再必要，DROP 重建更简单；但**列集探测本身仍是红线**（无探测的
  旧库启动即 `no such column` 炸服，W1 实证）。
- 风险 R-1（已随 D-4 降级）：Turso 生产库首请求触发 DROP 重建即完成「线上
  清库」——deploy 后跑一次线上探针确认 200 即可，无需数据审计。
- 风险 R-2：one-identity-qa 重写幅度大，c step 弹框流程时序需对齐 F3 初焦模式。
- 风险 R-3：`ttt:offline-stats-changed` 有两个消费方（pendingSyncCount 重估保留 /
  卡片 refetch 删除），删错会破坏合并弹框触发——W2 执行时以 HomeDialogMount
  监听保绿为准。
