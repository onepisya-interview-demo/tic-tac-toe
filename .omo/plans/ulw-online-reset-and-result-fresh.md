# Plan: ulw-online-reset-and-result-fresh —— 在线房间战绩清空 + /result 首屏新鲜度

- **日期**：2026-09-22
- **分支**：dev（只在 dev 上开发；执行走独立 worktree + ff 合入，历史保持 dev 线性）
- **状态**：**已全部拍板（D-1~D-8），转正执行**——W-R（房间战绩清空）+ W-F（/result 首屏新鲜度）两波并行 + 独立验证波
- **来源**：主公 2026-09-22 两条现场反馈——「在线版本没有清空战绩的选项」「在线实时成绩单的战绩显示是延迟的，需要刷新一次之后才会显示最新战绩」
- **前置阅读**：CONTEXT.md 同步族、lib/db.ts 头注释（service/transport 分离契约）、components/ResetStatsButton.tsx（offline 清空语义）、components/ResultNavigator.tsx

---

## §0 证据（全部 measured）

1. **W-F 根因（时序竞态，file:line 实证）**：`lib/store.ts:246-251` 在 online 分支胜局时**先** `set({ phase: 'won', ... })`，**再** `await apiRecordOutcome(...)`（`lib/store.ts:271`，内部 `postOutcome` 8s AbortController）——phase 落定时刻 ≠ 记局落库时刻。`components/ResultNavigator.tsx:71-87` 的 effect 监听 phase，见到 `won`/`drawn` 同 tick `router.push('/result?room=...')`（:86）。`/result` 是 RSC `force-dynamic`（`app/result/page.tsx:11`），服务端在收到请求时 `loadRecordByRoom` 直读 DB（:104）——此刻本次对局的 UPSERT 尚未落库 → 渲染旧行。用户手动刷新一次 → 写已落 → 新数据。与主公症状逐字吻合。生产 Turso HTTP 往返放大了窗口（本地 sqlite 毫秒级，偶发可见）。
2. **W-R 现状**：`components/ResetStatsButton.tsx` 仅 `scope='local'`（offline localStorage 清空）；`scope='server'` 分支在 solo 时代随 `/api/stats` 链退役（注释 :15-20 在案）。现役 per-room 服务端账本（`game_stats.room TEXT UNIQUE`）**零清空通道**——`lib/db.ts` 函数清单（load/upsert/merge/recordOutcome/ensure/registerOrLogin/accumulate）无任何 reset/delete。
3. **端点家族模板**：`app/api/rooms/[room]/stats/outcomes/route.ts` = normalizeRoom → service 具名结果 → problemResponse 映射，新端点照此家族风格。
4. **测试基建**：vitest + @testing-library/react（`components/ResultNavigator.test.tsx` 已存在，直接补 ordering 断言）；QA 探针 hermetic `:3101`（`tests/qa/lib/browser.mjs` 导出 `BASE_URL`，禁硬编码 :3000，必须对生产构建跑）；`lib/db.ts:129` 已有 `DATABASE_URL_SLOW_DELAY_MS` 延迟 seam 可放大 DB 路径。
5. **术语**：CONTEXT.md 同步族现有四具名操作（进入房间 / 合并 / 记局 / 刷新）——「清空」是新动词，本波入表（D-5）。

## §1 W-R 波设计（房间战绩清空）

**D-1 清空语义 = 清零保留房间身份**：service 新函数 `resetRecordByRoom(room)`：`loadRecordByRoom` 命中 → `upsertRecordByRoom(room, emptyStats())` → 返回 `{ ok: true, stats: 全零行 }`；缺失 → `{ ok: false, reason: 'not-found' }`（防静默建档，与 recordOutcomeForRoom 同款具名结果）。**否决 DELETE 行**：room 行是身份（UNIQUE，registerOrLoginRoom 幂等进入依赖它），DELETE 后下一局 `recordOutcomeForRoom` 必 404、记账闭环断裂；「清空战绩」语义是清计数，不是销户。与 offline `resetOfflineStats`（清 key）的表面不对称须在 service 注释说明。

**D-2 端点 = `POST /api/rooms/[room]/stats/reset`**（动作端点，与 merge/outcomes 家族一致；否决 `DELETE /api/rooms/{room}/stats` 资源动词——会误读成「删除房间」）。无请求 body。映射：200 `{ stats: GameStats }`（全零行）/ 404 `stats-not-found`（problem+json，防静默建档）/ 422 `invalid-room-name` / 500 `db-unavailable`。`runtime = 'nodejs'` + `dynamic = 'force-dynamic'`。slug 全部复用现役 `lib/api-problem.ts`，零新增 slug。

