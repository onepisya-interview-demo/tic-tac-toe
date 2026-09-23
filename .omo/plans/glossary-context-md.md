# glossary · 仓库术语库（CONTEXT.md 统一语言）

- **日期**：2026-09-19（同日二稿：按仓库现状调研修正陈旧术语 + 测试窗口执行约束）
- **状态**：APPROVED-PARTIAL（主公 2026-09-19 谕「词汇表写好之后，下一次测试反馈的更新直接用上」→ W1 授权于测试反馈窗口内执行；W2 之 build 步按「构建冻结反模式」避让 :3000，vitest/typecheck/lint/audit 先行）
- **触发**：①主公观察——精确描述系统对 AI 模型很有用，统一语言才更容易描述与对齐需求；每个项目应有自己的术语库，共识的不用说，容易出错、已经出错的要定义清楚；先调研最佳实践再写计划。②主公指示调研仓库现状后更新计划——recent wave（d07fd07 solo→offline 正名 + V7 终验收口）已使初稿词条过时，且计划文档自身在两轮编辑间出现了新旧术语混写（见 §1 活证据）。
- **基线**：dev @ 5e75ecd（d07fd07 完成 /offline /online 更名 + RESTful 四端点 + 组件/key 全链正名；b005fac V7 终验入档；.gitignore / next-env.d.ts 本地未提交改动与本计划无关）
- **外部输入**：dictionary-of-ai-coding 已浅 pull 至最新（251fec7）

---

## 0. 调研结论（一圈外部最佳实践）

