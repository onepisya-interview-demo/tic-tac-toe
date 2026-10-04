# 规则机械化唤醒：C1–C9 裁决材料

> 性质：**裁决材料，未实施**——本文只备齐裁决素材并入册仓库，不立项不开坑不写代码；任何候选落地均须主公明令（「计划入档即停，执行须主公明令」，留档见 [ulw-homedialog-flaky-fix-20260926.md:3](plans/ulw-homedialog-flaky-fix-20260926.md)）。
> 唤醒依据：调研报告 §六唤醒条件④「主公点名『规则机械化』」（[research-rules-mechanization-20260926.md:96](research-rules-mechanization-20260926.md)），主公 2026-10-01 点名唤醒。
> 与 20260926 报告的关系：**增量材料，不重写原报告**——原报告 §五候选表、§六唤醒条件维持原文；本文在其上做三件事：候选台账现状核实（§二）、重犯证据映射（§三）、复利闭环与第一波建议（§四–§六）。
> 素材：三路取证（候选台账核实 / 重犯错误实例 / 文档资产盘点）+ 起草人本会话亲读四份底档与实跑复核。取证与亲读的分歧共三处，均已如实记录于 [§一.3](#一唤醒触发与本次范围)。
> 读完本文主公只需做两件事：对 §二逐卡批「准/驳」，对 §七逐条给裁决。

---

## 一、唤醒触发与本次范围

### 1.1 触发链（全部仓库内出处）

1. **主公总排序指令（2026-09-27，逐字）**：「所有事情都要在当前文档相关的事情处理好之后，然后执行规则机械化唤醒裁决，然后才考虑其他的事情。」——[doc-status-map-20260927.md:69-71](doc-status-map-20260927.md)；
2. **Q9 裁决原话（逐字）**：「这是文档梳理好之后要做的第一件事情。」——[doc-status-map-20260927.md:57-59](doc-status-map-20260927.md)、批注位留档同见 [alignment-20260926-doc-governance.md:94](alignment-20260926-doc-governance.md)；
3. **前置已满足**：文档相关事项已收尾（[doc-status-map-20260927.md §三.1](doc-status-map-20260927.md)「✅ 已收尾」），决策面清零（同文件 §二现状注：「决策面清零，无任何挂起动作」）；
4. **唤醒条件④满足**：主公 2026-10-01 点名（条件全文见 [research-rules-mechanization-20260926.md:96](research-rules-mechanization-20260926.md)）。

### 1.2 既定安排出处：「先评 C1；C1–C9 一并裁决」

- **「唤醒即拉 §五候选清单立票；C2 已实质兑现无需另立票；故届时实际先评 C1；C3/C4/C5 备选另票」**——[doc-status-map-20260927.md §三.2](doc-status-map-20260927.md)（:151-158）。该文件同时自注：「先评 C2+C1」系执行层安排（与 alignment 项 6 愚见 a 一致），非主公裁决原文，归因已更正入档（同节）。
- **「C1–C9 一并裁决」的出处**：C6–C9 四行系验证信任沉淀波（2026-10-01 增补）追加于 §五表末，明文「**待机械化唤醒统一裁决，未裁决不实施**」——[research-rules-mechanization-20260926.md:92](research-rules-mechanization-20260926.md) 增补注 + [research-verification-trust-20260930.md:124](research-verification-trust-20260930.md) §三表头。故本次唤醒范围 = C1–C9 九候选统一裁决，与既定安排一致。

### 1.3 核验方式与三处分歧（诚实记录）

本文全部行号与 commit 证据均经起草人本会话实跑复核（`Read` 亲读 + `git grep`/`git show`/`git rev-list`/`sed` 现场抽查 C1–C9 与重犯实例的全部载荷事实），非转录取证 JSON。与取证 JSON 的分歧三处：

1. **C8 检索方法差异（实质无冲突）**：取证 JSON 称 `zz-ttl-probe` 命中两份文档；本会话 `git grep -ln 'zz-ttl-probe'` 仅命中 1 个 tracked 文件（[research-rules-mechanization-20260926.md](research-rules-mechanization-20260926.md)）——第二处 [research-verification-trust-20260930.md:19](research-verification-trust-20260930.md) 系工作树未提交文件（untracked，`git grep` 不索引），亲读确认其 :19 确有「zz-ttl-probe 前缀造 9 条边界行」叙述。**实质结论一致：零脚本文件，全为文档叙述。**
2. **BASE_URL 探针计数补充（实质一致）**：取证称「现役 20 探针已引，未引 2 个系 DISABLED」；本会话实跑 `ls tests/qa/*.mjs | wc -l` = **23**、`grep -L BASE_URL` = 3 个——其中 merge-sync-qa / sync-qa 两枚头注 DISABLED 属实，第 3 个 `commit-audit.mjs` 系非浏览器探针（本就不需要 BASE_URL）。20/20 现役探针已引的结论成立。
3. **gauntlet Gap 6 行号**：取证写 :99，亲读该条目起于 **:96**（:99 落在条目中部），本文引用以 :96-102 为准。

另注：本文所引 L1-32/33/34、mech 报告增补注与 verification-trust 报告均处**工作树未提交状态**（HEAD reflog 实证 `6c64261`「验证信任经验沉淀」已提交后被外部 reset 回 `b8e3e0c`，diff 面与之吻合）——所引行号以工作树为准；重新入档 commit 待主公令（§七附列 f）。

## 二、候选裁决卡 C1–C9

> 每卡五要素：①现状核实（含本会话核验证据）②机制选项与强制力层级（L1 机械门禁 / L2 结构规则+人审 / L3 语义评审，分级定义见 [research-rules-mechanization-20260926.md:22-26](research-rules-mechanization-20260926.md)）③成本与 precision 风险 ④正反例测试要求 ⑤推荐（立票 / 合并进哪票 / 驳回 / 已兑现归档，四选一）。
> 推荐汇总表见文末「裁决速览」。

### C1｜anti-patterns 条目加「机械化状态」字段

**① 现状核实（事实成立）**：亲读 [docs/anti-patterns.md](../docs/anti-patterns.md) 全文 237 行（本会话 `wc -l` 实测 237，`od -c` 证末行有换行符；取证 JSON 原写「1-238」差 1 行，以实测为准）：48 个条目（L0=8、L1=19+8、L2=13，`grep -c '^### L'` 实测 48）结构均为「`### 编号：标题` + prose 正文 + 实证段」，**无任何「机械化状态」结构化字段**。候选编号仅以正文一句话内嵌于对策段：L1-32 提 C6（[:221](../docs/anti-patterns.md)）、L1-33 提 C6 邻接（[:229](../docs/anti-patterns.md)）、L1-34 提 C9（[:237](../docs/anti-patterns.md)）。「差距项散在文档无层级台账」现状未变。已晋升脚本层的先例（L1-31 → [probe-reconciliation.test.ts](../tests/qa/probe-reconciliation.test.ts)）也只能靠读代码反推，台账上无记载。

**② 机制选项与层级**：本候选本身就是**文档层台账**，是其余候选的记账入口。字段形态建议四值：`文档层 / 脚本层 / 门禁层 / 自动修层` + 一行「下一层触发条件」（样例见 §五）。不需要任何新工具——prose 字段即可；若要防字段腐化（写了不更新），可加一行「每个 ### 条目必含机械化状态行」的脚本断言（归 C9 对账测试族，票内定，非本卡前置）。

**③ 成本与 precision**：成本小（纯文档批量补字段，48 条）；precision 风险为零（不产生误报）；唯一设计决策是编号策略（§七-Q6：L1-20~26 断档〔系历史遗留、非 58cc978 追加节引入——2026-10-04 成因注〕，续号还是补齐——L1-31 等编号已被 [probe-reconciliation.test.ts:1-18](../tests/qa/probe-reconciliation.test.ts) 头注释引用，重排会破仓内引用）。

**④ 正反例测试要求**：文档字段本身无正反例测试；若采纳「字段存在性断言」，正例=48 条全有字段、反例=临时删一行 → 红。

**⑤ 推荐：立票（最先落）**——它是 §四复利闭环的通道入口件：没有字段，「这条规则升到哪层、复发几次该立规」只存在于会话记忆；有字段，任何会话读台账即知晋升管道状态。且本波其余每票落地后都要回写它，先落免二次返工。

### C2｜文档契约测试（R6 推广）

**① 现状核实（已兑现）**：本会话实读 [tests/api/maintenance-purge.test.ts:114](../tests/api/maintenance-purge.test.ts) 与 [:129](../tests/api/maintenance-purge.test.ts)，两处现场均为 `expect(purgeStaleRoomsMock).toHaveBeenCalledWith();`（POST/GET 两 case）；`git show 2d7709b` 证实 2026-09-26 T-P1 把两处 `toHaveBeenCalledWith(30)` 翻转为 `toHaveBeenCalledWith()`，即「断言 route handler 不含 purgeStaleRooms 字面实参」的端点契约测试。与 mech 报告落实补注（[research-rules-mechanization-20260926.md:90](research-rules-mechanization-20260926.md)）及 doc-status-map §三.2 记载一致。**该断言今天仍在生效。**

**② 层级**：L1（vitest 确定性断言，进 test job）。**③ 成本**：已付讫。**④ 测试要求**：自带（TTL「改一处」承诺若被破坏——有人给 route 加回实参——测试即红；[operations.md:277-279](../docs/operations.md) 的承诺 ↔ 断言对应关系即其正反例说明）。

**⑤ 推荐：已兑现归档**——无需另立票；报告 §五该行「全部未裁决」措辞系入档时快照，原报告落实补注已自注此事。归档动作 = 主公在本文批一句「C2 归档」，调度者回写 mech 报告 §五该行状态。

### C3｜ast-grep 进 CI

**① 现状核实（事实成立）**：本会话实跑 `git grep -iln 'ast-grep'` 仅命中 4 个 .omo 调研/台账文档、`semgrep` 仅命中 mech 报告本身；`ls .github/workflows/` 仅 ci.yml 一个文件，通读无 ast-grep/semgrep job；仓库根无 `rules/` 目录、无 `sgconfig.yml`。**零规则资产落地。**

**② 层级**：L2（结构规则 + 人审——「这类调用形状危险」的语义模糊区）。**③ 成本与 precision**：中成本（新工具链依赖 + rules/ 目录 + fixture 维护）；precision 风险是本层固有病（报告 §一：L2 误报泛滥 → 规则被整体关掉）。**关键事实：唯一具名用途 BR-11 的行为层断言已有探针双保险**（mech 报告 §四洞察 4 自己写明「探针保端到端行为不变」），ast-grep 的增量只是把发现时点从「探针跑时」提前到「lint 时」；**零重犯信号**（取证 15 条重犯实例——基数系仓库外素材，见 §三头注——中无一条需 ast-grep 才能拦）。

**④ 正反例测试要求**（若立）：每条规则带正反例 fixture 进 CI，误报即改规则不关规则。

**⑤ 推荐：本波驳回（候选保留，同型信号再现即复评）**——按本仓「不为改而改」纪律与三犯法则，立机械规则应有活的重犯实例驱动；C3 目前是「工具找用途」而非「错误找规则」。触发复评条件：出现第二例「调用形状」类缺陷（探针/断言盖不住形状时）。

### C4｜eslint --fix / format 自动化

**① 现状核实（事实成立）**：本会话实读 [package.json:39](../package.json) `"lint": "eslint"`——无 `--fix`；scripts 全表（:32-52）无 format/format:check 类条目；devDependencies 无 prettier/biomejs/dprint。

**② 层级**：自动修层（报告 §一原则 3：修复优先于报告——`--fix` 优于报错）。**③ 成本与 precision**：拆两半看——(a) `eslint --fix` 部分小成本、diff 仅限既有 lint 规则面，低风险；(b) 引入 formatter 做全仓 format 是**一次性大 diff 噪声**，原报告即标「diff 噪声需主公裁决」，且选型（prettier/biome）未定。precision 风险集中在 (b)：format diff 会污染 git blame 与未来 PR review。

**④ 正反例测试要求**：(a) 验收 = 改后六层门禁全绿 + diff 仅限可自动修复面；(b) 验收 = `format:check` 进 lint 层，反例 = 临时错排一行文件 → 红。

**⑤ 推荐：有条件立票**——(a) `eslint --fix` 可直接立票；(b) 全仓 format 部分等 §七-Q2 裁决（接受一次性大 diff 与否 + 选型）后再定并入或拆票。

### C5｜派发红线断言模板化

**① 现状核实（事实成立）**：本会话实跑 `ls scripts/` 仅 5 个文件（favicon×2 / sw-bust / vercel-ignore-build×2），无 workflow 脚本模板；`.omo/` 各子目录无红线断言脚本。[dispatcher-playbook.md:52-56](../docs/dispatcher-playbook.md)「机器锚点优先」、[:81](../docs/dispatcher-playbook.md)「worktree 文件面零交集」均为 prose 纪律非可执行脚本。t-n4 型「diff 文件面 vs brief 白名单」集合断言至今只存在于历史会话内联执行。

**② 层级**：L1（集合断言可确定性判定），但作用层特殊——它是**派发层门禁**（workflow 脚本亲跑断言，不信任席位自报），先例即 mech 报告 §二所列「派发层红线 diff 断言」。**③ 成本与 precision**：小成本（沉淀既有做法为模板）；precision 风险低（白名单来自 brief，误报 = brief 写错而非规则错）。「人工拦截成功一次」恰是报告 §四洞察 6 点名的「该机械化」信号。

**④ 正反例测试要求**：模板交付时对历史波回放演练一次——正例 = 合规波文件面 → 绿；反例 = 临时把 brief 外文件计入 diff → 红。

**⑤ 推荐：立票**——小成本，正交独立，随时可派。

### C6｜CI 触发面覆盖对账

**① 现状核实（事实成立，且盲区现役未闭合）**：本会话实读 [ci.yml:3-5](../.github/workflows/ci.yml)：`on:` 仅有 `pull_request: branches: [main]`，无 push trigger——**dev 直推对全部 job 盲，今天仍如此**。`git show a2a667d` 可查证：2026-10-01 00:33 +0800 单行修复 rooms-race 探针 `BASE_URL`（修复后形态在 ci.yml rooms-race step），commit 自述「该 job 自 e1ea4b1 进 CI 起从未绿过」。候选两断言均未实施：仓库无触发器矩阵对账测试（[probe-reconciliation.test.ts:1-18](../tests/qa/probe-reconciliation.test.ts) 只对账探针文件引用，不碰 `on:` 字段）；`git grep run_attempt` 命中全为文档，无脚本实现。**口径差异如实记录**：报告 C6 与 L1-32 写「沉默 12 天」、a2a667d 自述「错配沉默六天」——票面 [ulw-rooms-race-qa-ticket-20260924.md:4](plans/ulw-rooms-race-qa-ticket-20260924.md) 与 a2a667d message 均写「自 e1ea4b1 进 CI 起」，实为**同锚数字矛盾**（2026-10-04 归因更正：原稿「（job 自进 CI 起）vs（BASE_URL 缺失引入起）」的两口径锚点归因有误），两口径并存于同票。

**② 层级**：L1（纯配置文本/AST 断言，无生产触达）。三个可断言子项：(a) 触发器矩阵覆盖长期分支（或显式豁免清单）；(b) CI 结论取 `run_attempt=1` 首跑全绿（L1-33 收口判据的机械化）；(c) 探针必引 [tests/qa/lib/browser.mjs](../tests/qa/lib/browser.mjs) 的 BASE_URL 导出（L1-18 的机械化——a2a667d 重犯实证，现役 20/20 已引、新探针无拦截，见 §三映射 4）。

**③ 成本与 precision**：小；(a) 的 precision 注意点——对账断言只保证「盲区显式化」（盲区出现即红），**不等于盲区被补上**：dev push 要不要真触发 CI 是独立裁决（§七-Q1），[verification-gauntlet.md:96-102](../docs/verification-gauntlet.md) Gap 6 明文「是否立项 dev push 触发 CI 待主公裁决」。

**④ 正反例测试要求**：mutation 对照式（先例：probe-reconciliation 自带注入 ghost-probe 反例）——临时删掉 push/豁免清单一项 → 红；造一个硬编码 `:3000` 的假探针 → BASE_URL 断言红。

**⑤ 推荐：立票（重犯信号最强）**——结构性盲区现役未闭合 + L1-18 同族重犯 + L1-33 判据无机械断言，三个子项同属「CI 验证面真实性」且各有实证，建议一票收口；(c) 并入本票而非另立。

### C7｜cron 上线验证 runbook 脚本化

**① 现状核实（事实成立）**：本会话实读 [vercel.json:4-9](../vercel.json)：crons 仅一条 `0 3 * * *` → `/api/maintenance/purge`；`ls scripts/` 无部署验证脚本；runbook 以文档形态存在（[operations.md:198](../docs/operations.md) 的人工 curl 流程等）。两阶段验证第二阶段（cron 定时触发验调度）截至 09-30 落档未发生——[research-verification-trust-20260930.md:147](research-verification-trust-20260930.md) 盲区 2 明记「次日 cron 日志验证待发生」；本会话无法核验 Vercel 日志，档案亦无完成记载，**该项仍是开放环**。

**② 层级**：混合——部署轮询/两态 curl/crons ls 判定属 L1 脚本；但**生产触达步的前置是授权流程，不是机械可判**（「明示授权 + secret 不回显 + 操作留痕」，[verification-gauntlet.md:128](../docs/verification-gauntlet.md) 实践补充③；初稿误引 :126——:126 实为实践补充①，2026-10-01 复审更正），次日 Cron Logs 检查依赖 Vercel 控制台访问能力。

**③ 成本与 precision**：中；原表已标「生产 secret 注入与次日窗口调度需设计，**授权边界须先裁**」——脚本化生产 curl 会把「人手一次的操作」变成「可重复执行的脚本」，授权边界不先裁就立票是给越权开方便门。

**④ 正反例测试要求**：本地 dry-run 模式必配（mock 状态迁移链），生产模式仅授权后执行且逐条留痕。

**⑤ 推荐：挂起不立票（待 §七-Q3）**——「验证生效纯手工」的事实成立，但授权边界是真实前置，裁决前立票违反本仓生产纪律。

### C8｜TTL 边界造数-触发-对照 harness

**① 现状核实（事实成立，缺口比原报告更大）**：本会话实跑 `git grep -ln 'zz-ttl-probe'` 仅命中调研文档（+未提交的 verification-trust 叙述，见 §一.3）；`ls scripts/` 无 ttl/seed/purge 造数类脚本。**该脚本连一次性版本都未入仓留档**——2026-09-30 的「造 9 条边界行 → 手动 purge → 删 5 留 3 对照」全流程仅存于 [research-verification-trust-20260930.md:19](research-verification-trust-20260930.md) 过程叙述，参数化 harness 完全未启动。

**② 层级**：L1 脚本（测试前缀造数 + purge 触发 + 删留名单对照断言，全部确定性）。**③ 成本与 precision**：中——边界行参数表需随 schema 维护；且「要不要再跑 TTL 边界实证」本身是产品节奏问题，不是错误驱动（无重犯信号，属能力沉淀型候选）。

**④ 正反例测试要求**：harness 自带（对照断言即测试）；需钉「只碰 zz-ttl-probe 测试前缀、真实数据零接触」为 harness 内置断言。

**⑤ 推荐：挂起候补（待 §七-Q4）**——若主公判断 TTL 边界复测会再发生，最低成本起步动作是「补一次性脚本入档」（几行脚本 + 说明，防流程失传）；参数化 harness 则等真实复用需求出现再立。

### C9｜文档契约测试扩展面评估（C2 推广）

**① 现状核实（partially：字面两例一修一残，形态未实施）**：抽查两例——(1) **生产 URL 双域名不一致面今天仍在**：[operations.md:179](../docs/operations.md) 正文仍写「生产 URL：https://3t-tic-tac-toe.vercel.app/」、[:198](../docs/operations.md) 验证 curl 同旧 URL；:194-196 已有【2026-09-30 勘误补注】声明正式入口为 `https://3t.onepis.net`——**勘误已入档但正文未回写**。代码侧同床异梦：[app/layout.tsx:48](../app/layout.tsx) `metadataBase` 钉 vercel.app（:66 注释释明有意保留，[layout.test.ts:50](../app/layout.test.ts) 断言锁死），而 [layout.tsx:69](../app/layout.tsx) 与 [lib/home-jsonld.ts:40](../lib/home-jsonld.ts) 已用 3t.onepis.net。(2) **探针期待漂移于 BR-1 一例已被修复**（`1b80a99`，L1-34 实证段同记），该具体漂移不复存在。形态本身未实施：现有对账测试只盖「孤儿探针」维度（[probe-reconciliation.test.ts:1-18](../tests/qa/probe-reconciliation.test.ts)），不含「生产 URL 常量 ↔ operations.md」「探针期待 ↔ business-rules 表」「跨文档互引存在性」（[verification-gauntlet.md:118](../docs/verification-gauntlet.md) 契约）逐项对账。

**② 层级**：L1 vitest 契约测试（C2/R6 已验证的模式）。三个扩展断言面各自独立，可逐条立、逐条验。

**③ 成本与 precision**：中（漂移面盘点后逐条立断言）；precision 关键在**别把「有意为之」误判为漂移**——metadataBase 钉 vercel.app 是有注释的既定设计（layout.tsx:66），断言面必须先与主公确认「哪边是正」，否则机械对账会把设计决策当 bug 报红。

**④ 正反例测试要求**：每条断言带 mutation 反例——如把常量改回 vercel.app → URL 断言红；当前 operations.md:179 未回写的状态就是现成反例样本。

**⑤ 推荐：立票（建议与 C6 同波）**——重犯信号加持（探针期待族两犯 + 文档断言↔实况族多犯，§三映射 1/7；**复审更正**：初稿误称探针期待族「三犯达成」，经亲核票头「第三处」即 `1b80a99` 同一事件，该族实为两犯，立票论据不依赖三犯达标）+ C2 先例模式已验证 + 「勘误不回写正文即再漂移」的活样本在库。与 C6 同落 tests/qa 契约测试面，可并票。

### 裁决速览

| # | 候选 | 推荐 | 一句话理由 |
|---|---|---|---|
| C1 | 台账字段 | **立票（最先落）** | 通道入口件，后续每票都要回写它 |
| C2 | 文档契约测试 | **已兑现归档** | 2d7709b 断言今日现场核验仍在生效 |
| C3 | ast-grep 进 CI | **本波驳回** | 零重犯信号，唯一具名用途已有探针双保险；同型信号再现即复评 |
| C4 | --fix / format | **有条件立票** | --fix 部分直接立；全仓 format 噪声待 §七-Q2 |
| C5 | 派发断言模板 | **立票** | 人工拦截成功即「该机械化」信号，小成本正交 |
| C6 | CI 触发面对账 | **立票** | 重犯信号最强（触发面+BASE_URL+rerun 三子项各有实证）；BASE_URL 断言并入；dev push 与否待 §七-Q1 |
| C7 | cron runbook | **挂起** | 授权边界须先裁（§七-Q3），裁决前立票违生产纪律 |
| C8 | TTL harness | **挂起候补** | 无重犯信号；最低成本动作=补一次性脚本入档（§七-Q4） |
| C9 | 契约测试扩展 | **立票（与 C6 同波）** | 两族重犯（探针期待 2 犯 + 文档漂移 ≥3 例）+ 先例模式 + 勘误不回写活样本 |

## 三、重犯证据与候选的映射

> 素材：唤醒任务三路取证之「重犯错误实例」15 条（recurred=true 共 8 条）——**该基数系仓库外取证素材，仓库内无逐条载体可核验**；下表犯次仅引仓库内可独立点名的实例（commit / 档案行）。「三犯信号加持」= 该候选所对应错误已达/已超三犯法则线（[research-rules-mechanization-20260926.md:62](research-rules-mechanization-20260926.md)）；犯次经 2026-10-01 独立复审更正（C9 探针期待族 3→2）。

### 3.1 有重犯信号加持的候选（犯次逐条标注，经复审更正）

| 候选 | 重犯实例 | 犯次证据 |
|---|---|---|
| **C9** | 探针期待漂移于业务 decree | **两犯在案（复审更正：初稿误计三犯）**：SW 断言假绿通道（`54045f7`，本会话 `git show` 核实在档）→ offline 探针 A2a/A2b 违 BR-1（`1b80a99`）；flaky 票头「CI 暴露第三处探针过时，已修 `1b80a99`」（[ulw-homedialog-flaky-fix-20260926.md:5](plans/ulw-homedialog-flaky-fix-20260926.md)，原文亲核）——**「第三处」即 `1b80a99` 修的 offline 探针同一事件，非独立犯次**；`git log -E` 按「探针过时 / 假绿 / 漂移 / 假绿通道」关键词亲核（本会话实跑），可独立点名者仅此两例。该族犯次 2/3 未达三犯线；L1-34（[:231-237](../docs/anti-patterns.md)）为反模式侧记 |
| **C9** | 文档断言↔实况漂移多犯 | 匿名行决策卡前提被代码三证推翻、operations.md 生产 URL 过时、273 个裸 hash 需逐一批验（[research-verification-trust-20260930.md](research-verification-trust-20260930.md) §一.1/§二.4/§三 C9 行；2026-10-04 节号更正——原稿「§二.4/§二.10」归属偏移，273 实载 §一.1）——≥3 例独立可点，**C9 的三犯级信号由本族承载**（探针期待族见上行仅两犯） |
| **C6** | CI 触发面盲区（recurred=true） | ci.yml:3-5 实测仅 PR 触发，dev 直推零 job，rooms-race 沉默 12 天（L1-32 [:215-221](../docs/anti-patterns.md) + [gauntlet Gap 6 :96-102](../docs/verification-gauntlet.md)）；主公亲令「不能让它就这样沉默的通过了」 |
| **C6（子项 c）** | 探针 BASE_URL 约定重犯 | L1-18（[:111-113](../docs/anti-patterns.md)）立规后 rooms-race 仍漏传致 job 进 CI 起必红（`a2a667d`）；本会话实跑核验：现役 20 探针已引、未引 2 枚系 DISABLED（另 1 枚 commit-audit 非浏览器探针），新探针再犯无拦截 |
| **C6（邻接）** | rerun 绿混同首跑绿（recurred=false，判据漂移单犯） | L1-33（[:223-229](../docs/anti-patterns.md)）判据仅入 gauntlet blockquote（[:126](../docs/verification-gauntlet.md)），CI 结论无 `run_attempt=1` 机械断言 |
| **C5** | 派发意图漂移（recurred=true，约 15 次 tool call 后规则被 out-vote） | L1-29（[:194-201](../docs/anti-patterns.md)）+ playbook §意图锚定五招；t-n4 型靠司机人工拦截成功——「人工拦截成功该机械化」信号（mech §四洞察 6） |
| **C1（间接）** | 绿测试自证陷阱（recurred=true）等「文档层规则无台账」族 | R6 门禁只盖「业务规则不外化」一个子模式，另两子模式至今无防线（L1-27 [:183-188](../docs/anti-patterns.md) + [learnings.md:242 §32](../docs/learnings.md)）——多处「下一步该机械化」散在 prose 无台账，正是 C1 立票理由 |

### 3.2 暂无候选承接的实例（规则集 intake 候补池）

以下实例已入 anti-patterns 文档层，但 C1–C9 无一承接其机械化，列为候补池——是否立新候选编号（C10 起）待主公裁（§七-Q5）：

1. **测试时序/竞态类缺陷 ≥5 次修复**：合并确认钮断言竞态、全删用例毫秒竞态、hydration 轮询、win-glow MutationObserver、stats-race 竞态读等（本会话亲跑 `git log -E --grep='竞态|时序|flaky|假绿' --oneline` 实测 **39** 命中；取证原数字 15 不可复现——基础正则下 `|` 被当字面量、原样跑为 0 命中，已弃用）；「时序敏感断言写法」停在文档层；T-F1/T-F2 已交付单票（`74e1a56`/`4ee9fa6`），**泛化治理票入档待派未立项**。犯次已远超三犯线，是候补池里信号最强的一条。
2. **越权执行（调度者未经明令执行 T-F1/T-F2）**：主公纠偏立「计划入档即停」硬纪律（[ulw-homedialog-flaky-fix-20260926.md:3](plans/ulw-homedialog-flaky-fix-20260926.md) 留档原文）；**无任何门禁能区分「已令/未令」的执行动作**——单犯，候选形态不明（状态机校验扩展属 commit-audit 改造，[requirement-intake.md:236](../docs/requirement-intake.md) §八已列「建议硬化」）。
3. **仓库批量删除绕 git 通道灾难单犯**：40 tracked 文件 + .git/hooks + 备份 15 秒被删，reflog/index 零记录（L2-7 [:145-147](../docs/anti-patterns.md) / L2-8 [:149-151](../docs/anti-patterns.md)）；org ruleset 只护 main 合流面，worktree 本地删除零防线。候选形态不明（文件系统级 watch？成本待估）。
4. **生产设施操作无授权留痕模板**（recurred=false）：唯一防线是纪律；C7 的「授权留痕模板化」子项（[research-verification-trust-20260930.md](research-verification-trust-20260930.md) §二.6 免盯梢映射）若 C7 挂起可先拆此小件独立成票。
5. **次日 cron 验证开放环**：recurred=false 但**无任何防线保证发生**——「明日必过线」行已预埋（zz-ttl-probe 族），第二阶段验证全靠人工记得查；C7 挂起期间此环持续开放（本会话无法核验 Vercel 日志，如实注明）。

### 3.3 对照组：已晋升先例（管道可行性的在库证据）

- **文档→门禁**：commit 排版同日四五犯 → R7 进 commit-audit 策略真源（[commit-audit.mjs:25](../tests/qa/commit-audit.mjs)），立规后零重犯；
- **文档→脚本**：退役文件引用悬空（发版 PR #14 红）→ probe-reconciliation 对账测试（`f327646`）+ probe-reconciliation 自身 KNOWN_ORPHANS 白名单 13→0（L1-31；2026-10-04 术语更正——原稿「knip 白名单」系混称，knip.json 无该白名单）；
- **文档→门禁**：467 全绿但合并弹框 decree 被破 → R6 `auditBrProbeBinding`（[commit-audit.mjs:253](../tests/qa/commit-audit.mjs)）双向机械绑定；
- **文档→脚本**：TTL「改一处」承诺 → maintenance-purge 契约断言（C2，`2d7709b`）。

## 四、复利闭环设计

> 目标：把 mech 报告 §一晋升流水线（错误 → 文档 → 复发 → 脚本 → 门禁 → 自动修）从「每会话靠人记得推」变成「台账字段驱动的固定通道」。**本节是设计预览，落地以 C1 票为准。**

### 4.1 固定通道（五步）

```
① 新错误        → 记入 docs/anti-patterns.md 追加节（含实证段 file:line / commit）
② C1 字段落地   → 条目自带「机械化状态：文档层 → 下一层触发：<条件>」一行
③ 复发时查台账  → 命中已有条目：实证段追加犯次；触发条件满足（三犯 / 人工拦截成功 /
                   勘误不回写再漂移 / 同型单犯但后果重大）→ 进立规队列
④ 立规放对层    → 按强制力分级：L1→hook/CI/vitest 阻断；L2→结构规则+人审；L3→AI 评审
                   （mech 报告 §一原则 4；放错层 = 误报泛滥或永远重犯）
⑤ 落地回写台账  → 字段更新为晋升后的层 + 守护测试路径；该条目闭环
```

### 4.2 C1 作为通道入口件的作用

「同型错误不靠记忆靠管道」的具体含义：现状下「L1-18 已重犯、该下沉脚本层」这类判断只存在于当次会话推理——换个会话就要从 48 条 prose 里重新 human-parse 一遍。C1 落地后，**③步变成读字段**：任何会话拿到「又犯了」的信号，先 grep 台账字段，命中即知道犯次计数、触发条件、以及晋升该去哪层；未命中才走①步立新条。字段同时是 §二各候选的记账处——C6/C9 落地后回写 L1-32/L1-33/L1-18/L1-34 的字段为「脚本层」，C2 归档时回写 TTL 族条目，「已晋升先例」（§3.3）从此在台账可见，新会话不用再读代码反推。

### 4.3 通道的两条护栏

1. **字段腐化防线**：字段写了不更新 = 台账失信。护栏 = 「每个 ### 条目必含机械化状态行」存在性断言（可并入 C9 对账测试族）+ 「立规票收口时必须回写字段」入 [commit-policy](../docs/commit-policy.md) 同步维护承诺同款纪律。
2. **precision 预算**：每条晋升规则带正反例测试（先例：R6/R7 均有配套验证）；误报即修规则不整体关停（mech 报告 §三.D 精度预算原则）。

## 五、C1 样例：3 条真实条目的字段预览

> **预览性质，不落真文件**——以下展示字段写法，正式落地以 C1 票（含 §七-Q6 编号策略裁决）为准。三条刻意覆盖字段的三个典型状态：已晋升 / 触发条件已满足待晋升 / 两犯在案计数中。

**样例 1｜L1-31：退役文件时未同步其引用方（[:209-213](../docs/anti-patterns.md)）——「已晋升」状态**

```markdown
- 机械化状态：**脚本层（2026-09-24 晋升）**——守护测试 tests/qa/probe-reconciliation.test.ts
  （ci.yml ↔ tests/qa 双向对账 + 注入对照）+ probe-reconciliation 自身 KNOWN_ORPHANS 孤儿探针白名单清零（13→0；2026-10-04 术语更正，原稿「knip」系混称）。
- 下一层触发：对账漏检新引用面（如 docs 之外引用方）复发 1 次 → 扩对账源清单；暂无自动修层需求。
```

**样例 2｜L1-18：探针 BASE_URL 不硬编码（[:111-113](../docs/anti-patterns.md)）——「触发条件已满足待晋升」状态**

```markdown
- 机械化状态：文档层。
- 下一层触发：**已满足（2026-10-01 a2a667d 重犯实证：rooms-race 探针漏传致 job 进 CI 起必红）**
  ——「探针必引 tests/qa/lib/browser.mjs 的 BASE_URL 导出」断言并入候选 C6 对账测试即晋升脚本层。
```

**样例 3｜L1-34：探针期待漂移于业务 decree（[:231-237](../docs/anti-patterns.md)）——「两犯在案计数中」状态（复审更正：初稿误标三犯达标）**

```markdown
- 机械化状态：文档层。
- 犯次：2（54045f7 SW 断言假绿通道；1b80a99 offline A2a/A2b 违 BR-1。flaky 票头「第三处探针过时」
  即 1b80a99 同一事件票面自述，不计独立犯次——初稿此处误计 3，2026-10-01 复审更正）。
- 下一层触发：再犯第 3 次即达三犯线；「探针期待 ↔ business-rules 表」对账断言（候选 C9）若先行落地
  则直接晋升脚本层——C9 现行立票论据由同族「文档断言 ↔ 实况漂移」多犯 + operations.md:179 活样本承接。
```

## 六、第一波建议

### 6.1 裁决顺序

1. **C1 先裁先落**（既定安排 [doc-status-map-20260927.md §三.2](doc-status-map-20260927.md) 亦作此排序）：入口件，最小成本，且后续每票落地都要回写字段——先落免二次返工。票内需先裁 §七-Q6 编号策略。
2. **C2 归档**：零动作，主公批一句即结（§二C2⑤）。
3. **C6 + C9 并票**：重犯信号最强的两候选；同落 tests/qa 契约测试面（C6 扩 [probe-reconciliation.test.ts](../tests/qa/probe-reconciliation.test.ts) 或其同族新文件，C9 逐条立「文档 ↔ 实况」断言），可一票两交付物或同波先后两票。
4. **C4（缩范围）**：`eslint --fix` 部分独立小票；format 层等 §七-Q2。
5. **C5**：独立小票，随时可派。
6. **C3 驳回、C7/C8 挂起**：各待 §七 裁决，本轮不动。

### 6.2 可并票性（正交性矩阵）

| 票 | 文件面 | 与他票交集 |
|---|---|---|
| C1 | docs/anti-patterns.md | 无（纯文档字段） |
| C6+C9 | tests/qa 契约测试 +（C6 若裁 dev push 则）ci.yml | 两候选互有测试文件面交集 → 并票；与 C1 仅「回写字段」语义关联 |
| C4 | package.json / eslint.config.mjs | 无 |
| C5 | .omo/ 或 scripts/ 新模板 | 无 |
| C7/C8（若立） | scripts/ + 生产触达 | 与 C4/C5 scripts/ 目录共置但文件不交 |

候选间正交性与 verification-trust 报告 §四的判断一致（「C6-C9 与 C1-C5 无重叠」）；本文唯一修正：C6 与 C9 在测试文件面上有交集，建议同波而非各自独立排期。

### 6.3 每票验收门（挂哪个机械检查）

| 票 | 验收门 |
|---|---|
| C1 | 48 条字段全覆盖；（可选）「每条目含机械化状态行」存在性断言进对账测试族；R7 排版照常过 hook |
| C6 | vitest 断言 + mutation 对照（删豁免/造假探针 → 必红）；若 §七-Q1 裁「补 dev push」则验收含一次真实 push 触发亲见 job 实跑（L1-32 合格动作） |
| C9 | 每条断言带正反例（反例样本现成：operations.md:179 未回写；常量改回 vercel.app → URL 断言红）；断言面正误判边界先经 §二C9③ 与主公确认 |
| C4 | `--fix` 改后六层门禁全绿、diff 仅限可自动修复面 |
| C5 | 模板 + 历史波回放演练（正例绿 / 造越界 diff 红） |

## 七、待主公裁决问题清单

> 真实开放、不可自答的问题。逐条批「Q-n：选 X」即可。

- **Q1｜CI 触发面：C6 立票范围**——C6 的对账断言只保证「盲区显式化」（盲区出现即红），不等于盲区补上。dev push 要不要真触发 CI（或显式豁免清单化），[verification-gauntlet.md:96-102](../docs/verification-gauntlet.md) Gap 6 明文待主公裁。选 a) C6 只立断言，触发面维持现状入豁免清单；b) C6 连「dev push 触发」一起立（CI 时长成本会增加）；c) 只立 run_attempt=1 与 BASE_URL 两断言，触发面继续挂账。
- **Q2｜C4 全仓 format 噪声取舍**——a) 接受一次性全仓 format 大 diff（blame 污染一次到位），formatter 选型愚见 prettier（生态最大）；b) 只立 `eslint --fix` 部分，format 层不做；c) format:check 只进门禁不回填存量（新文件即 format、旧文件漂着）。
- **Q3｜C7 授权边界前置**——生产触达（部署轮询 / 两态 curl / 次日 Cron Logs 检查）允许脚本化到什么程度？a) 本地 dry-run 脚本化 + 生产步仍人工（仅模板化命令清单）；b) 生产步也脚本化，以「授权留痕字段（授权人/授权语/操作清单）」为执行前置；c) C7 整体继续挂起。另：次日 cron 验证开放环（§3.2-5）需要主公定谁去查 Cron Logs（调度者无控制台凭据）。
- **Q4｜C8 处置**——a) 立最小票「补 09-30 一次性 TTL 边界脚本入档」（防流程失传）；b) 参数化 harness 正式立项；c) 挂候补池不动。
- **Q5｜候补池新候选编号**——§3.2 五条无承接实例（时序/竞态断言 ≥5 犯、越权「已令/未令」门禁、批量删除绕 git、授权留痕模板、cron 开放环）是否立 C10 起候选入台账？其中时序/竞态一条犯次已远超三犯线，愚见优先。
- **Q6｜L1 编号断档策略（C1 票内前置）**——anti-patterns L1 主线止于 19、追加节从 27 起，L1-20~26 空缺（[:115→183](../docs/anti-patterns.md)；断档系历史遗留、非 58cc978 追加节引入——2026-10-04 成因注）。a) 续号（新条目从 L1-35 起，断档保留——愚见：L1-31 等编号已被 [probe-reconciliation.test.ts](../tests/qa/probe-reconciliation.test.ts) 头注释等仓内引用，重排破引用）；b) 补齐断档重排（需同步改全部引用方）。
- **Q7附列｜资产盘点整理项（不属 C1–C9，本文不擅动，逐项请裁）**——
  - a) [alignment-20260926-doc-governance.md:14](alignment-20260926-doc-governance.md) 「文档状态真源 = doc-status-map-20260926」指针已过期（真源接替为 20260927 主图 + ledger——主图头注系结构性体现接替，无「真源」明文，明文仅见修订记录〔2026-10-04 措辞精确化〕）——加注或修订；
  - b) [docs/diff-dev-main-20260922.md](../docs/diff-dev-main-20260922.md) 快照全过期（今日实测 `git rev-list` main..dev=2、dev..main=3，与快照 121 领先完全不同）——加过期注还是归档；
  - c) [docs/branching.md:1-20](../docs/branching.md) 2026-09-13 定案「Trunk-Based、无 dev 长命枝」与实况矛盾（工作分支即 dev、dev-stable tag 三枚、CI 仅 PR 触发、dev→main 发版 PR 先例）——改文档还是改分支实践，方向需主公定；机械对账断言属 C9 面；
  - d) [docs/agents-md-sync-suggestions-wrf.md](../docs/agents-md-sync-suggestions-wrf.md) 自述草案已消费进 AGENTS.md/requirement-intake 但未标档（同类：lsp-setup-retrospective、evals-mcp-practice-map 冬眠件）——已消费/冬眠件不标档会污染 C1 台账的「活契约」分拣，是否补 ARCHIVED/CONSUMED 标注；
  - e) [docs/agent-workflow.md:63](../docs/agent-workflow.md)（vercel-ignore-build SSOT 所在）不在 AGENTS.md router/repo-map 的孤立件——收编进 router 还是标注按需读；
  - f) 工作树未提交四件（M×3 + untracked [research-verification-trust-20260930.md](research-verification-trust-20260930.md)，reflog 实证 `6c64261` 已提交后被 reset 回 `b8e3e0c`）——重新入档 commit 与本文（本文入档后同为工作树未提交状态）的 commit/push 时机，沿「计划入档即停」纪律待主公令。

---

> **本文自身纪律声明**：起草人只写了本文件（`.omo/research-rules-mechanization-awaken-20261001.md`，唯一新增），未改动其他任何文件，未实施任何候选。全部候选维持「未裁决不实施」。
