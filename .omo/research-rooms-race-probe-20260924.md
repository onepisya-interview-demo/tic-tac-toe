# 调研报告：/api/rooms 竞态探针补齐（rooms-race-probe）

> 性质：调研报告 + 票面提案，待主公审查后立票。基线 v2.0.0（merge commit 8310bc2）。
> 调研人：调度者（ZCode）。方法：本地 git 历史 / 源码取证 + llm-wiki 检索（只读）+ 外部检索（web-search-prime / ddgs@7890 / grep.searchGitHub[504 弃用]）。

---

## 一、来龙去脉（这条线是怎么走到今天的）

| 时间 | 事件 |
|---|---|
| v1.0.0 前 | 旧链时代：单行 `PUT/DELETE /api/stats`；`tests/qa/stats-race-qa.mjs`（全盛 565 行 / 14 steps）守住三类只在生产构建暴露的 bug——B-1 SW double-PUT、B-2 PlayController setTimeout 导航竞态、B-3 RSC 静态预渲染陈旧，另加 D3-D6/E1 五项约束（慢 DB ordering、跨 mount 泄漏、SW 激活竞争、跨 session 持久化、StatsGrid 订阅） |
| `7765b3f` | `/api/stats` 链退役，`/api/rooms/[room]/stats/*` 五端点接位 |
| `d07fd07` | solo/ranked 语义清退：删除 stats-race-qa.mjs，**漏删 ci.yml 的 `stats-race` job**（引用悬空 = anti-patterns L1-31） |
| 09-23 | 发版 PR #14 首次触发新 workflow，悬空 job 现形（MODULE_NOT_FOUND）；`302c123` 删孤儿 job + L1-31 入档 |
| 09-23 | 主公裁决：补齐 /api/rooms 链竞态探针，先调研（本报告）。主公威胁模型修正：**竞争只发生在多设备同房间名时，否则各自更新各自的** |

---

## 二、威胁模型 v2（主公修正后的竞争矩阵）

主公的修正是本次调研最重要的输入：房间（room）是聚合键，每房间一行，**跨房间零写冲突**。竞争面收窄为「同房间名的多写者」与「同房间内异构操作交错」：

| # | 场景 | 竞争? | 现状覆盖 |
|---|---|---|---|
| S1 | 单设备单房间正常记局（串行，await 落定后再导航） | 否 | 单测 + 既有探针已盖 |
| S2 | **两设备同房间名并发记局**（两上下文交错 `load→JS累加→upsert`） | **是——lost-update 窗口** | **零覆盖** |
| S3 | 同房间 merge（合并上传）与 outcomes 记局交错 | 是（两源合一的加法语义） | 零覆盖 |
| S4 | reset 撞 in-flight outcome（行清空/重建 vs 旧快照回写） | 是（计数复活或丢失） | 零覆盖 |
| S5 | 房间被服务端删除后 outcome → 404 `'not-found'` | 竞争之果 | reason 映射有单测；**E2E 端到端无** |
| S6 | 双击/双发 `POST /api/rooms` | 否（`registerOrLoginRoom` 幂等 + `existed` + room UNIQUE） | 值得一枚探针钉住 |
| S7 | SW 与页面（non-GET pass-through、激活竞争） | 非写竞争，回归向量 | 零覆盖（B-1/E1 直系后继） |

---

## 三、旧探针 14 steps 逐条判定

| 旧 step | 内容 | 判定 | 去向 |
|---|---|---|---|
| 01 | DELETE reset | 直系后继 | `POST reset` 语义已被 room-reset-qa 盖，不重复 |
| 02 / 12 | SW non-GET pass-through（B-1）+ POST count=1 | **仍活** | → 新票 step 6（sw.js 仍在役） |
| 03 | 事件驱动导航（B-2 回归） | **仍活** | → 新票并入（store.ts:355 await 落定契约无探针） |
| 04 / 05 / 10 | RSC 动态读库 + resetAll await（B-3a/b） | **结构性消亡** | 现全动态 ƒ 路由 + sw.js 明确不缓存 API/RSC；「DOM===API」断言保留并入新票收尾 |
| 06 | 慢 DB multi-POST ordering（D4） | **直系后继** | → 新票 step 7（慢 DB 拦截 harness 可整段抄） |
| 07 | 跨 mount 状态泄漏（D5） | 已被承接 | 单测（resetStore 单点 helper 后 498 基线） |
| 08 | 手动导航竞争（D3） | **仍活** | → 并入新票 step 3 相邻面 |
| 09 | SW 激活竞争（E1） | **仍活**（CACHE_NAME 陈旧部署清扫） | → 新票 step 6 |
| 11 | 跨 session 持久化 | 已被承接 | home-return-qa（roomName 恢复路径） |
| 13 | StatsGrid 不订阅 store（D6） | 已被承接 | 单测 + visual-qa |
| 14 | 终态 DOM===API | 值得保留 | → 新票各 step 的收尾断言 |