**D-3 UI 落点 = /result 页（战绩主场）**，仅分支 3（`stats !== null`）挂载——分支 2（row absent）无可清之物不挂，loadError 与 fallback 不挂。新 client 岛 `components/ResetRoomStatsButton.tsx`：props `{ room: string }`（RSC 从 searchParams normalize 后传入——SSR 零 localStorage 读）。点击 → 原生 `<dialog>` 确认（同源 RoomGateDialog 模式：主/次 CTA、ESC 关、reduced-motion、`requestAnimationFrame` 初焦落主 CTA——F3 fix 模式）→ 确认后 `postResetRoomStats(room)` → 成功 `router.refresh()`（AGENTS 反模式：网络写返回 Promise，调用方 await 后 refresh；RSC force-dynamic 直读 DB，refresh 即见全零）；404 → 就地错误「房间不存在，无法清空。」；aborted / network-error / 其他 → 就地错误「清空失败，请稍后再试。」，弹框保持打开。否决「/online 页也放」：战绩展示主场是 /result，/online 保持对局页面纯净；未来需要时另开波。

**D-4 文案逐字冻结**（本波唯一新增用户可见文案）：
- 按钮：`清空战绩`（aria-label：`清空房间战绩`）
- dialog 标题：`清空房间战绩？`
- dialog 正文：`该房间的全部战绩将被清零，此操作不可撤销。`
- 主 CTA：`清空`；次 CTA：`取消`
- 404 错误：`房间不存在，无法清空。`；通用错误：`清空失败，请稍后再试。`

**testid 契约**：`reset-room-stats`（触发按钮）/ `reset-room-dialog`（dialog）/ `reset-room-confirm`（主 CTA）/ `reset-room-cancel`（次 CTA）/ `reset-room-error`（错误行，条件渲染）。

**D-5 术语入表**：CONTEXT.md 同步族新增第五操作**清空（reset-room-stats）**：`POST /api/rooms/{room}/stats/reset`；服务端清零保留身份，row 缺失 404。`_Avoid_`：「删除房间」「清空房间」（删的是计数不是身份）。Relationships 补「清空 只作用于 服务端战绩，身份行保留」。加入现役 Language 区（非 Pending）——本波即真实复用。

**W-R 测试面**：
- service：`resetRecordByRoom` 命中清零 upsert / 缺失 not-found / **清零后可继续 recordOutcome（身份保留的闭环断言）** / 清零含 currentStreak 全字段。
- API：`tests/api/` 新文件（或就近文件扩展）：200 全零 / 404 stats-not-found / 422 invalid-room-name / 空 body 200（端点无 body 契约）。
- game-net：`postResetRoomStats` 补 `tests/lib-game-net.test.ts`。
- 组件：`components/ResetRoomStatsButton.test.tsx`（确认流成功 refresh / 取消零网络 / 404 就地错误 / ESC 关）。
- QA 探针 `tests/qa/room-reset-qa.mjs`：产线构建 hermetic 库——进入房间 → 直接 POST outcomes 造战绩 → /result?room= → StatsGrid 非零 → 点清空 → 确认 → StatsGrid 全零 + 零 reload；负对照：未知房间 API 直调 reset → 404 problem+json。

## §2 W-F 波设计（/result 首屏新鲜度）

**D-6 store seam**：`lib/store.ts` module-level `let pendingOutcomeWrite: Promise<unknown> | null = null`。online 分支两处 `apiRecordOutcome` 调用把返回 promise 记入（落定后清 null，成败皆清）。新 action **`awaitOutcomeWrite(): Promise<void>`**：pending 存在则 await（**吞错**——写失败也落定，导航不被写失败卡死，/result 显示当时真实状态，与现行为零回退）；无 pending 即时 resolve。offline / anonymous-online 路径零 pending 零行为变化。

**D-7 ResultNavigator await 后 push**：effect 内在 push 前调 `awaitOutcomeWrite()`；**哨兵写入移到 await 之后、push 之前**（「哨兵+push 紧邻原子」语义更准；仅 won 写、平局不写的 D-2/W-A 契约零回退）。effect 异步化的卸载竞态由执行席给 guard 方案（teach-back 提案后实施），红线：卸载后不得 push。anonymous online（无 pending）即时 resolve → push 行为与今日一致。

