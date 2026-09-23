# Plan: ulw-offline-ledger-direct —— /offline 账本直显（「匿名」态退役）

- **日期**：2026-09-20
- **分支**：dev
- **状态**：已拍板（2026-09-20 维护者「执行计划」）；D-2b 未翻案，默认否生效——**不加提示行**
- **修订**：v2（2026-09-20）——融入 pstack 工作流映射（§7：哪些条目落在哪、哪些明确不用）
- **Supersedes**：.omo/plans/ulw-offline-anonymous-ledger.md 的 D-4 / F8（卡片文案反转路线整条废弃，由本计划「删态直显」取代）
- **前置阅读**：.omo/plans/ulw-offline-anonymous-ledger.md（W4，记账语义修复）、CONTEXT.md（语言契约）

---

## §0 背景与根因（全部 measured）

1. **维护者否决（2026-09-20）**：挂载 `/offline`（无名）看到 `offline-stats-anonymous` 卡「本机匿名记账中……」——裁决：**怎么又搞出来了匿名记账？直接展示出来就行了。不要弄我没有说的东西。**
2. **根因（代码行）**：`components/OfflineStatsPanel.tsx:47,68-80` —— `isAnonymous = !roomName` 三元分支：**无名时 StatsGrid（账本本体）根本不渲染**，被一张「关于记账的说明卡」替换。W4 只反转了卡片文案（D-4），记账语义修对了（后台确实在记），但「无名 = 特殊展示态」这个 UI 结构原样保留——说明卡 + 隐藏账本，就是维护者看到的「又搞出来匿名记账」。
3. **溯源**：无名特殊态来自 ulw-name-login-one-truth G1（当时语义「无名不记」，卡片显形该语义）；7765b3f 立守卫；W4 摘守卫改记帐但留卡。卡片结构两次迭代均未质疑——**症状修了两次，根因（存在一个不该存在的 UI 态）一直没动**。
4. **流程根因（为什么总是画蛇添足）**：「匿名记账」从未入 CONTEXT.md Language 区——它是 UI 文案里长出来的**未入册概念**，违反语言契约第一条「概念不在表中勿造新词」。且 W4 D-4 授权「精确措辞执行席定」= 文案越权，未经维护者逐字审核。本计划同时修正这两点（§4 词汇表 + §6 文案送审纪律）。

## §1 语义对齐（拉齐表——维护者核对用）

| 时代 | 记账 | /offline 无名时展示 | 出处 |
|------|------|--------------------|------|
| 7765b3f ~ W4 前 | 无名**不记** | 匿名卡「无名不记」语义 | ulw-name-login-one-truth G1 |
| W4 现状（dev） | 无名**也记**（本机） | 匿名卡「本机匿名记账中」，**账本被藏** | ulw-offline-anonymous-ledger D-4 |
| **本计划** | 无名**也记**（不变） | **StatsGrid 直显，无名有名渲染完全一致**，零说明卡 | 维护者 2026-09-20 裁决 |

一句话对齐：**/offline 的账本没有「模式」——它就是一张永远直接展示的本机账本。** 房间名只影响一件事：回首页时弹框问是否把本机账本并入云端房间（HomeDialogMount，既有行为，零改动）。

## §2 变更设计