净结论：14 步中 4 步已消亡/承接，**6 步有活着回归向量且现在无人守**，其余并入。

---

## 四、新发现

### 4.1 写路径非原子窗口（新票的牙口，证据链）

- `lib/db.ts:288-312` `upsertStats`：**全行快照** `ON CONFLICT DO UPDATE`（传入什么写什么，非 SQL 侧累加）；
- `lib/db.ts:384-394` `recordOutcomeForRoom`：`load → 纯函数累加 → upsert`，两个 await 点；
- `lib/db.ts:355-366` `mergeRecordByRoom`：`load → accumulateMergeStats → upsert`，同样两段；
- 注释自认（lib/db.ts:377-378）：「单 Node 进程内三步串行；**多实例 last-write-wins 由 README 边界注承担**」——但**单进程内两个并发请求的 await 交叠同样丢更新**（旧 concurrent-surface-qa.mjs:98-104 注释早已承认此窗口并绕开）；
- 结论：S2「两设备同房间」= 真实 lost-update 窗口。这正是主公威胁模型里唯一的真写竞争面，且代码现状按「不保证」设计——探针要做的是**把这个边界从「没人知道」变成「被钉住的契约」**。

### 4.2 concurrent-surface-qa.mjs = 第二具僵尸

156 行探针仍在 `fetch`/`DELETE` **已退役的 `/api/stats`**（:43、:53）——不在 CI、不在 vitest 收集范围（.mjs 非 .test.*）、不被 docs 引用，三种「活体门」全部绕过。与 stats-race 是同一缺口的两种死法：一个是「文件死了引用悬空」，一个是「文件活着、被引对象死了」。**处置建议：改造吸收**——它的双上下文框架 + SINGLE_SIDE 单侧失败分支正是新票 step 1 需要的骨架。

### 4.3 方法学深挖：为什么消融实验和 remove-ai-slops 都没抓到僵尸测试

#### 4.3.1 三视图盲区模型

| 波次 | 视图 | 看什么 | 为什么看不见僵尸 |
|---|---|---|---|
| remove-ai-slops（cleaner.code，dev@373ec96 vs main，124 code files） | **内容视图** | 文件内容的 AI slop 特征（冗余注释/复制块/过度防御） | concurrent-surface-qa 长得是「正常测试文件」，无 slop 特征；它引用 `/api/stats` 在内容视角只是「调了个 API」——**镜头里没有「被引对象还活着吗」** |
| 行消融实验（ulw-ablation：物理删除 + vitest/typecheck/lint/build 四门禁看红不红） | **行为视图** | 「测试←实现」的覆盖率：删实现谁会红 | 僵尸探针**不被任何活体门禁执行**（不在 vitest glob、不在 CI、不被 import）——删任何实现它都不会红，消融对它结构性失明 |
| （缺失） | **引用/执行视图** | 「每个可执行探针 ↔ 被谁引用 ↔ 被引对象是否存在」的对账图 | 就是这张图不存在，stats-race 与 concurrent-surface 两种死法才都活到今天 |

#### 4.3.2 学理定位（外部研究证实这是成型的领域问题）

