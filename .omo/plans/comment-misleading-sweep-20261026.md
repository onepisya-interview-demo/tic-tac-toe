# 误导注释清理 Sweep 台账（comment-misleading-sweep）

> 2026-10-26 立卷（骨架）；2026-10-27 收口波回填（调研/sweep 实收/验证/裁决位）。裁决真源＝主公 2026-10-26 三令原话（§〇，逐字）。
> 本台账是「全仓清理容易误导的注释」方向令的执行账本：阶段落地动作、自决决策（证据 file:line 或命令输出）、验证证据、待主公裁决项。提交 `Plan:` footer 指向本文件。
> 关联档：[ADR-0001](./adr-0001-github-committer-exemption-20261026.md)（P2-e 终局）／[注释分诊 rollout 台账](./comment-triage-rollout-20261025.md)（前置四阶段，含分诊矩阵与增量门禁 R8/M2）／[practice-v2 调研存档](./comment-triage-practice-v2-20261024.md)（poteto/pstack 一手剪藏索引）。

## 〇 主公三令原话（2026-10-26，逐字记录）

1. P2-e 裁决：「留，但是记录清楚 ADR。」
2. 依赖新政令：「可以新增依赖，但是依赖必须是非常必要的，改进环境的，改进验证与增加人类对 agent 的信任的依赖。否则应该询问人类。」
3. 方向令：「如果我们没法在一开始就不允许 AI 写注释，现在也算止血了。但是所有代码我觉得我们都应该清理容易误导的注释」＋令调研：「poteto 她是如何不允许模型写注释的？你知道 poteto 禁止注释的原因吗？可以上网查一下。」

**落地形态**：令 1 → [ADR-0001](./adr-0001-github-committer-exemption-20261026.md)＋rollout §六 P2-e 裁决叠注；令 2 → AGENTS.md L0 依赖新增政令行＋本台账 §三.3 消费规则；令 3 → 本台账主体阶段（§一）＋poteto 调研（§一.1）。

## 一 阶段

| # | 阶段 | 状态 |
| --- | --- | --- |
| 0 | **落档波（2026-10-26）**：三件落地——① ADR-0001（Status=Accepted、附记一越线教训／附记二环境改进提议标注待主公明令不执行）；② AGENTS.md L0 依赖政令行（仅项目块，BEGIN:nextjs-agent-rules 零触碰）；③ rollout §六 P2-e 回写已裁决＋本台账骨架。**【提交叠注 2026-10-26】审读通过，主公令提交**：拆两笔 `docs(adr)`＝`0f5f339`／`docs(policy)`＝`0eb2edd` | ✅ 已提交 |
| 1 | poteto 调研（上网查） | ✅ 收口波补做（§1.1；身份线索纠正） |
| 2 | 误导注释清理 sweep 主体（全仓盘点＋分诊＋执行） | ✅ 已落地：生产面 `bcc40a4`（15 文件 17 处）＋测试面 `db6f80f`（16 文件 38 处），判据与实收见 §1.2／§1.3 |
| 3 | 调研结论反哺（源头抑制是否立项） | 🔶 结论已呈报（§1.1 implications），立项待主公裁（§三.7） |

### 1.1 poteto 调研结论（收口波 2026-10-27 补做；未单独立调研档，结论内嵌本节）

