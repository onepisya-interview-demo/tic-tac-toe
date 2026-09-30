# ulw-rooms-race-map-20260924 — rooms-race 补齐 + 并发写姿态 + 方法学落地

> **标签**：wayfinder:map（本地 markdown tracker 形态）。**本图是 wayfinder 试点第一张**（主公 09-24 裁决：以本次任务为案例）。
> 纪律：每 session 只解一张票（Session 单一事则）；派发前过正交性矩阵（[research-session-orthogonality](../research-session-orthogonality-20260924.md) §一，右上格**仅对抗性评审强制 fresh**）；执行席 = herdr fresh codex（tab 不 split，`$omo:ulw-plan` 首行）；决策属性高的票调度者亲自。
> 证据资产：[research-rooms-race-probe-20260924.md](../research-rooms-race-probe-20260924.md)（威胁矩阵 S1-S7 / 旧 14 steps 判定 / 原子性证据链 / 外部实践）。基线：v2.0.0（8310bc2）。

## Destination

三件事全部落地且互相印证：

1. `/api/rooms` 链竞态有探针守卫：`rooms-race-qa.mjs` 7 steps 全绿进 CI，`main-gate` ruleset 的 required_status_checks 同步加名；
2. 同房间并发写姿态有据可依：事务可行性实测 → 修产品或钉契约（方案 C 已否决），探针断言形态与决策一致，lib/db.ts 失实注释（如有）修正；
3. 方法学资产入仓：Session 单一事则 + 正交性矩阵落 `docs/dispatcher-playbook.md`，brief 模板加派发前三问，机械对账用例 + knip script 落地。

终点样貌：CI 全绿（含新 job）；lost-update 有结论（修了或钉了，且「单进程内串行」失实注释问题解决）；方法学在 docs 可查。

## Tickets（Session 级拆分）

### T-A 事务可行性实测（开雾票 · 调度者亲自 · Session 1）✅ 已毕业（2026-09-24）

**Question**：BEGIN IMMEDIATE 事务包装能否消除 `load → JS 累加 → upsert` 的并发窗口？file: 本地驱动与 libsql/Turso 驱动行为是否一致？

- 方法：本地模拟双并发请求（Promise.all 两个 `recordOutcomeForRoom`），分别在无事务 / 事务包装下 N 轮采样，记录丢失率；libsql 驱动同型实验（雾 F5 的事实部分）。
- 产出：实测数据 + 并发姿态推荐（A 事务 / B 乐观锁 / 修正版 C），毕业雾 F1/F2/F3。
- blocking：T-B2、T-C（立票条件）。

**实测结果**（60 轮/配置，期望终值=2；实验 `tests/db/ta-transaction-feasibility.test.ts` @ 6f19527，env 门控 `TA_RACE_EXPERIMENT=1` 可复跑；原始输出 `.omo/evidence/ta-transaction-20260924/run-20260924.txt`）：

| 配置 | 丢失轮 | 报错轮 | 终值分布 |
|---|---|---|---|
| E1 真产品码（单连接 drizzle） | **60** | 0 | 1×60 |
| E2 同连接 + 裸 BEGIN IMMEDIATE | 0 | 60 | 1×60 |
| E3 双连接无事务（多实例基线） | **60** | 0 | 1×60 |
| E4a 双连接裸 BEGIN IMMEDIATE 无 busy_timeout | 0 | 60 | 1×60 |
| E4b 双连接裸 BEGIN + busy_timeout=5000 + 重试 | 0 | 60 | 2×60 |
| E5 双连接 transaction('write') API | 0 | 60 | 1×60 |
| **E6 单连接 + 进程内互斥 + transaction API** | **0** | **0** | **2×60** |
| E7 双连接 transaction API + BUSY 一次重试 | 0 | 60 | 1×60 |