| # | 变更 | 实现 |
|---|------|------|
| C-1 | 删匿名分支 | `OfflineStatsPanel.tsx`：删 `isAnonymous`、删三元、删匿名卡 JSX；`<StatsGrid stats={stats}/>` 无条件渲染。组件零 roomName 依赖（`useGameStore((s)=>s.roomName)` 一并删除——组件不再订阅 store 名字字段） |
| C-2 | 退役 testid | `offline-stats-anonymous` 从代码与 testid 契约清单删除；`offline-stats` / `offline-stats-heading` / `stat-value` / `reset-offline-stats` 不变 |
| C-3 | 注释修正 | `app/offline/page.tsx:43`「OfflineStatsPanel 文案已房间化（未建房间不记）」——过时且语义错误，改为「账本无条件直显，无名有名一致」 |
| C-4 | 单测翻转 | `OfflineStatsPanel.test.tsx`：SSR 用例与挂载用例改断言「无名 → StatsGrid 在 + `offline-stats-anonymous` 零命中」；原匿名卡文案红线用例（零「玩家名/注册/登录」）翻转为对整个面板断言。断言一律走 RTL screen 查询 + 字面期望值（test-behavior-not-implementation：淘汰 `html.toContain('data-testid=…')` 字符串式断言——若所有被导入函数返回 undefined 测试仍会过，它就没在测行为） |
| C-5 | QA 探针 | **预期零断言改动**（全 tests/qa 对 `offline-stats-anonymous` 零命中——Explore 席 grep 实测，blast-radius 阶梯第 2-3 级「指到行 + 走查」）；回归跑 offline-qa / offline-mode-qa / one-identity-qa / offline-result-qa 全绿，实弹 DOM 冒烟把安全事实补到第 5 级「运行中的应用复现」 |
| C-6 | 文档对齐 | components/AGENTS.md:18,29；主 AGENTS.md:63,110,116（「无名不记语义」字样早已过时，一并修正）——见 §4 |

### 用户可见文案送审表（逐字）

| 动作 | 文案（逐字） |
|------|-------------|
| **删除** | 「本机匿名记账中」 |
| **删除** | 「当前对局会先记在本机账本里。回到首页给本机账本起一个房间名，可把这部分战绩并入云端房间账本。」 |
| **新增** | **无。** 零新增文案（维护者：「直接展示出来就行了。不要弄我没有说的东西。」） |

**决策点 D-2b（维护者拍板，默认值=否）**：无名时是否在 StatsGrid 下方保留一行「回首页可并入云端房间」类提示？**执行席推荐：否**——同步入口首页弹框已覆盖，/offline 加提示是又一次画蛇添足（信噪比 + 功能蔓延）。维护者审核时勾掉即可。

### 设计法则依据（52-design-principles，已读原文）

- **奥卡姆剃刀**：同样的功能（记账+展示），删掉「匿名态」这个不必要实体；
- **心智模型**：「我玩过的都记着呢」——账本就该直接是账本，不需要先被自我介绍一遍；
- **信噪比 / 多功能代价**：说明卡对「看战绩」这个主要目的是噪音；未要求的 upsell 提示即功能蔓延。

## §3 分支闭环表（单测 + 实弹）

| ID | 分支 | 断言 |
|----|------|------|
| F1 | 无名挂载 /offline stats 视图 | StatsGrid 可见；`offline-stats-anonymous` 0 命中；数字 = localStorage 账本 |
| F2 | 有名挂载 | 与 F1 渲染**逐字节一致**（仅数据不同） |
| F3 | 无名 offline 打完一局回 stats 视图 | 账本增长直显（W4 语义不变，纯回归） |
| F4 | 全程网络 | `/api/*` 请求数 = 0（pure-local 红线回归） |
| F5 | 文案红线 | /offline 用户可见字符串零「匿名」「玩家名」「注册」「登录」 |

## §4 词汇表修订（CONTEXT.md 逐字草案，送审）

1. **pure-local 词条**追加一句：
   > 「/offline 战绩无条件直显（StatsGrid），无名与有名渲染一致——无『匿名态』UI 概念（2026-09-20 裁决，`.omo/plans/ulw-offline-ledger-direct.md` §1）。」
2. **Flagged ambiguities** 追加一条：
   > 「**『本机匿名记账中』卡片退役（2026-09-20）**：offline 无『匿名』UI 态——账本无条件直显；『匿名』从用户可见文案退役，仅存工程语境（防静默建档的『匿名点击路径』）。`offline-stats-anonymous` testid 随卡片退役。来源：`.omo/plans/ulw-offline-ledger-direct.md` §0。」
3. **不新增 Language 词条**——「匿名记账」被退役而非收录，勿晋升。

AGENTS.md 修订（行级）：