- **消融实验的学术名字是 mutation testing**（变异测试；JS 生态自动化工具为 StrykerJS）。它的定义性前提：**被评估的测试必须先进入执行集**——变异测试度量的是「测试集对代码变异体的杀伤力（kill rate）」，一个从不执行的测试对任何变异体都是零杀伤，且 mutation testing 工具**不会把「存在但未执行的测试」本身报为问题**。我们的行消融是它的手工版，盲区完全同构。
- **「僵尸测试」在学术界的正名是 obsolete test / test suite decay（测试集腐化）**，有成型研究脉络：Feldt et al.《Do System Test Cases Grow Old?》（arXiv:1310.4989）提出 **test case activation curves（TACs，测试用例激活曲线）**——用「测试随年龄的激活频度」度量测试集老化；Springer《Is This a Bug or an Obsolete Test?》（ISSRE 系）专门研究废弃测试的判定难问题。结论：我们踩的不是独家坑，是行业公认难题的一个小样本；学术界的方向（激活曲线度量）对单人作品集仓库过重，但**「测试活跃度应可度量」**这个思想可直接落地为下面的机械对账。
- **社区/TestOps 语境的命名是 "orphan test"**（孤儿测试：测试与需求/执行追踪脱钩）。检索警示：该词被 SaaS 营销内容重度污染（首条命中 reqproof.com 为产品软文，按信源白名单红旗降权，仅取其概念命名价值）；一手讨论稀少，说明**实践者常用错词搜索**（见 4.3.4 的关键词演化）。

#### 4.3.3 工具生态：解法已有现成件，无需自研重轮

| 工具 | 能力 | 对本仓的适配 |
|---|---|---|
| **knip**（knip.dev，JS/TS unused 文件/依赖/导出检测的事实标准，80+ 框架插件） | 从 entry points 出发建引用图，报 unused files | **有官方 GitHub Actions 插件**（knip.dev/reference/plugins/github-actions，解析 workflow 的 entry files/config/dependencies）。⚠️ 落地时需验证其对 `pnpm exec node tests/qa/x.mjs` 形态的识别；不识别则用 entry 配置显式声明测试目录兜底 |
| unimported / unused-file-finder（民间层） | 同类 unused 文件检测 | 备选，无 knip 的插件生态 |
| 自写对账用例（20 行 vitest） | 解析 ci.yml 断言被引探针存在 + 扫 tests/qa 断言每个探针被 gate 引用或显式 DISABLED | **零依赖、语义可完全定制**，与 L1-31 Directive 直接对齐（能探针化的约束不靠记忆） |

建议：机械对账用例（自写）为主，knip 作为锦上添花的定期体检（`pnpm dlx knip` 一次性跑，不进 CI）。

#### 4.3.4 检索关键词演化记录（方法学资产——换位思考「遇到这个问题的人会搜什么」）

| 尝试词 | 结果 | 教训 |
|---|---|---|
| "zombie tests" | 俚语，命中杂（游戏/营销） | 俚语词不是检索词 |
| "orphaned tests" | TestOps 术语，但被 SaaS 软文污染 | 概念词可用，信源需按白名单降权 |
| "test suite decay / obsolete tests empirical study" | **命中学术正脉**（TACs / ISSRE） | 学术问题用学术措辞 |
| "unused files detection github actions workflow" | **命中工具正解**（knip 及其 GA 插件） | 工具问题用「问题→检测器」措辞 |
| "detect orphaned test files not executed by CI" | 命中散（CI 数据清理等近义干扰） | 描述句不如「名词化概念 + 限定域」 |

规律：**先概念命名、再按内容/行为/执行三个视图分别选词**——搜索失败往往不是引擎不行，是用「症状描述」在搜「领域术语」。

### 4.4 外部最佳实践（带来源）

1. **SW 非 GET 透传是平台惯例**：workbox-routing 按 HTTP 方法注册路由、GET 为默认处理对象（Chrome for Developers，developer.chrome.com/docs/workbox/modules/workbox-routing）——本仓 sw.js 的「只拦 GET、非 GET pass-through」符合官方惯例，B-1 回归向量值得钉住。
2. **计数器类写冲突的标准解 = SQL 侧原子增量**：`ON CONFLICT DO UPDATE SET x = x + 1` 单语句原子；drizzle 官方 upsert 指南（orm.drizzle.team/docs/guides/upsert）+ 真实世界 view-counter 案例（drizzle + SQLite 计数器博客）均此模式。本仓的全行快照 upsert 不在此列——若 step 1 坐实丢更新，修复方向即此（或显式事务）。
3. **Playwright 双上下文**是官方多用户/多设备模拟模式（`browser.newContext()` 隔离 storage）——旧探针 harness 与 `lib/win-drive.mjs` 已是现成实现，直接复用。
4. **llm-wiki 诚实记录**：该库聚焦 AI/agent 主题，竞态/并发测试无沉淀；本次方法论输入主要来自本仓自身波次记录（ulw-ablation plan、remove-ai-slops 报告、L1-30/L1-31、retro-2026Q3）。