**结论**：① lost-update **坐实**——真产品码单进程双并发 100% 丢（确定性：两 load 都在任何 upsert 前），lib/db.ts「单进程内三步串行不会交错」注释被证伪；② 裸 BEGIN/COMMIT 经 `execute()` **不可用**（事务不跨 execute 存续，`cannot commit - no transaction is active`）；③ 官方 `transaction('write')` API 有真锁语义（E5 BUSY 证明）；④ **修复形态可行** = 进程内互斥（promise 链）+ transaction API（E6 零丢失零报错）；⑤ 多实例残差：失败回滚泄漏文件锁需客户端回收才解除（E7），分布式语义按 Out of scope 只记录。并发姿态推荐 **A 修正版**（互斥 + transaction API），乐观锁（schema 加列）与 README 边界（D4 已否决）排除。

### T-B1 rooms-race-qa 探针（step 2-7 + 对账用例 · fresh codex · Session 2）✅ 已落地

**Question**：不依赖并发姿态决策的 6 steps + 机械对账能否全部落地并绿？

- step 2（merge 撞 outcomes）/ 3（reset 撞 in-flight outcome）/ 4（rooms 双发幂等）/ 5（房间删除 → 404 `'not-found'` → OutcomeErrorBanner 端到端）/ 6（SW non-GET pass-through + 激活竞争，B-1/E1 直系后继）/ 7（慢 DB ordering + 终态 DOM===API，D4/旧14 直系后继）。
- 吸收 concurrent-surface-qa 骨架（getStats/deleteStats 重写为新端点；双上下文编排 + SINGLE_SIDE 分支 + driveContext 复用）；无价值部分抛弃；原文件删除入档（删前 rg 引用方——L1-31 双保险）。
- 顺带：机械对账用例（解析 ci.yml 断言被引探针存在 + 扫 tests/qa 报悬空，DISABLED 存根豁免）。
- AC：vitest 全绿 + 探针 `:3101` hermetic 绿；CI job 上线且 main-gate ruleset 同步加名；concurrent-surface-qa 无残留引用。
- blocking：T-D。与 T-E 并行（正交 + 方式同 → 可并行）。

**落地**：e148b9a / e046e96 / f327646 / e1ea4b1（探针 + 对账用例 + ci.yml rooms-race job + AGENTS.md 探针地图表同步）。ruleset 加名留待主公 push 后同步（plan 内有命令）。

### T-B2 step 1 并发断言（阻塞于 T-A/T-C 决策 · Session 3）✅ 已落地

**Question**：双设备同房间并发 outcomes 的断言形态是什么？

- ~~T-A 坐实且 T-C 修了 → 契约模式（totalGames 精确 = 实际局数）~~ ✅ **已决（2026-09-24）：契约模式**——T-A 坐实 + T-C 已立票修复，断言按「服务端 totalGames 精确 = 实际局数，无丢失无重复」写死；
- （备查）坐实但暂不修 → 诊断模式（不进 CI gate 或显式 xfail——D8 顺序纪律）；
- （备查）未坐实 → 直接契约模式。
- blocking：T-D。

**落地**：2304554（双 context 交错记局，四字段精确断言 + sum 不变式）。执行注记：该票曾被工作流脚本条件误跳（picked 字符串不含分支名 → includes 判否），由调度者直接派 fresh codex 补跑；席位 `$omo:ulw-plan` 自身审批门停机后以 approve 关键字解阻。

### T-C lost-update 产品修复（条件票 · **已立票确认** · fresh codex · Session 4）

**Question**：~~若 T-A 坐实窗口~~ → **T-A 已坐实（E1 真产品码 60/60 丢），本票正式立票**：事务包装落地 lib/db.ts 两条写路径（`recordOutcomeForRoom` / `mergeRecordByRoom`）？