| 文件:行 | 现文（摘要） | 改为 |
|---------|-------------|------|
| AGENTS.md:63 | 「`offline-stats-anonymous` 卡片显形无名不记语义」 | 「StatsGrid 无条件直显（无名有名一致，2026-09-20 匿名卡退役）」 |
| AGENTS.md:110 | 「三元 if……`offline-stats-anonymous` 卡片显形无名不记语义」 | 保留「零 GET 零网络是硬约束」，删三元与卡片描述 |
| AGENTS.md:116 | 「+ 无名时的 `offline-stats-anonymous` 提示卡（isAnonymous 读 store.roomName）」 | 「StatsGrid 无条件渲染；组件零 roomName 依赖」 |
| components/AGENTS.md:18 | 「无名时显 offline-stats-anonymous 提示卡；isAnonymous 读 store.roomName」 | 「StatsGrid 无条件直显，无名有名一致；零网络」 |
| components/AGENTS.md:29 | testid 清单含 offline-stats-anonymous | 删该项 |

## §5 验收标准（AC）

| AC | 内容 | 验证 |
|----|------|------|
| A1 | §3 F1-F5 单测 + 实弹全绿 | vitest + :31xx hermetic 端口 DOM 冒烟 |
| A2 | QA 探针零断言改动且回归全绿（offline-qa / offline-mode-qa / one-identity-qa / offline-result-qa / home-return-qa） | tests/qa/*.mjs |
| A3 | 六层门禁绿；build 在独立 worktree（构建冻结反模式） | 每 commit |
| A4 | 词汇表修订按 §4 逐字落地；全仓用户可见文案零「匿名」 | grep + 维护者抽查 |
| A5 | 文案送审表（§2）是最终文案——执行席零自由发挥 | diff 审计 |
| A6 | 验收产物可重跑：DOM 冒烟脚本 + before/after 证据落 `.omx/evidence/ulw/ulw-offline-ledger-direct/`（before = 维护者 2026-09-20 贴的匿名卡 DOM；after = StatsGrid 直显 + testid 零命中 + `/api/*` 零请求）；V10 报告每条结论带 measured/inferred/guess 标签 | 审查者可重跑产物，不信任话 |

## §6 执行协议

1. **执行席**：fresh codex（herdr tab，勿 split pane），独立 worktree 基于 dev 最新。改动面：`components/OfflineStatsPanel.tsx` + `OfflineStatsPanel.test.tsx` + `app/offline/page.tsx`（仅注释）+ §4 文档五行。teach-back 后动手。
2. **单元排序（sequence-verifiable-units，适配六层门禁）**：unit 1 = 测试翻转 + 组件删态 + 注释修正（一个 commit——门禁禁红 commit，故红→绿在席内 TDD 循环完成，不照搬 pstack「红测试单独 commit」的交付形态）；unit 2 = §4 文档 + CONTEXT.md 逐字修订（docs commit）。每 unit 结束时可验证（vitest 全绿 / grep 零命中 / 探针回归绿）才前进。
3. **模式普查（fix-root-causes：修模式不只修实例）**：执行席收尾 grep `isAnonymous|匿名` 全仓普查：UI 实体唯一 = 本卡；`HomeStatsEntry` 的 roomName 条件是入口链接语义（无房间则无链接目标），**非同类病，不许顺手删**。普查结果写进验收报告。
4. **文案送审纪律（流程修正，长期有效）**：凡用户可见文案增删改，计划内逐字列出 → 维护者审核 → 执行席照抄。撤回 W4 D-4 的「精确措辞执行席定」授权；执行席不得润色、不得加戏。
5. 调度者独立验收 = **信产物不信汇报**（prove-it-works Delegation 节）：只认 git diff + 自跑 DOM 冒烟脚本（A6 产物），不认执行席总结——此条是既有调度协议，此处标注 pstack 血统。合入后**轻量 V10 fresh-context 终验席**（interrogate 式对抗评审：判定者永远不是写它的人）：只验 A1-A6 + 词汇表一致性，出 `reports/review/V10.md`。
6. 本计划先经维护者审核（本文件即送审稿）；拍板后 docs(plan) 入档 commit，再派发。

## §7 pstack 工作流融入（v2：思想吸收，不照抄）

真源：`~/.hermes/memory/knowledge/pstack-notes.md`（§4 路由表）+ 本会话已读全文的原则文件（attack-the-premise / prove-it-works / test-behavior-not-implementation / fix-root-causes / sequence-verifiable-units / swarm / subtract-before-you-add）。引用纪律照搬 pstack 原规：**引用哪条原则，必须本会话真读过它的完整文件**。

| pstack 条目 | 思想一句话 | 本计划落点 |
|---|---|---|
| attack-the-premise | ≥2 个共享同一前提的修复都失败 → 别写第三个修复，先写下前提、做普查、去掉不对称 | 本计划的立项逻辑（§0.3）：前提句 =「/offline 存在『无名特殊展示态』」；普查 = Explore 席 grep 清点（1 渲染点 / 1 单测 / 0 探针 / 5 文档行）；处置 = 删态（去不对称），而非第三次补偿式改文案。V10 须复验执行后普查仍成立 |
| prove-it-works | 对照真实产物验证；「能编译 / 单测绿 / diff 看着合理」都不是证据；最强证明是审查者可重跑的脚本 | AC A1/A6：调度者 DOM 冒烟脚本（沿 W4 accept.mjs 模式）+ 证据目录；维护者贴的匿名卡 DOM 即 before 产物 |
| blast-radius 五级阶梯 | 别信自己的影响面分析；安全事实逐级走：说 → 指到行 → 走查 → 跑了 → 运行复现 | C-5：「探针零断言」是 grep+走查（第 2-3 级）；实弹 DOM 冒烟补到第 5 级；到不了级的结论明标 unproven |
| fix-root-causes | 修模式不只修实例（grep 同类）；需要一段注释来辩解的 workaround，说明代码本身是错的 | §6.3 收尾模式普查；本计划整体即根因修复（删态）对照 W4 症状修复（改文案）的实例 |
| test-behavior-not-implementation | 按用户方式调用 + 对字面期望值断言；imports 全返 undefined 仍会过的测试 = 没测行为 | §2 C-4 断言写法约束 |
| sequence-verifiable-units | 每单元以可验证状态结尾，红转绿才前进；不前进到坏基线上 | §6.2 两个 unit 的排序与前进门 |
| 证据标签 | 每句结论在同一句里带证据或标签（measured / inferred / guess） | 本计划全文已用；§6.5 V10 报告同规 |
| swarm 隔离 | 并行必隔离：每 worker 自有 worktree，否则 diff 变考古 | §6.1 席位 worktree 隔离（沿用既有协议） |
| subtract-before-you-add | 先删后建；为观察到的用法设计，不为投机边缘设计 | 本计划是纯删除波：零 lib/ 改动、零新增文案、零新组件——C-1~C-6 全是 subtract；D-2b 提示行按同一原则默认否 |

**明确不用（本情境裁决——什么时候不用什么）**：
- **arena / exhaust-the-design-space**：用户指令无歧义（删态直显），无竞争设计空间——不触发。
- **show-me-your-work TSV 决策日志**：4-6 文件的小波，plan + sessions 台账已覆盖审计轨迹，TSV 属过度武装。
- **benny 无人值守循环 / create-verification-skill**：非无人值守任务；仓库已有六层门禁 + tests/qa 探针体系，验证手段不缺。
- **poteto-mode 路由器机制本身**：本仓以 AGENTS.md「查找入口」+ plan 文档承担路由，不引入新机制。

## §8 Rejected alternatives

- **保留卡片只改文案**：W4 D-4 已走此路，维护者否决——卡片本身就是画蛇添足，删态不删文案是第三次修症状。
- **StatsGrid + 底部一行命名提示**（D-2b）：未要求；同步入口已有首页弹框；加即功能蔓延。默认否，维护者可翻。
- **isAnonymous 判断上移到 page**：不是删实体是搬实体，奥卡姆剃刀反面。
- **改 store/offline-stats 语义**：记账语义 W4 已对（无名也记），本计划纯展示层，零 lib/ 改动——subtract only。
- **照搬 pstack 全套流程**（TSV 日志 / arena / 红测试单独 commit 等）：见 §7 不用清单——按设计投入分级（pstack notes §4.2）本计划属小变更，投入止于「实现 + interrogate 式 V10」，全套流程是给大变更的。