**身份纠正（立卷线索有误）**：poteto ＝ **Lauren Tan**（[@poteto](https://x.com/poteto)，前 Meta/Stripe、现 Cursor 工程师、[pstack](https://www.reddit.com/r/GithubCopilot/comments/1wveivl/) 作者）——立卷时「Hiroshi Tsubokura／zenn 系」猜测**不成立**，以本节为准。

**mechanism（她如何不允许模型写注释）——前 5 条**：

1. `/no-comments` skill（pstack 内技能，Cursor 插件形态、可加载进 Claude Code/Codex 等 agent）：查找并清除无用注释（[X 帖 2026-10-13](https://x.com/poteto/status/2110214162400137637)＋[AGTP 转述](https://x.com/AGTPinsights/status/2110216690319712757)，本会话实读）。
2. 只读子代理 Comment Sicko 兜底分诊：「注释默认处死，仅五类例外（法律/许可头、无法改造的外部依赖强制行为、`// prettier-ignore`、公共 API 契约 doc comment、解释代码无法表达之约束的 issue/RFC 链接）；存疑即删」（本仓 practice-v2 一手剪藏：`pstack-upstream/agents/comment-sicko.md`，见 [practice-v2:57](./comment-triage-practice-v2-20261024.md)）。
3. poteto-mode SKILL:117-119 禁 AI 装饰性/叙述性注释（`// Phase 1: add cards` 式 Phase/Step＋数字、AI 黑话）（[practice-v2:113](./comment-triage-practice-v2-20261024.md)）。
4. 配套 `/swarm` 工作流：`/no-comments` 附带生成重构计划，列哪些 workaround 应重构、哪些应删——从第一性原理解决注释背后的临时变通方案本体（AGTP 转述，本会话实读）。
5. **无 lint/CI 强制**——机制全在 agent 技能/工作流层；自带代码实证 3,661 行 TS 留 23 行注释（0.63%，全为例外清单类型）（[practice-v2:93](./comment-triage-practice-v2-20261024.md) 采信优先级：一手代码＞一手技能文件＞书笔记＞评论区转述）。

**reasons（禁止注释的原因）——前 5 条**：

1. 「agents love copying what already exists」——agent 复制既有内容（含过期注释）当完成任务捷径（X 帖原文）。
2. 解释 workaround 的注释是代码库最糟糕的「病毒/杂草」之一：被 agent 复制蔓延，hack＋过时注释淹没代码库。
3. 大多数注释背后的真问题应修根源（如换更好 API），不靠注释。
4. 例外仅限「问题真正不在你控制范围内」（浏览器怪癖等），且她认为罕见。
5. 叙述性注释让 diff 显得未完成（pstack 上游口径，practice-v2:115 引）。

**implications（对本仓，全量）**：

1. **同向验证**：本波 sweep 实收 108 条确认误导注释（§1.3），多类正是「复制/过期」机制在本仓的真实发生（典型：`/offline` 路由改名 `d07fd07` 后 19 天，`8d1b960` 重写时注释仍写「three」——app 分区候选3 考古）。
2. **全禁不适用本仓**（practice-v2:46 已有先裁）：本仓核心治理资产（BR 头/决策编号/plan 回链）恰由行内注释承载；pstack 式全禁在其仓库可行系因治理信息走技能文件与类型。本仓等价物＝四条归格规则＋保护面只报告纪律（§1.2 判据 3）。
3. **例外清单与本仓留格规则部分对应**：公共 API 契约 doc ↔ JSDoc 契约留；issue/RFC 链接 ↔ plan 回链留；`// prettier-ignore`／法律头本仓现无实例。
4. **争议面如实呈报**：Sentry David Cramer 反对（注释里的意图与上下文有价值，全删致 agent 浪费 token 猜错方向）；主流折中「删 what 的注释、留 why 的注释」——与本波实践一致（删/改的是 what 复述与失真，留的是 why 载体）。
5. **机制层缺口**：poteto 在源头（生成时）抑制，本仓 M2 eslint `no-warning-comments`／R8 只覆盖注释存量的机械面（TODO 类/提交面），「误导性」（需对照代码实况语义判断）无自动门禁可拦——此为本仓与她的机制差异，亦是 §三.7 立项建议的出发点。

### 1.2 判据清单（sweep 执行面；沿用 rollout 分诊矩阵＋本波操作化）

1. **两半验证定谳**：每条候选须同时证实「注释说的」与「代码实况」两半——Read 源文件对读＋rg/sed/find 实测＋git 考古（`log -S`／`--diff-filter=A`／`blame`／`ls-tree`／`show` diff），命令与输出记入各条 evidence。
2. **误导三型操作性定义**：过期复述（路由改名/计数漂移/行号漂移/端点退役）；失真声明（sole-consumer/唯一消费方/机制描述与实现不符/列名错）；超前用途（声明不存在的消费方或用途）。
3. **保护面只报告不改动**：`// BR:` 头注释（前 20 行内）；决策编号回链块（W-R／W1／D-N／票 N／L1-N）；行首 plan 回链；判据 banner；JSDoc 契约；真域名等人类决策载体。
4. **处置三档**：改写（无保护面的普通注释对齐实况）／只报告（保护面、测试名 `it()` 字符串、死代码本体、恒真断言等代码债）／删（纯误导且零承载）。
5. **代码债不代裁**：测试名字符串、死调用/死函数本体、探针整体退役、断言强度——超出注释 sweep 范围的只登记留主公裁。

### 1.3 扫描实收（7 分区；候选 109＝确认 108＋证伪 1）

| 分区 | 候选 | 确认 | 证伪 | 复核方式与要点（摘） |
| --- | --- | --- | --- | --- |
| app | 12 | 12 | 0 | 12/12 逐条独立复核（Read＋rg/sed＋git 考古）；三处 evidence 修正不改变结论（globals.css `}` 实在 :242；rg 点前缀目录需 --no-ignore；D16 叙述 blame+diff 坐实） |
| components | 17 | 17 | 0 | 17/17 成立；Alert.test.tsx 路径更正为 components/ui/；第 15 条「:286 引用反而准确」被证伪（行号引用实为 :370/:372/:375 三处且全漂移） |
| lib | 15 | 15 | 0 | 全部命令本轮实跑；三处修正并入表述（postMerge sole-consumer 实真、硬伤收敛为 postRoomSession 双消费方互斥；67 行系历史时态降次要；store.ts:282 confidence high→medium） |
| db | 3 | 2 | 1 | 候选3 自述「核验记录非发现」复核属实→按证伪误导指控口径 rejected；候选1/2 维持只报告（dismiss 决策是否翻案属主公裁） |
| scripts | 6 | 6 | 0 | 条3 动态 import 命中列举不全已修正（关键结论「零指向 scripts/」不变）；条1 改用全量 diff 更决定性；置信保持 1high/2low/3high/4medium/5low/6medium |
| tests 除 qa | 32 | 32 | 0 | 32/32 成立；两处小修正（.reason 消费方另有 RoomGateDialog:124-127 与 OutcomeErrorBanner；成功镜像断言实在 store.test.ts:133-135）；处置 30 改写＋1 删＋1 只报告 |
| tests/qa | 24 | 24 | 0 | 24/24 成立；三类证据修正（git log -3 需 --all --follow 才见 d07fd07；game.ts 全文仅 160 行 :233 是文件外行号；「146 行独白」实为 11-177 共 167 行）；4 条只报告口径原样保留 |

**落地**：生产面 `bcc40a4`（15 文件 17 处：app 4＋components 6＋lib 3＋scripts 1＋test 辅 1）＋测试面 `db6f80f`（16 文件 38 处，全在 tests/）。两笔均过 pre-commit R8-STAGED＋commit-msg 钩子。

### 1.4 reportedOnly 全量登记（12 条；保护面/超范围，理由逐条）

| # | 位置 | 置信 | 理由（摘） |
| --- | --- | --- | --- |
| 1 | components/HomeDialogMount.tsx:114 | high | 「row 已转发」失真残留在 W-RV P3 #11 决策编号回链块内（:112-118），与已改写的 :103-110 矛盾——决策回链块只报告 |
| 2 | components/GameShell.tsx:36 | high | cardMinH JSDoc/cardViewTransitionName JSDoc/组件头注三处 /play、/solo 路由词汇过期（路由不存在；实况 /offline 传值、/online 留空）——确认项只登记 viewToggle 块 |
| 3 | lib/room-name.ts:32 | high | 与已改写 :53 同款 four→six 计数失真（实况 6 个 route 文件全 import normalizeRoom）——确认项只登记 :53 |
| 4 | tests/db/db.test.ts:582 | high | banner 行含 W-SYNC wave 2 plan 回链且「per-name ledger via game_stats.name」列名失真（列已改 room）；紧邻 :583-587 已作为确认项 30 改写 |
| 5 | tests/db/db.test.ts:735 | high | registerOrLoginRoom 分节头（:732 起含 W1 plan 回链）内列名失真＋「catch-and-reread」机制描述与 lib/db.ts:737-752（onConflictDoUpdate 吸收）不符 |
| 6 | tests/db/db.test.ts:621 | high | 测试名（it 字符串）含 name/PK 失真——键列是 room 且 UNIQUE 非 PK；测试名是代码字符串非注释，超注释 sweep 范围 |
| 7 | app/layout.test.ts:62 | high | 两处测试名「three PNG variants」——实为 4 条目（:68 toBe(4)；layout.tsx 四处 type）；已改写的 :66-67 注释块如实 |
| 8 | tests/db/db.test.ts:840 | high | 行尾注释本身如实，但其附着断言 toBeGreaterThanOrEqual(0) 恒真——断言强度是代码债非注释债 |
| 9 | tests/store/store.mutation.test.ts:237 | medium | 「line 190」自引用行号未独立核验；本波对该文件 21 处编辑全部保持各块行数不变，未引入新漂移 |
| 10 | tests/qa/ux-qa.mjs:78 | high | PUT /api/stats 死调用本体（路由退役今日 404 静默）——确认项 47 只改注释，删调用超范围；另 ux-contract.mjs:19-20 断言仅 UX_STRICT=1 时 gate，失真被掩蔽 |
| 11 | tests/qa/merge-sync-qa.mjs:8 | high | offline-stats/sync 端点已不存在（rg exit=1 实测）；探针整体 status=DISABLED 早退，退役/删除是结构债 |
| 12 | tests/qa/offline-mode-qa.mjs:68 | high | 确认项 55 删的是失真注释块；getStats/deleteStats 死代码本体（零调用点）仍在——删代码超范围，留主公裁 |

> 各分区 evidence 全文（含命令与输出、执行提示 A/B、候选11 补充观察、未跑项声明）见 sweep 扫描交付材料；本表为登记面摘录。

## 二 验证

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| ⑤层 `--branch dev`（P2-e 终态复核） | `node tests/qa/commit-audit.mjs --branch dev` | 落档波实跑：**exit 0，`ref=dev total=501 pass=485 skip=16 fail=0`**，4ac5acf0 输出 `SKIP … (github committer)`、零 FAIL（ADR Consequences 同锚） |
| 提交信息预验①②（hook 同款路径） | `node tests/qa/commit-audit.mjs --message-file /tmp/msg-{adr,policy}-20261026.txt` | 落档波实跑：均 **PASS**，exit 0 |
| ⑤层 range 面（含本波全部新提交） | `node tests/qa/commit-audit.mjs --range origin/main..HEAD` | 落档波实跑：**exit 0，`total=82 pass=82 skip=0 fail=0`**（0f5f339e／0eb2eddc 均 PASS）；收口波复跑见下行叠注 |
| 六层门禁（sweep 两笔落地后的全量复核） | `node scripts/verify-all.mjs` | 收口波（2026-10-27）实跑：**exit 0——8 步全绿（①vitest ②typecheck ③lint ④build ⑤commit-audit range＋on-demand coverage/mutation/property）＋⑥探针 20 条 PASS 20/FAIL 0，耗时 356.2s**（log 存档 /tmp/verify-all-closeout-20261027.log） |
| 收口波⑤层 range 复跑（预提交） | `node tests/qa/commit-audit.mjs --range origin/main..HEAD` | 收口波实跑：**exit 0，`total=84 pass=84 skip=0 fail=0`**（＝落档波 82＋bcc40a4/db6f80f 两笔；收口笔自身走 hook 面，提交后终跑数字记提交回执） |
| 层①②③④⑥（落档波） | vitest／typecheck／lint／build／浏览器探针 | 落档波改动全为 .md，零代码行为面——未跑，如实声明；sweep 两笔（bcc40a4/db6f80f）的六层由上行 verify-all 全量覆盖 |

## 三 待主公裁决

1. **poteto 调研结论采信**（§1.1 已呈报）：是否采其机制入本仓——推荐见 §三.7。
2. ~~sweep 主体范围与判据~~：已按 §1.2 判据执行完毕（范围＝六目录＋tests＋scripts，.sh 未入——与 P3-b 同候裁）；本项转为已消费。
3. **依赖政令消费规则**（令 2 的执行面）：本波零新增依赖；未来任何依赖新增须自证「非常必要且属改进环境／改进验证／增加人类对 agent 信任」三类（AGENTS.md L0 已载），否则**询问人类**——本台账不设自决空间。
4. **rollout 遗留裁决位**（维持待裁，本波未处置）：P2-c（R6/commit-audit 触发点接入 ci.yml）／P3-b（Phase 3 范围 2 个 .sh）——仍留 [rollout §六](./comment-triage-rollout-20261025.md)原位；**P4-a（ci-verify.mjs:570 用途声明失真）经本波实测未处置**（该文件不在 bcc40a4/db6f80f 改动清单，:570 注释原样）——维持待裁，rollout §六 n 条目不回写。**【2026-11-06 勘注】P4-a 已裁 a 落地**（主公 2026-11-06 裁选项 a，`1e97868` 删 :570「（供 fixture 级单测复用）」括注；b/c 未采，详见 [rollout §六 P4-a 叠注](./comment-triage-rollout-20261025.md)）。
5. **ADR 附记二环境改进提议**：R9 保护面／known-issue 基线机制——**已提议、待主公明令，不执行**。
6. **【新增】只报告项处置**（§1.4 十二条＋各分区保护面只报告项）：测试名字符串失真（#6/#7）、死代码本体（#10/#11/#12）、恒真断言（#8）、决策回链块内失真残留（#1/#4/#5）等——是否翻案改写（涉保护面须主公令）或永久留档，待裁。
7. **【新增】源头抑制技能提案是否立项**（依 §1.1 implications 起草）：**推荐缓立**——poteto 式重技能（Comment Sicko 只读审查子代理＋/swarm 重构流）边际收益待观察（本波两段制已等价完成一轮全仓 sweep）；轻量路径零成本可先行：把 §1.2 判据 2「误导三型」补进 AGENTS.md 注释写作纪律或 [docs/conventions.md](../../docs/conventions.md) 分诊矩阵（纯文档、零依赖、不触依赖政令）。若主公令立项，再按依赖政令评估实现形态。

## 四 git 自查

- **落档波（2026-10-26，已提交）**：改动 `AGENTS.md`（L0 追加一行）、`adr-0001-github-committer-exemption-20261026.md`（新建）、`comment-triage-rollout-20261025.md`（§六 P2-e 两处回写）、本台账（新建骨架）。拆两笔 `0f5f339`（docs(adr)）／`0eb2edd`（docs(policy)），SHA 以 `git log` 实测为准。
- **sweep 落地（2026-10-26/27，已提交）**：生产面 `bcc40a4`（15 文件 17 处）＋测试面 `db6f80f`（16 文件 38 处），均精确逐文件 add、双钩子通过、未 push。
- **收口波（2026-10-27，本笔）**：改动本台账（§一/§二/§三/§四 回填）＋`.omo/doc-status-map-20260927.md`（【2026-10-27 叠注】登记本波新档）。`docs(omo)` 1 笔，`git log 8abcff6..HEAD` 实测枚举本波共 **5 笔**（0f5f339／0eb2edd／bcc40a4／db6f80f＋本收口笔）。
- 既有未提交变更（git status 实测：` M .gitignore`、`?? .omo/decisions-20261001.md`、`?? .omo/decisions-20261025.md`、`?? .omo/plans/pre-push-guard-decree-20261024.md`）全程零触碰；未 `-A`／`.`；永不 `--no-verify`；**未 push**（push 法令：须主公另行明令以 MASTER_PUSH_DECREE=1 执行）。