- **修复形态（T-A 实测指定，D9）**：进程内互斥（promise 链，per-process 串行化三步）+ `transaction('write')` API 包裹（E6 实证零丢失零报错）；**禁用**裸 BEGIN/COMMIT 经 execute()（E2/E4 证伪）；BUSY 重试语义参照 E4b/E7 教训（重试须保证事务清理，防锁泄漏）。
- 必含：lib/db.ts:377-378「单 Node 进程内三步串行」失实注释的修正（E1 直接证伪）+ 文件头「行为契约」节同步改写（互斥后的真实串行语义）；SQL 侧纯增量已被排除（currentStreak 条件逻辑无法单条 SET 表达——见 research-rooms-race §四.4.4）。
- 验收含复跑 T-A 实验套件：修复后 E1 同型采样应零丢失（可加「修复后基线」用例进常规 vitest）。
- 立票后 blocking T-B2（契约模式断言依赖本票合入）。

**落地**：71ad38d（`withWriteLock` promise 链 `then(fn,fn)` 失败隔离 + drizzle `db.transaction()` 包裹三条写路径 recordOutcomeForRoom / mergeRecordByRoom / resetRecordByRoom + 失实注释改写）+ cddf174（d-F2 返工：两个测试 seam 正交化）+ 回归测试 tests/db/lost-update-mutex.test.ts。调度者补核：remote HTTP 部署的 `db.transaction()` 可用性——@libsql/client/web 分发至 HttpClient，其 `transaction(mode)` 真实存在（http.js:189，Hrana over HTTP），远程部署无炸点。

### T-D 对抗性交叉审（fresh codex **强制** · Session 5）✅ 已执行（REJECT → 返工闭环）

**Question**：T-B1/B2（及 T-C 若立）的实现是否守住 AC 与红线？

- 镜头划分在 T-B1 落地后定（雾 F4）——按正交性矩阵，异镜头必须隔离会话；
- 必审红线：step 1 诊断模式不得被静默转正（探针不得硬造绿）；机械对账用例本身会不会误报 DISABLED 存根。

**执行实录**：verdict=REJECT（10 findings：2 medium + 8 low，四镜头 L1 并发正确性 / L2 探针真实性 / L3 对账用例健全性 / L4 票面契约一致性）。换人复核 6 条：confirmed 4（d-F1 对账通配兜空、d-F2 seam 隐式耦合、d-F3 BR-6 dangle、d-F5 step 6 静默跳过）、refuted 1（d-F4）。2 条 medium 返工闭环（7e04985 / cddf174）；low 的收口：d-F3/d-F5 由调度者收尾修复（54045f7，且 d-F5 修复第一跑即暴露假绿实锤——POST 走 APIRequestContext 绕过页面栈，断言从未生效），d-F6 被返工顺带修掉，d-F4 驳回，d-F7/F8 之 BR-10 半边已在 BR 行标注 triage，其余记档。

### T-E 方法学落 docs（调度者 · Session 6 · 与 T-B1 并行可）✅ 已落地（ed25cb0）

**Question**：Session 单一事则 + 正交性矩阵如何落成仓库资产？

- `docs/dispatcher-playbook.md` 新节：2×2 矩阵（右上格仅对抗性评审强制 fresh——D5）+ 派发前三问（与哪席共享上下文？检查/工作方式是否异镜头？预估容量是否单会话闭环？）+ 本波复盘表；
- brief 模板常量加三问；
- T-F：package.json `qa:audit` script（knip 定期体检，手动跑不进 CI）+ docs/commands.md 一行。

### T-G 终验收口（调度者 · Session 7）✅ 本节即产物

**Question**：全链是否收口？

- 六层验收 + CI 全绿（含新 job 与 ruleset 同步）；
- 本地图 Decisions so far 收口、雾区清零或转新票；两份 research 的裁决状态回填核对；
- wayfinder 试点复盘（F6）：omo ulw 流程与地图的长期接线方式，结论回填 dispatcher-playbook。

**收口实录**（2026-09-24）：探针 7/7 PASS（:3101 hermetic，调度者亲跑含 step 1）；vitest 505 passed + 8 skipped / typecheck / lint 干净；R6 双向校验零 violation；波内红线（禁区零 diff）与票面（越界 0）全过。**地图收口：全部 7 票落地，雾区 F1-F6 全毕业，Out of scope 维持**。遗留外发动作（非本仓可闭环）：① push dev（13 commits ahead，主公执行）；② GitHub main-gate ruleset required checks 加 `rooms-race` job 名（push 后同步，命令见 T-B1 plan）。