| 来源 | 核心启示 |
|---|---|
| [Matt Pocock · mattpocock/skills](https://github.com/mattpocock/skills)（CONTEXT-FORMAT.md + 仓内活的 CONTEXT.md + internal/domain.md） | 格式：`**术语**:\n一两句定义\n_Avoid_: 别名`；分区 Language / Relationships / **Flagged ambiguities**（记录歧义裁决史）；只收本项目特有概念；消费契约——「产出物必须用词汇表的词，禁止漂移到 Avoid 列表的同义词；概念不在表里 = 信号：要么你在造项目没用的词（收回），要么是真缺口（补录）」 |
| [Dennis Traub · Your agent keeps using that word](https://dev.to/aws/your-agent-keeps-using-that-word--4g36) | Agent 是歧义放大器：误解无摩擦（代码能编译、测试能过，语义错配拖到下游才爆）；每次会话都是新员工入职，无跨会话消歧记忆；词汇表放 agent 必读文件；随使用演化，无需一次写全；API/工具命名本身就是词汇决策 |
| [Open Practice Library · Ubiquitous Language](https://openpracticelibrary.com/practice/ubiquitous-language/) | 产出物 = 术语表；托管在 git 仓库（可追踪、可评审）；持续迭代，不是一次性文档 |
| [Martin Fowler · Ubiquitous Language](https://martinfowler.com/bliki/UbiquitousLanguage.html) | 语言以领域模型为骨架；软件对歧义的容忍度低，所以用词要严谨 |
| 本地 `ubiquitous-language` skill | 定义一句话说清「是什么」而非「做什么」；同概念多词时必须 opinionated 择一，其余列别名禁用 |
| dictionary-of-ai-coding（本地浅 pull） | 条目格式范本：定义 → 机制 → `_Avoid:_` → `_Usage:_` 对话；条目互链不复制内容（context pointer） |
| [schema.org](https://schema.org/)（[GitHub](https://github.com/schemaorg/schemaorg)） | 工业级互联网词汇表，四条可借鉴机制见下方 §0.1 |

### §0.1 schema.org 专项调研（词条结构 + 治理机制）

**词条页信息架构**（以 [Person](https://schema.org/Person) 为准）：一句话定义 → 层级面包屑（Thing > Person）→ 自有属性与**继承属性**分列 → 属性间 `supersedes` / inverse 关系标注 → 与外部词汇的等价映射（`foaf:Person`）→ 使用规模统计（10M+ 域名）→ 来源致谢（IPTC rNews）→ **15 个编号使用示例**（每例 HTML/Microdata/RDFa/JSON-LD 四格式）→ 页脚版本号 + 日期（V30.1, 2026-09-16）。

**治理机制**（[extension 文档](https://raw.githubusercontent.com/schemaorg/schemaorg/main/docs/extension.html)）：

1. **Core + Pending + External 三层**：新增词条主要走 **Pending 渠道**——experimental 标注、明确「尚非核心词汇」，经一段时间观察（使用情况、采纳程度、社区讨论）后**晋升入 core 或弃用删除**。
2. **退役不删除**：弃用词条进 attic（attic.schema.org），页面保留并以 `supersededBy` 标注替代词，给出迁移路径。
3. **历史教训——碎片化失败**：2011–2018 两代去中心化/托管扩展模型被简化掉，原因正是「采用者难以确认词条是否属于 schema.org」→ 反向印证我们的**单文件 CONTEXT.md**（不做 per-directory 词表碎片）。
4. **官方价值观**：「更看重有可能被消费的词汇，而不仅仅是被发布的词汇」——与主公「共识的不用说」和 Pocock 消费契约同源。

**跨来源共识四条**（本计划的设计支柱）：

1. **收录门槛高于覆盖面**：只收歧义已发生过或高风险的词，不是字典（Pocock「只收本项目特有概念」+ 主公「共识的不用说」）。
2. **_Avoid_ 与裁决记录比定义更值钱**：Ambiguity resolved 的历史是已经付过学费的精确性。
3. **要有消费契约**：没人读/没人遵守的术语表会腐烂；agent 产出必须使用表内术语。
4. **活文档、git 托管、原地修订**：随使用演化，不留陈旧条目。

---

## 1. 为什么本仓库需要（实证）

AGENTS.md 反模式区几乎每条都是术语歧义引发的事故，但精确含义埋在长叙事里，新会话每次要重新提取：

| 词 | 歧义史（2026-09-19 按当前代码核实） |
|---|---|
| 「同步」 | 一词多义：注册/登录（`POST /api/sessions`）≠ 合并（`POST /api/players/[name]/stats/merge`）≠ 记局（`POST .../stats/outcomes`）≠ 刷新（`GET /api/players/[name]/stats`）；PUT 与 `/api/stats`、`/api/solo-stats`、`/api/player-session`、`/api/offline-stats` 旧链已整体退役。每个新会话需重新对齐 |
| 「哨兵」 | 双 key 语义不同：`ttt.offline.last-merged-local.v1`（基线模型，存合并后本机零位）vs `ttt.offline.sync-declined.v1`（sessionStorage 会话级防重弹）；V4 MINOR-F1 事故即哨兵语义未定义清 |
| 「战绩」 | 三处不同物：本地战绩（`ttt.offline.stats.v1`）/ 服务端 row（`game_stats`，`name TEXT UNIQUE`）/ 线上卡组件 state（`OnlineStatsCard`，A2 红线禁止写持久层与 store） |

Agent 是 stateless 的（Pocock 词典原话：每次会话都是新员工）——这些精确性必须写进 environment 才能跨会话存活。

**活证据（本计划自身即案例）**：初稿的「同步」词条沿用 solo 时代旧端点；二稿调研核实后部分修正，但一次并行编辑中 key 名已更新而端点仍指向已退役路径（`/api/offline-stats/sync`）——**同一个文档、同一轮修订内，不同字段漂移到了不同时代**。术语漂移连正在写术语表的人都会中招，跨会话只会更甚。此案例入 Flagged ambiguities。

---

## 2. 设计决策

### D1 文件名与位置：根目录 `CONTEXT.md`（推荐）

两个候选：

- **CONTEXT.md**：Pocock 生态标准名。本机已装 `grilling` / `grill-with-docs` / `domain-modeling` 技能，它们按约定读写根目录 CONTEXT.md、消费其词汇——命名即免费获得互操作，且未来 `/grill-with-docs` 增补词条不会另起第二个词表。
- GLOSSARY.md：自描述更好，但与已装技能生态脱钩。

**取 CONTEXT.md**。根目录与 DESIGN.md（视觉契约）并列成对：**DESIGN.md 管视觉契约，CONTEXT.md 管语言契约**。

### D2 格式：Pocock CONTEXT-FORMAT + 本仓库 Router 哲学

```md
# tic-tac-toe · Context

（一两句：本仓库的语言契约，消费规则见 AGENTS.md）

## Language

### 同步族（按操作拆分——最高危词条）

**注册/登录**：
POST /api/sessions，body `{ name }`；幂等，返回 `{stats, existed}`（200 / 422 problem+json）。
_Avoid_: 把它叫「同步」（与合并混淆）；/api/player-session（已退役）

**合并（merge）**：
POST /api/players/{name}/stats/merge，body `{stats}`；用户主动确认后服务端 per-field 累加，row 不存在返 409 player-session-required。
_Avoid_: PUT（已退役）、「上传」、「同步」裸用

（……）

## Relationships

- **注册/登录** 是 **合并** 的前置（409 契约）；「合并并清空」= 注册/登录 → 合并 → 清本地 + 写合并基线哨兵
- （……）

## Flagged ambiguities

- 「哨兵」曾指两种语义不同的 key（V4 MINOR-F1）：旧 `ttt.solo.server.synced.v1` 存服务端绝对 total（@deprecated 不迁移），已裁决为 `ttt.offline.last-merged-local.v1` 基线模型。来源：.omo/plans/ulw-name-login-one-truth.md
- （……）
```

规则：定义一两句、说「是什么」；代码符号/ key 名保留英文、定义用中文；**每条带真源指针**（代码位置或 plan/docs 文件），术语表只做「命名与裁决层」，细节不复制——符合 AGENTS.md Router 形态，杜绝第二真相源。

三条从 schema.org 借来的机制（已折入上述格式）：

1. **`## Pending` 草案区**（schema.org pending 扩展的缩小版）：后续新词先入 Pending 并标注「草案」，在真实 commit/会话中被成功复用 ≥1 次后晋升进 Language；无人复用则降级删除。首批 13 词条不进 Pending——它们全部有已裁决的歧义史，属「既有词汇成文化」，直接进 Language。
2. **`_Superseded by:_` 退役标注**（attic + supersededBy 的缩小版）：被替代的旧词/旧 key 不从词条中删除，在原词条内标注去向（如旧哨兵 key → 新基线 key），保留迁移路径，与代码侧 `@deprecated` 同构。
3. **高危词条附一行 `_Usage:_`**：歧义发生过 ≥2 次的词（同步、哨兵、战绩）各附一行示例对话（取自 dictionary-of-ai-coding 范式）；其余词条保持定义紧凑不加。

**明确不采用**（及理由）：版本化发布（git 历史足够，13 词规模无需 V30.1 式发版）；JSON-LD 机器可读形态（无下游消费方）；外部词汇等价映射（无对应物）；per-directory 词表碎片（schema.org 自己已因此失败回退）。

### D3 收录门槛（硬约束）

一条词入选须满足至少一项：

1. **已付学费**：引发过真实 bug / review 争议 / 会话间对齐成本（须在 Flagged ambiguities 或词条内注来源 plan/commit）；
2. **跨文档高频且易混**：AGENTS.md、plans、commit 正文反复出现，且存在天然混淆对。

纯共识词（如「棋盘」「连胜」）不收。初始词条控制在 **12–16 条**。

### D4 消费契约写入 AGENTS.md（两处一行，Router 不膨胀）

- 「查找入口」表加一行：`领域术语与歧义裁决 | CONTEXT.md | 命名对齐先查此表；新词收录见其门槛`；
- 「约定」区加一条：**产出物（代码、commit 正文、plan、review）命名领域概念必须用 CONTEXT.md 的词，禁用其 _Avoid_ 别名；概念不在表中时勿造新词——先判断是否真缺口，是则按 D3 门槛补录**。

### D5 首批词条草案（16 条，2026-09-19 按当前代码逐一核实真源）

| 词 | 真源 |
|---|---|
| offline / online（御定词汇） | README「词汇语义说明」（schema.org 连接性维度）；_Supersedes_: solo / ranked（d07fd07 退役） |
| 注册/登录 | app/api/sessions/route.ts、lib/db.ts:registerOrLoginName（幂等 `{stats,existed}`） |
| 合并（merge） | app/api/players/[name]/stats/merge/route.ts、lib/db.ts:mergeRecordByName（409 player-session-required） |
| outcome（记局） | app/api/players/[name]/stats/outcomes/route.ts、lib/db.ts:recordOutcomeForName（404 stats-not-found） |
| 刷新（fetch-stats） | lib/game-net.ts:fetchPlayerStats（404 → `{stats:null}`，展示层零分支） |
| per-field 累加 | lib/db.ts:accumulateMergeStats（幂等边界：同 stats 二次 POST 双计） |
| 合并并清空 | components/SyncConfirmDialog.tsx（runMergeSequence）+ HomeDialogMount |
| 哨兵（三 key 对比：基线 / 防重弹 / @deprecated 旧 key） | lib/offline-stats.ts（`ttt.offline.*`） |
| 战绩（三种实例） | lib/game.ts:GameStats、lib/offline-stats.ts、components/OnlineStatsCard.tsx（A2 红线） |
| pure-local（纯本地） | .omo/plans/ulw-solo-pure-local-closeout.md §1、app/offline/page.tsx（零 /api/* 请求） |
| 防静默建档 | merge 409 / outcomes 404 两实现；lib/api-problem.ts:player-session-required |
| 探针 | tests/qa/lib/browser.mjs、docs/testing.md（BASE_URL :3101，对生产构建跑） |
| 六层验证门禁 / on-demand 三层 | docs/verification-gauntlet.md |
| lore trailer + Plan footer | docs/commit-policy.md |
| 反向 hydration | components/PlayerNameForm.tsx（localStorage → store；区别于 SSR 首帧安全默认值正向同步） |
| soft-nav / hard reload | store 单例跨 soft-nav 保留 vs hard reload 以 localStorage 为真相（AGENTS.md 既有 digest） |

（「设计记录先行」不再单列——它已被 lore trailer/Plan footer 词条覆盖；调度者/正交委托/teach-back 属工作流词汇，只被 .omo/plans/dispatcher-roles-retrospective.md 单点使用，未达 D3 门槛，若后续跨文档扩散再录。）

### D6 验收

1. **冷启动测试**：fresh agent session 只给 AGENTS.md + CONTEXT.md，能正确回答「本仓库『同步』有几种操作、分别打哪个端点」「两个哨兵 key 差别」——答错即词条不合格。
2. **一致性 grep**：词条中的文件/符号/key 名逐一存在（防真源指针失效）。
3. **六层门禁**：纯文档改动照跑 ① vitest ② typecheck ③ lint ④ build ⑤ commit-audit（0 violations）；无浏览器面改动 → ⑥ 探针按契约豁免（plan 内注明理由）。
4. **提交**：docs(context) 常规提交，正文 WHAT/WHY/HOW + 全套 lore trailer + `Plan: .omo/plans/glossary-context-md.md` 页脚；plan 与词条同 commit 入库（设计记录先行）。

---

## 3. 实施波次（测试反馈窗口内执行）

| Wave | 内容 | 产出 | 约束 |
|---|---|---|---|
| W1（本次执行） | 按 D2 格式写 CONTEXT.md（16 词条 + Relationships + Flagged ambiguities 回填历史裁决，每条带真源指针）；AGENTS.md 两处一行（D4） | CONTEXT.md + AGENTS.md diff | 纯文档，零运行时影响，不触碰 `.next/` |
| W2a（本次执行） | 安全验证子集：① vitest ② typecheck ③ lint ⑤ commit-audit | 命令输出留档 | 均不触碰 `.next/`，与 :3000 dev 服无争用 |
| W2b（避让窗口） | ④ build + 提交（六层全绿才准提交） | docs(context) commit | **主公测试窗口内禁跑 `pnpm build`**（构建冻结反模式）；测试结束或经独立 worktree（沿 ../ttt-wa 模式）再补 |
| W3（下一轮反馈期） | 测试反馈即 D3 采集窗口：反馈中每个源自术语歧义的 bug/争议，当场裁决并入 Flagged ambiguities / Pending | 词条增量 | 消费契约首次实战：反馈-修复-入册闭环 |

D6 验收不变；⑥ 浏览器探针按契约豁免（无浏览器面改动）。

## 4. 风险与反模式

- **词典膨胀**：D3 门槛是硬约束；每条新词入册须在 commit body 说明触发的歧义事件。
- **与 AGENTS.md 漂移**：术语表是命名/裁决层，真源永远指向代码与 plan；AGENTS.md 相应 digest 修订时须同步检查词条（列入未来 schema/API 波的 checklist）。
- **写完即死**：消费契约（D4）是防腐剂；`grill-with-docs` 后续增补走同一门槛。

## 5. Sources

- [mattpocock/skills · CONTEXT-FORMAT.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/domain-modeling/CONTEXT-FORMAT.md) 及仓内活的 [CONTEXT.md](https://github.com/mattpocock/skills/blob/main/CONTEXT.md)
- [Dennis Traub · Your agent keeps using that word](https://dev.to/aws/your-agent-keeps-using-that-word--4g36)
- [Open Practice Library · Ubiquitous Language](https://openpracticelibrary.com/practice/ubiquitous-language/)
- [Martin Fowler · UbiquitousLanguage](https://martinfowler.com/bliki/UbiquitousLanguage.html)
- [schema.org](https://schema.org/) · [词条结构样例 Person](https://schema.org/Person) · [extension/pending 治理文档](https://raw.githubusercontent.com/schemaorg/schemaorg/main/docs/extension.html) · [GitHub](https://github.com/schemaorg/schemaorg)
- dictionary-of-ai-coding（本地 /Users/onepisya/github-knowledge/dictionary-of-ai-coding，已浅 pull 最新）