**W-F 测试面**：
- `components/ResultNavigator.test.tsx` 补 ordering 断言：mock/拦截 outcome 写——**写未落定不 push；落定后 push；写 reject 仍 push**；won 哨兵写入时刻在 await 后（既有 N11-N15 全保持绿）。
- `tests/store/` 补 `awaitOutcomeWrite`：有 pending await 到落定 / 无 pending 即时 / 吞错不抛。
- QA 探针 `tests/qa/result-fresh-qa.mjs`：产线构建 hermetic 库——进入房间 → /online → 0,3,1,4,2 胜局 → 断言**自动导航到达的 /result 首帧** `result-stats` 内总局数 = 1（零手动 reload）；对照 `GET /api/rooms/{room}/stats` 服务端值 = 1。平局路径：到达后 draws = 1（可并入同探针）。
- 已知边界（写入探针头注释）：本地 sqlite 下无 seam 时竞态窗口毫秒级，ordering 契约的**确定性**验证归 vitest（D-6/D-7 单元断言），探针验证 E2E 全链路不回归。

## §3 决策记录

| # | 决策 | 状态 |
|---|------|------|
| D-1 | 清空 = 清零保留房间身份（upsert emptyStats）；否决 DELETE（身份行删除破坏记账闭环） | ✅ 拍板 |
| D-2 | 端点 = POST /api/rooms/[room]/stats/reset 动作端点；否决 DELETE 资源动词；零新增 problem slug | ✅ 拍板 |
| D-3 | UI 落点 = /result 分支 3 专属；否决 /online 页放置；SSR 零 localStorage 读（room 由 RSC prop 传入） | ✅ 拍板 |
| D-4 | 文案逐字冻结（§1 D-4 表）；原生 dialog 确认（否决一步直清——服务端账本跨设备共享，破坏性需确认） | ✅ 拍板 |
| D-5 | 「清空（reset-room-stats）」入 CONTEXT.md 同步族第五操作（现役区） | ✅ 拍板 |
| D-6 | store seam = pendingOutcomeWrite + awaitOutcomeWrite()（吞错落定） | ✅ 拍板 |
| D-7 | Navigator await 后 push；哨兵写入随 await 后移；卸载竞态 guard 由执行席 teach-back 提案 | ✅ 拍板（机制待默许） |
| D-8 | 确定性 ordering 验证归 vitest；QA 探针验 E2E 不回归（本地 sqlite 竞态窗口毫秒级不做 flaky 断言） | ✅ 拍板 |

## §4 派发与验收（调度者协议）

- 席 A（W-R，omp）：worktree `../ttt-wr1`，分支 `ulw/online-reset`，QA 端口 :3111。文件白名单：lib/db.ts、app/api/rooms/[room]/stats/reset/route.ts（新）、lib/game-net.ts、components/ResetRoomStatsButton.tsx（新）、app/result/page.tsx、CONTEXT.md、tests/db|api|lib-game-net|components 对应测试、tests/qa/room-reset-qa.mjs（新）。
- 席 B（W-F，omp）：worktree `../ttt-wr2`，分支 `ulw/result-fresh`，QA 端口 :3112。文件白名单：lib/store.ts、components/ResultNavigator.tsx、tests/store 对应测试、components/ResultNavigator.test.tsx、tests/qa/result-fresh-qa.mjs（新）。
- 两席文件集零交集，可真并行；同 worktree 同时只允许一个 agent 写入。
- 每席交付一个 commit（席 A `feat(result)`、席 B `fix(result-nav)`），Conventional + 中文正文 WHAT/WHY/HOW + 全套 lore trailer + `Plan: .omo/plans/ulw-online-reset-and-result-fresh.md` 页脚；六层门禁自跑全绿后才算交付。
- 合入序：席 B 先（小），席 A 随后；各席 `git -C <wt> rebase dev` → 主 worktree `git merge --ff-only`，dev 保持线性。
- 验证席（fresh-context 对抗性，auditor.acceptance 角色，不读执行席自报）：`--detach` 于合入后 dev HEAD 独立 worktree，复跑六层 + 逐条对 F 断言清单（探针 + API 负对照 + ordering 单测），产出 PASS/FAIL 报告。
- 收尾（调度者亲做）：AGENTS.md / components digest 行 sync、docs(review) 终验入档、`.omo/sessions.local.md` capture。

## §5 红线（两席共有）

1. 首页零 API（A1）不回退；`/offline` 全程 `/api/*` = 0 不回退。
2. 防静默建档契约不回退：reset 缺行必 404，不 upsert 复活。
3. W-A 哨兵契约（仅 won 写、读后即清、刷新不重放）不回退；`ResultCelebration` 零改动。
4. service 层零 HTTP 上下文；transport 只做映射（AGENTS §本项目反模式）。
5. 术语：产出物用 CONTEXT.md 表内词，禁 `_Avoid_` 别名；用户可见文案零「玩家名 / 注册 / 登录 / 删除房间」。
6. 设计令牌样式（Tailwind token class），零内联 hex；稳定 data-testid。
7. 禁 `--no-verify`；禁 `git add . / -A`。