## Decisions so far

- D1（主公 09-24）：立票范围 = 全 7 steps 一次做。
- D2（主公 09-24）：concurrent-surface-qa 改造吸收骨架，无价值部分抛弃。
- D3（主公 09-24）：对账用例随票顺带；knip 定期体检 npm script，不进 CI。
- D4（主公 09-24）：lost-update 方案 C（README 边界注）**否决**——「不是所有人都会听你的，你的用户不会听你的的。你永远不知道你的用户会如何使用你的产品。」并发写必须产品级健壮；方向收窄为事务/乐观锁，实测先行。
- D5（主公 09-24）：正交性矩阵修正——右上格「共享上下文 + 方式不同 → 必须拆」**仅限对抗性评审**（强制 fresh session 消除模型偏见与漂移）；非对抗场景不强制。
- D6（主公 09-24）：wayfinder 试点 = 本任务本身（本图即试点产物）。
- D7（主公 09-24）：T2/T3 立即融合进计划文件（Session 级拆分），正式落 docs 为执行票（T-E）。
- D8（前序既有）：探针顺序纪律——诊断在修复前，修复在转正 CI 前（research-rooms-race §五 预声明）。
- D9（T-A 实测毕业，2026-09-24）：lost-update **坐实**（E1 真产品码 60/60 丢）；并发姿态 = **进程内互斥 + transaction('write') API**（E6 实证）；裸 BEGIN/COMMIT 经 execute() 证伪排除；多实例残差（E7 锁泄漏需客户端回收）只记录事实，分布式承诺 Out of scope。T-C 据此立票、T-B2 定契约模式。

## Not yet specified（雾区——能精确陈述问题才立票，禁止预切片）——✅ 全部毕业，雾区清零

- ~~**F1** 事务在 file: 本地 vs libsql/Turso 驱动下的真实行为~~ ✅ **T-A 毕业（D9）**：file: 侧全谱实测（裸 BEGIN 证伪 / transaction API 真锁 / E6 形态可行 / E7 泄锁事实）；remote HTTP 侧调度者补核：@libsql/client/web 分发至 HttpClient，`transaction(mode)` 真实存在（http.js:189，Hrana over HTTP），事务 API 双驱动可用；真实 Turso 端到端未联网实测（无凭据），已在 lib/db.ts 注释按适用范围标注；
- ~~**F2** lost-update 坐实与否~~ ✅ **T-A 毕业**：坐实（E1/E3 60/60 丢）；T-C 已落地；
- ~~**F3** step 1 断言形态~~ ✅ **T-A/T-C 毕业**：契约模式（2304554 落地）；
- ~~**F4** 交叉审镜头划分~~ ✅ **T-D 毕业**：实录四镜头 = L1 并发正确性 / L2 探针真实性 / L3 对账用例健全性 / L4 票面契约一致性；四镜头各产 findings，无串镜头锚定；
- ~~**F5** 多实例部署形态下 libsql 写并发的真实行为~~ ✅ **T-A 毕业**：file: 双连接侧事实（E3/E5/E7：全丢 / BUSY / 锁泄漏需客户端回收）；remote 侧仅核实 API 形态未联网实测——lib/db.ts 注释已按「单进程互斥保证 + 多实例 last-write-wins 残差」标注适用范围（地图 Out of scope 维持）；
- ~~**F6** 本地图与 omo ulw 流程的长期接线方式~~ ✅ **T-G 毕业**：结论回填 dispatcher-playbook「wayfinder 试点复盘」节（2026-09-24）。

## Out of scope

- 分布式一致性强保证（多区域多写者）——作品集规模不需要；F5 只核查事实，不承诺分布式语义；
- 写路径重构为 event-sourcing / 队列化——超出「修丢失更新」的范围；
- 其余历史探针（merge-sync/sync-qa DISABLED 存根）的复活——覆盖已由 home-return-qa 承接，头注释有完备迁移记录。