---

## 五、票面建议（修订版：`tests/qa/rooms-race-qa.mjs`）

| step | 场景（威胁矩阵编号） | 断言要点 |
|---|---|---|
| 1 | S2 双设备同房间真并发 outcomes（2 contexts 交错 N 局） | 服务端 totalGames 精确 = 实际局数，无丢失无重复。**⚠️ 预声明：若暴露 lost-update，属产品缺陷而非探针 bug——暴露即价值，修复方向为 SQL 侧增量或事务；先修产品再让探针进 CI，顺序不能反（否则制造 flake 门禁）** |
| 2 | S3 merge 撞 outcomes 同房间交错 | 终值 = 两源严格相加，无丢无重 |
| 3 | S4 reset 撞 in-flight outcome | 终态全零或 404→banner 可见，计数禁复活 |
| 4 | S6 双发 `POST /api/rooms` | 单行、`existed` 语义正确 |
| 5 | S5 房间删除后 outcome | 404 `'not-found'` → OutcomeErrorBanner 端到端可见（案② c 静默吞修复的 E2E 闭环） |
| 6 | S7 SW non-GET pass-through + 激活竞争（B-1/E1 直系后继） | POST 计数不变、页面资产经 SW 正常 |
| 7 | 慢 DB outcomes ordering（D4 直系后继） | ordering 保持 + 终态 DOM===API（旧 step 14 断言并入） |

**工程要点**：

- 复用 `lib/browser.mjs` / `lib/win-drive.mjs` / 旧 565 行版的慢 DB 拦截器与双上下文骨架；`:3101` hermetic 库 + 生产构建惯例（禁 dev server）；
- concurrent-surface-qa.mjs 的处置随票带走（改造吸收其骨架，原文件删除并在票内记录——L1-31 双保险：删时顺手 rg 引用方）；
- **新 job 上 CI 时同步把 check 名加进 `main-gate` ruleset 的 `required_status_checks`**（现名单 5 项与现存 job 严格对齐，别让新 job 重演「存在但不受 gate 信任」）；
- 预算：单席 fresh codex 45-90 分钟（双上下文交错编排比单上下文探针复杂）；
- 随票小票（可选）：§4.3 的引用/执行视图对账——自写 20 行 vitest 对账用例（解析 ci.yml + 扫 tests/qa 悬空）为主；`pnpm dlx knip`（含官方 GitHub Actions 插件）作为定期体检副炮。

---

## 六、主公裁决（2026-09-24）与执行去向

1. **立票范围 = 全 7 steps 一次做**。
2. **lost-update：方案 C（README 边界注）否决**——主公：「不是所有人都会听你的，你的用户不会听你的的。你永远不知道你的用户会如何使用你的产品。」并发写必须产品级健壮；方向收窄为事务/乐观锁，**事务可行性实测先行**（开雾票 T-A），探针以诊断模式先行，坐实 → 修复票 → 转正 CI（顺序纪律 D8 不变）。
3. **concurrent-surface-qa：改造吸收**——双上下文编排 + SINGLE_SIDE 单侧分支 + driveContext 骨架复用；getStats/deleteStats 重写为新端点；无改造价值的部分抛弃，原文件删除入档（删时 rg 引用方）。
4. **对账用例随 rooms-race 票顺带；knip 定期体检** = npm script（如 `pnpm qa:audit`）手动跑，不进 CI 门禁。

**执行工单（Session 级拆分 + 雾区）已融合进统一地图：[plans/ulw-rooms-race-map-20260924.md](plans/ulw-rooms-race-map-20260924.md)**（wayfinder 试点，正交性矩阵右上格修正随 D5 落地）。本文件转为地图的证据资产。
