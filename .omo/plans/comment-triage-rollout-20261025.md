# 注释分诊 Rollout 执行台账（comment-triage-rollout）

> 2026-10-25 立卷。方案真源：[`.omo/plans/comment-triage-practice-v2-20261024.md`](./comment-triage-practice-v2-20261024.md)（v2 终稿**原样存档**——含已知过期基线，纠偏一律记在本台账，不改存档）。本台账是四阶段 rollout 的唯一执行账本：每阶段落地动作、自决决策（证据 file:line 或命令输出）、验证证据、待主公裁决项。提交 `Plan:` footer 指向本文件。
>
> 角色：文档执笔（Phase 1，本波）／门禁工程师（Phase 2）／fresh-eyes 只读评审（Phase 3）／主公（裁决）。

## 〇 目标

一句话：本仓**不适用「一刀切删注释」**——删装饰、留契约、转结构、增量机械化。存量可删面极薄（复述≈0、死代码≈0、TODO=1），主体注释是三类治理资产（BR 探针头契约、决策编号＋plan 回链、代码表达不了的约束），主战场在**增量门禁**而非存量清理。

| 阶段 | 层 | 状态 |
| --- | --- | --- |
| Phase 0 存量盘点 | 调研 | 已完成（见方案 §四 Phase 0、§七命令清单） |
| Phase 1 立规范与对账 | 文档层 | **本波落地并提交（2026-10-25）**：审读通过后主公令提交，拆两笔——① `test(probes)` 三测试头＋BR-1 探针列登记；② `docs(comments)` 规范/纠偏/存档/台账。SHA 以 `git log` 为准 |
| Phase 2 增量门禁 | 机制层 | **本波落地并提交（2026-10-25 门禁工程师，主公令拆三笔 feat(qa)／chore(lint)／docs(omo)，SHA 以 `git log` 为准）**：R8 入 `tests/qa/commit-audit.mjs`＋`.git/hooks/pre-commit` 挂载；M2 入 `eslint.config.mjs`；M4' 守卫落地 `scripts/batch-clean-guard.mjs`。P2-a/P2-b/P2-d 由本波派单令裁定（见 §三），P2-c（ci.yml）不动、维持待裁决；未决验证项与 known-issue 处置见 §3.8＋§六 P2-e/P2-f |
| Phase 3 试点分诊 | 存量层 | 占位——Phase 2 后、按裁决启动 |
| Phase 4 复盘定策 | 决策层 | 占位 |

## 一 核对员漂移备案（执行前提，以实测为准；方案存档不改）

| # | 漂移项 | 本波处置 |
| --- | --- | --- |
| D1 | **【重大】方案引用的 `--branch dev` 基线（total=490 pass=476 skip=14 fail=0）已过期**：现 fail=1（4ac5acf，R1 subject 无前缀＋R7 空 WHAT:/WHY:/HOW: trailer），系 PR #22 squash 产物、历史 commit 内容，**非本波造成、不可由本波修复** | commit-audit 层绿色门槛改用 `node tests/qa/commit-audit.mjs --range origin/main..HEAD`（⑤层 verify-all 同款接线，`scripts/verify-all.mjs` ⑤层）；`--branch dev` 仅作对照，预期 fail=1 按 known-issue 记录。本波实跑见 §2.3 |
| D2 | Phase 3 试点范围「scripts/（7 文件 268 行）」口径须收严 | 实测 `ls scripts/` 9 文件＝**7 个 .mjs**（268 行注释系对 .mjs 精确复现）＋2 个 .sh（`vercel-ignore-build.sh` 40 行、`vercel-ignore-build.test.sh` 81 行，另有 39 行 `#` 注释）。Phase 3 范围写「7 个 .mjs」，2 个 .sh 纳入/排除待裁决（§六 P3-b） |
| D3 | Phase 1⑤ business-rules.md:33 失真修正 | 原文行号与内容均未漂移，照方案执行（§2.1 ④） |
| D4 | R8 实现细节 | `preR7Adoption`（commit-audit.mjs:399）与 `preR3StrictAdoption`（:403）双锚并存；`preR8Adoption` 直接追加第三锚，写法照抄 `authorDate.slice(0,10) <= <ISO日期>`。4ac5acf 作者日期 2026-10-24——任何 ≥2026-10-24 的 R8 锚都会祖父它；`--range origin/main..HEAD` 路径天然不含它。记入 §三 Phase 2 实现要点 |
| D5 | 沙箱可行性 | commit-audit branch/range 模式零 node_modules 依赖（仅 node:child_process/:fs/:path＋git），/tmp 副本可直接跑；`--message-file` 模式硬依赖 `pnpm exec commitlint`（commit-audit.mjs:353，ENOENT fail-closed）——沙箱彩排涉 hook 路径须先装依赖或预期 fail-closed。记入 §三 |
| D6 | eslint.config.mjs 现无任何 rules 块（纯预设展开＋globalIgnores） | M2 no-warning-comments 将是该文件**首个 rules 条目**（新增形态非合并）；globalIgnores 含 `tests/qa/**`（eslint.config.mjs:38）→ tests/qa 子树对 eslint 不可见，**B3 抑制扫描对该子树必须由 commit-audit 侧正则承担**。已写入 conventions.md 机械化指向节 |
| D7 | 既有未提交变更须避开 | `git status --porcelain` 实测 3 条：` M .gitignore`、`?? .omo/decisions-20261001.md`、`?? .omo/plans/pre-push-guard-decree-20261024.md`——本波零触碰（§2.4 自查） |
| D8 | `scripts/verify-all.mjs` ⑤层接线复核 | 已接 `commit-audit --range origin/main..HEAD`，方案触发面表无需修正 |

## 二 Phase 1 立规范与对账（文档层）——2026-10-25 本波

### 2.1 动作清单与改动文件

| # | 文件 | 改动 |
| --- | --- | --- |
| ① | `docs/conventions.md` | 新增「注释规范（分诊矩阵）」节：四条归格规则表＋删/留/转化三表＋机械化指向（R8/M2 待裁决）；插在「交叉引用」之前 |
| ② | `docs/anti-patterns.md` | (a) 追加 **L1-35「注释未分诊即动」**（引 L1-27 第 2 条行为保持前提＋AGENTS.md L0 BR 头不可动）；(b) L2-7 补 2026-10-25 机制注（入口守卫约定路径／备份定义 `.omo/backups/<timestamp>-<label>.tar`／清理役 SOP 前后各跑 `node scripts/verify-all.mjs`／「拦得住」如实收窄）；(c) 四段位对照表同步：文档段位 5→6、逐条对照 48→49、无机制索引 16→17、重修去向第 3 类 8→9、计数行、编号规约下一号 L1-36、文件头与「追加」节引言字面 |
| ③ | `AGENTS.md`（仅项目块） | L0 追加「`// BR:` 头注释（前 20 行内）不可动」；L1「约定与命名」指针加注「含注释规范：删/留/转化分诊矩阵＋四条归格规则」；新增小节「注释写作纪律」两条：不给未改动的代码加注释／只在 logic 不自明处加注释。**BEGIN:nextjs-agent-rules 块零触碰** |
| ④ | `docs/business-rules.md` | :33「R6 失效 = 阻断」按实测改写：R6 仅 branch/range 审计面执行、无自动触发点；commit-msg hook 只调 `--message-file` 跑 R1–R5/R7 **不跑 R6**；CI/pre-push 无调用；误删 BR 头不在提交时被挡 |
| ⑤ | `docs/business-rules.md` | BR-1 探针列追加「 + `lib/view-transition.test.ts`」（register 项登记） |
| ⑤ | `lib/view-transition.test.ts` | 头 :1-3 → 6 行新头，首行「// BR: BR-1 — 时序契约（原案①）…」，Source 行保留（**register**） |
| ⑤ | `components/ui/Alert.test.tsx` | 头 :1 「// BR: 案②…」→「// Contract: 案②…（组件渲染契约，非 BR-N 探针，不入 R6 探针列）」，Source 行保留（**rename**） |
| ⑤ | `tests/db/ta-transaction-feasibility.test.ts` | :21「// BR: 无（工程实验…）」→ 3 行「// Contract: 无业务规则探针（…BR-6 侧回归由 lost-update-mutex / turso-remote-race-feasibility 承载）」（**rename**） |
| ⑥ | `.omo/plans/comment-triage-practice-v2-20261024.md` | 新建：方案 v2 全文原样拷贝（`cmp` byte-identical，283 行） |
| ⑥ | `.omo/plans/comment-triage-rollout-20261025.md` | 新建：本台账 |

### 2.1.1 三案裁决链（BR 头差集处置——授权依据、裁决者、回滚路径）

方案 Phase 1⑥ 原文对三案「**只给选项不裁决**」（案①②若对应 business-rules.md 条目则补登记探针列＋改 BR-N 格式入 R6 保护，否则改非 `BR:` 前缀如 `// Contract:`；「BR: 无」否定声明建议改明确非 BR 前缀）。落地改动与该原文之间的裁决链如下——派单方 2026-10-25 确认：三案处置由文档执笔 ask 第⑤项原文授权、非走样。

| 要素 | 内容 |
| --- | --- |
| **授权** | 主公 2026-10-25 自执行令（本 wave 派单）＋方案 Phase 1⑥ 确定性规则。ask 第⑤项按该规则给出逐案终局裁决 JSON（`action: register` ×1、`action: rename` ×2，各附 `newHeader` 与 `evidence`），文档执笔无裁量 |
| **裁决者** | **对账员**：按 Phase 1⑥ 确定性规则逐案判定——案① 内容侧实证探证 BR-1 反面场景「弹框开启不与 VT 快照同窗」（`lib/view-transition.ts` afterViewTransition 机制本体、`docs/business-rules.md:11` BR-1 为唯一 VT 时序行、无第二候选）→ register；案② 七用例皆组件渲染契约、business-rules.md 全 12 行无对应规则 → rename；ta-transaction 系 TA_RACE_EXPERIMENT 门控采样实验、BR-6 探针列不含该文件 → rename。**对账复核**：独立复核员实跑验证（行号逐一对上、差集命令 `rg -n "view-transition\.test\.ts\|Alert\.test\.tsx\|ta-transaction-feasibility" docs/business-rules.md` exit 1 零命中、出生 plan `ls`/`rg -c BR` 零提及），独立放行三案；对 register 新头形态留非阻断备注（§2.2 决策 11） |
| **落地** | 文档执笔照裁决 JSON `newHeader` 逐字落地（§2.1 ⑤ 四行），register 项同步 business-rules.md BR-1 探针列追加 |
| **回滚** | **三案改动全部可逆、无代码行为面**：三份测试文件改动仅头部纯注释文本（`git checkout -- lib/view-transition.test.ts components/ui/Alert.test.tsx tests/db/ta-transaction-feasibility.test.ts` 即还原）；`docs/business-rules.md` BR-1 探针列删去「 + `lib/view-transition.test.ts`」即还原（须与 view-transition 头同步回滚，否则 R6 在 branch/range 面报 header missing）。行为面零变化由 §2.3 vitest 实证（14 passed / 8 skipped，exit 0） |

### 2.2 自决决策留痕（证据在括号内）

1. **M4' 入口守卫约定路径＝`scripts/batch-clean-guard.mjs`**。**授权依据**：文档执笔 ask 第②项原文「守卫此时可能尚未建——路径写约定的实际位置，门禁工程师会按同路径落地；若冲突以先落者为准并留痕」——属自治协议**可逆自决**范畴（纯命名约定、零代码落地、随时可改写回本行）。命名推理：方案 §3.2 M4' 只定义机制（入口断言 `git status --porcelain` 干净）未命名路径；仓内 `scripts/` 命名风格为 `<动作>-<对象>.mjs`（verify-all／ci-verify／sw-bust／fix-commit-heuristics／ttl-probe-seed，`ls scripts/` 实测）。写入 anti-patterns.md L2-7 机制注。**约定：Phase 2 门禁工程师按同路径落地；若届时已有先落实现，以先落者为准并在本台账 §三回写实际路径**。路径名本身不另设裁决项（§六 P2-d 议题已消歧为守卫机制是否落地启用）。
2. **anti-patterns 新条目编号 L1-35、标题取反模式形态**「注释未分诊即动（一刀切删注释 / 顺手「清理」契约头与决策回链）」而非中性的「注释分诊」——该文件每条皆失效模式（anti-patterns.md 编号规约「新增条目自 L1-35 续号」原文）。
3. **四段位对照表随新增条目同步**（48→49 等七处字面）而非只追加条目——该表自述为「全 N 条段位全景」，留旧计数即制造本仓最忌的文档失真（anti-patterns.md「挖错素材落注」c6eed4f＋9a4c3c7 教训）。L1-35 归文档段位、无机制档、重修去向第 3 类「段位重修候选·票面外」（R8＝架构段位 ⑤ commit-audit 扩展＋M2＝类型与 lint 段位，零新依赖；非 C 族候补池票）。
4. **AGENTS.md 两条写作纪律落为独立小节「注释写作纪律」**（置于 L1 路由指针与验证六层之间）而非塞进 L0——它们是写作侧纪律（对齐 Anthropic 官方模板），非「漏则破契约」的结构硬约束；BR 头不可动则按方案 P9 判定入 L0。
5. **L1 路由指针以扩写既有「约定与命名」行实现**而非另起一行指向同一文件——L1 节是一文件一行的 digest 形态（AGENTS.md L1 节 16 行逐一对应一份文档）。
6. **business-rules.md:33 改写零行号锚**：机制引用一律文件名＋函数名（`auditBrProbeBinding`、`.git/hooks/commit-msg` 只调 `--message-file`、源码注释自述「per-commit --message-file mode skips it」），不写 :270-271/:433 等行号——遵 anti-patterns「挖错素材落注」立下的「机制引用一律文件名＋describe／step 名」口径。保留一句勘误注「原文『commit-msg hook 同步阻止提交』与代码不符」留痕。
7. **方案存档原样不改**，即便含已知过期内容（§3.1/§七 `--branch dev` total=490 基线；Phase 3「7 文件 268 行」）——ask 明令「全文原样拷贝」；全部纠偏记本台账 §一。
8. **conventions.md 内的数字（≈0 / 7 处 / 15 处等）均锚到存档方案**（节首「真源」链接）——满足 conventions.md 自身「会话侧数字不入正文：无仓内落档锚点的计数不写入 tracked 文档正文」约定；存档一经提交即为仓内锚。
9. **conventions 表格引用例子逐一实查后才写入**（防「照抄文档未核代码」的失真传导，方案 §五.10）：`scripts/ci-verify.mjs:244` 判据 banner 逐字对上；`lib/game-net.ts:18-22` 8 s 论证；`app/layout.tsx:10` Chromium Bug 517439604；`db/schema.ts:33` W-RV P3 #9（方案引 :22-30，已漂至 :33，故文档不写行号）；`app/result/page.tsx:148` W-R D-3 JSX 注释；`lib/store.ts:94-100` makeMove JSDoc；空 catch 例实存于 `tests/qa/*.mjs`（3 处 page may already be closed）与 `tests/db/*.ts`（4 处 module may not have loaded）——方案表未注目录，conventions 表已补注。
10. **ta-transaction-feasibility 新头含「BR-6」字样对 R6 无影响**：R6 只遍历探针列登记文件（commit-audit.mjs:286-288 `for row.probes`），该文件不在任何探针列；且行首为 `// Contract:`，`rg "^// BR:"` 对账扫描不命中（§2.3 实测 Contract: 头恰 2 文件）。
11. **register 新头较先例多破折号续文**（先例 `components/HomeDialogMount.test.tsx:1`「// BR: BR-1, BR-9」极简形式）——按 R6 机械口径（首 20 行 `includes("BR-1")`，commit-audit.mjs:296/:300）与 business-rules.md:31 格式约定均合规；**对账复核**已独立放行（该非阻断备注出自对账复核 evidence，非阻断、照录），照裁决逐字落地。

### 2.2.1 审读修正记录（2026-10-25，台账层）

审读员 3 条意见逐条核验：**3 条属实、0 条反驳**，全部修正；本轮只动本台账，不碰 §2.1 已落地的 7 个 tracked 文件。

| # | 审读意见 | 核验 | 修正 |
| --- | --- | --- | --- |
| A1 | 决策 11 复核者错标「核对员」；三案处置裁决链／授权／回滚不可追溯 | **属实**。三案 evidence 作者自称「独立复核员」，派单方确认称谓为「对账复核」；「核对员」在本台账专指漂移调整清单作者（ask 原文「以核对员实测为准」），§一与 §2.3「核对员时点」用法保留。裁决链确未入账——方案 Phase 1⑥「只给选项不裁决」与落地改动之间断链 | 决策 11 改「对账复核」；新增 §2.1.1 三案裁决链（授权＝主公 2026-10-25 自执行令＋Phase 1⑥ 确定性规则；裁决者＝对账员＋对账复核独立放行；回滚＝头文本与探针列均可逆，须同步） |
| A2 | 决策 1 自决路径与 P2-d「或主公另定路径」同挂一路径，内部矛盾 | **属实**。P2-d 真实议题是 M4' 守卫**机制**是否落地启用（C12 候补池），非路径名；原表述把路径误带入待裁决 | P2-d 改写消歧：议题＝守卫是否强制启用＋备份是否强制，明示路径名已自决不另裁；§三前置补 P2-d |
| A3 | 决策 1 缺授权依据与可逆性标注 | **属实**。原文只写命名风格推理 | 决策 1 补注授权来源（ask 第②项原文逐字）＋「可逆自决」属性＋指向 P2-d 消歧 |

### 2.3 验证证据（本波实跑，2026-10-25）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| ⑤层绿色门槛（含 R6） | `node tests/qa/commit-audit.mjs --range origin/main..HEAD` | `ref=origin/main..HEAD total=71 pass=71 skip=0 fail=0`，exit 0；`grep -c "^FAIL  R6"` → **0**（register 项 R6 闭环成立） |
| `--branch dev` 对照（known-issue） | `node tests/qa/commit-audit.mjs --branch dev` | `ref=dev total=492 pass=477 skip=14 fail=1`，exit 1；唯一 FAIL＝4ac5acf0（R1 subject 无前缀＋R7 WHAT:/WHY: trailer 空），R6 finding **0**。较核对员时点 490/476 多 2 条（92bfbc9、40ac019 为其后新 commit），fail 数不变 |
| BR 头双向对账 | `grep -rl "^// BR:" <六目录>` × `grep -qF` 探针列 | **11 REGISTERED / 0 UNREGISTERED**（改前 10/13：3 未登记——view-transition 登记、Alert 与 ta-transaction 改 Contract:）；`^// Contract:` 恰 2 文件 |
| 层① vitest（三改动文件） | `pnpm exec vitest run lib/view-transition.test.ts components/ui/Alert.test.tsx tests/db/ta-transaction-feasibility.test.ts` | 2 files passed / 1 skipped（ta-transaction 默认 TA_RACE_EXPERIMENT 门控）；14 passed / 8 skipped；exit 0 |
| 层③ lint（全量） | `pnpm lint` | exit 0，零输出（0 error / 0 warning） |
| 提交信息草案预验（hook 同款路径） | `node tests/qa/commit-audit.mjs --message-file /tmp/comment-triage-p1-msg.txt` | PASS，exit 0（R1–R5/R7＋commitlint 第二检查点均过）。草案见 §六 P1-a |
| 存档完整性 | `cmp <report> .omo/plans/comment-triage-practice-v2-20261024.md` | byte-identical，283 行 |
| 未跑（如实声明） | 层② typecheck／层④ build／层⑥ 浏览器探针 | 本波改动为 .md 文档＋三测试文件**纯注释头**，无代码行为面；层①③已覆盖改动文件。提交前若主公要求可补跑 `node scripts/verify-all.mjs` 全六层 |

### 2.4 git 自查

- `git status --porcelain` 改前基线 3 条既有变更（§一 D7）本波零触碰；改动文件清单＝§2.1 表（7 个 tracked 文件修改＋2 个 .omo/plans 新建）。
- AGENTS.md `BEGIN:nextjs-agent-rules … END` 块零 diff（diff 全部落在 project-contribution-guidelines 块内）。
- 提交：审读通过后主公令（2026-10-25）执行，拆两笔、test 头收口先于 docs——两中间态 R6 均洁净（register 头与探针列登记同笔落地；Contract: 改名文件不在探针列、不受 R6 检查）。business-rules.md 两处改动分属两笔，以「暂还原 :33 → 暂存 → 重施 :33」非交互方式拆 hunk。精确 `git add` 逐文件、经 commit-msg hook（永不 `--no-verify`）、**未 push**。

## 三 Phase 2 增量门禁（机制层）——2026-10-25 门禁工程师本波落地

**裁决输入**：P2-a/P2-b/P2-d 由本波派单令（workflow ask）裁定——P2-a 取 **pre-commit hook 单挂**（派单令第 1/2 项：增量模式供 pre-commit 调用＋写钩子）；P2-b **采纳**（M2 入 eslint.config.mjs）；P2-d **落地启用**（守卫＋备份约定）。P2-c（ci.yml）派单令明令不动、维持待裁决；P2-e 维持「保持」现状（--range 门槛天然不含 4ac5acf；reword 涉已出仓历史须主公明令＋force push 法令，不在本波）。

### 3.1 动作清单与改动文件

| # | 文件 | 改动 |
| --- | --- | --- |
| ① | `tests/qa/commit-audit.mjs` | R8 入档：`R8_ADOPTION_DATE=2026-10-25`＋扫描范围/四判据/留格标记五常量；`parseAddedLines`/`scanR8` 两 helper；`--staged` 模式（pre-commit 面，读 `git diff --cached -U0` 新增行）；branch/range 模式对采纳日后 commit 逐笔 added-line 扫描（祖父静默跳过、merge 结构性豁免）；R8 advisory NOTE 与 M3' 报表输出行。`--message-file` 分支零改动（结构上先于 R8 分支 return） |
| ② | `tests/qa/commit-audit.test.ts` | 新增 3 用例（--staged 违规三子集 FAIL＋范围钉死 docs/ 不计；--staged 合法形态 PASS＋A1 advisory 白名单＋M3' 计数；--branch 采纳日边界 GIT_AUTHOR_DATE 双锚当日祖父/次日拦截）。既有用例零改动 |
| ③ | `.git/hooks/pre-commit` | 新建可执行（git 永不跟踪 .git/，全文录入 §3.6 供重建）：调 `node tests/qa/commit-audit.mjs --staged`；「exit 1 ∧ R8-STAGED: FAIL」→ exit 1 拦提交（fail-closed）；非判定组合（崩溃/node 缺失 exit 127/3 等）→ fail-open＋stderr `[r8-guard]` 标记 |
| ④ | `eslint.config.mjs` | 该文件**首个 rules 条目**（§一 D6 预判）：`no-warning-comments: ["error", { terms: ["todo","fixme","xxx"], location: "start" }]`（M2） |
| ⑤ | `scripts/batch-clean-guard.mjs` | M4' 入口守卫按 §2.2 决策 1 约定路径落地（先落者＝本波、无冲突、路径即约定路径）：`--check` 断言 tracked 干净否则列脏项 exit 1；`--backup <label> [-- <path>...]` 先同断言再打包 `.omo/backups/<timestamp>-<label>.tar`；导出 `assertGitClean`/`backupPaths` 供批量脚本编程式复用（同一判据无第二套） |

### 3.2 R8 实现面对账（§一 D4/D5/D6＋§三前置要点逐条）

- **正则逐字**：B1 `^\s*//\s*((const|let|var|import|export)\s+\w+.*[;{(]\s*$|console\.\w+\(|return\s+[\w.'"\`]+;\s*$)`、B2 `//\s*(Phase|Step)\s*\d`、B3 行含 eslint-disable 且无 ` -- `、A1 `//\s*(={5,}|-{5,}|\*{5,})`（半角）——与方案 §3.2 M1 及前置要点逐字一致，未放宽未收紧。
- **范围/形态**：diff 路径正则 `(app|components|lib|db|scripts|tests)/….(ts|tsx|mjs|js|cjs)`；blocking 仅 `//` 行注释（各正则自描述形态、行级应用＝dry-run 同口径）；JSX/块注释形态入 M3' 报表计数，A2 二期不实现（本波派单令 advisory 面＝A1＋M3'）。
- **祖父第三锚**：`preR8Adoption = authorDate.slice(0,10) <= R8_ADOPTION_DATE`，写法照抄 :399/:403 双锚；当日（2026-10-25）整日祖父——当日现存 0ca1dc3/6759b3b 两笔与任何今日补提交都落祖父带（pre-commit 面兜住过渡日）；merge commit 结构性豁免；祖父跳过静默、不增 SKIP 计数 → `--branch dev` 输出与改前基线 `diff` 逐字节一致（§3.4 实证）。
- **触发面**：pre-commit（--staged）＋branch/range post-adoption 逐笔 `git show --format= -U0 <sha>`（verify-all ⑤层即后者，R8 天然并入——采纳日后 commit 在 ⑤层同样受检，故无需另做 HEAD~1..HEAD 双挂）；`--message-file`（commit-msg hook）行为完全不变。
- **tests/qa 子树**：commit-audit R8 覆盖（D6：eslint globalIgnores 不可见面由 commit-audit 承担）——本波改动文件全在覆盖带内，自食其力验证见 §3.4 末行。
- **沙箱彩排**（D5）：branch/range 零依赖实测成立（fixture 仓无 node_modules 直跑成功，见 §3.4 测试项）；hook 的 --staged 路径亦零依赖（commitlint 只在 --message-file 分支），钩子 fail-open 语义覆盖其崩溃面。

### 3.3 自决决策留痕（编号续 §2.2；证据在括号内）

12. **钩子失效语义以「显式判定行」区分 fail-open/fail-closed**：Node 未捕获异常与「检出违规」同为 exit 1，单靠退出码不可区分——`--staged` 定死输出判定行 `R8-STAGED: PASS|FAIL`（干净=0+PASS、违规=1+FAIL、守卫崩溃=3＋`[r8-guard]` stderr），钩子按「退出码 ∧ 判定行」双因子裁决，非判定组合一律 fail-open。（实证：PATH 破坏实测 exit=127 走 fail-open 分支，§3.4）
13. **B3 判据词在 commit-audit 源内以 `eslint[-]disable` 写法、fixture 字符串拆分拼接**：B2/B3 是非锚定行级正则，本波新增行（正则字面量/测试字符串）会自触发自家门禁；`[-]` 语义等价、测试文件 `'// eslint-dis' + 'able-…'` 拼接、B1 锚定行首内联安全。（实证：B1/B2 对六目录含本波新文件的 dry-run 零命中；钩子对本波暂存实测 PASS，§3.4）
14. **M3' 报表口径**：分母＝新增行中全部注释形态（`//`、`/*`、`*` 连续行、JSX `{/*`）；「已标记」＝留格标记正则（决策编号族/BR 号/`.omo/plans/` 回链/判据）＋`// BR:` 头＋块/JSDoc 形态行；无阈值、无阻断、不预留收紧（方案 M3' 语义逐条对齐）。
15. **A1 白名单实现为回链标记正则而非枚举 3 处行号**：存量 32 处 banner 天然不入扫描面（advisory 只看增量新增行），白名单判据抽象为 `R8_RETENTION_RE`（含「判据」——ci-verify 判据节标题类），比行号枚举抗漂移。
16. **M2 级别取 error**：本仓 lint 门禁为 0-warning 口径（eslint.config.mjs 原 globalIgnores 注释 V4 F8 自述），error 与门禁语义一致且不依赖调用方 `--max-warnings` 参数。
17. **M4' 守卫允许 untracked（`??` 不拦）**：L2-7 原文「删 tracked 文件前先 commit，删 untracked/ignored 前先备份」——tracked 脏＝git 通道未走完必拒；untracked 是备份面对象非拒绝对象；ignored 内容仅显式传路径入包（防误吞 node_modules）。
18. **钩子不设 tracked 源副本**（pre-push 有 `tests/qa/pre-push-guard.sh` 先例）：派单令只令写 `.git/hooks/pre-commit`；钩子系 12 行薄壳、策略全在仓内 commit-audit.mjs，全文录入本台账 §3.6（tracked 载体即重建源），不另增文件面。
19. **暂不提交压过「先装钩子再提交」**：派单令末项「暂不提交。返回 MechWork（changedFiles 供沙箱拷贝）」为终态指令；钩子已先装（任何后续提交——MechWork/主公侧——天然走 R8 门，满足「先装钩子再提交」的时序），自食其力以「精确暂存本波 5 文件＋直调钩子」完成，未造临时 commit。

### 3.4 验证证据（本波实跑，2026-10-25）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 层① commit-audit 套件 | `pnpm exec vitest run tests/qa/commit-audit.test.ts` | **22 passed**（既有 14＋R8 新 3 用例），exit 0；fixture 仓无 node_modules 亦直跑成功（D5 沙箱可行性实证） |
| 层① 全量 | `pnpm test` | **Test Files 50 passed / 2 skipped；Tests 579 passed / 11 skipped**，exit 0 |
| `--branch dev` 对照（D1 known-issue 口径） | `node tests/qa/commit-audit.mjs --branch dev` | `ref=dev total=494 pass=479 skip=14 fail=1`，exit 1；**输出与改前基线 `diff` 逐字节一致**（R8 祖父零新增 fail）；唯一 FAIL＝4ac5acf0（R1 subject 无前缀＋R7 trailer 空，非本波造成、不可由本波修复）。派单令原文「必须 fail=0」系引过期基线，按 §一 D1 以 known-issue 口径记 |
| ⑤层绿色门槛 | `node tests/qa/commit-audit.mjs --range origin/main..HEAD` | `ref=origin/main..HEAD total=73 pass=73 skip=0 fail=0`，exit 0 |
| B1/B2 存量 dry-run 复跑 | `rg` 两正则扫六目录（含本波新文件） | **双零命中**（exit 1 无匹配）；B3 存量 7 处皆无 ` -- `＋本波测试文件新增 1 处带描述合法样例（合计 8、带描述 1） |
| M2 改前基线 | `pnpm lint`（改 eslint.config.mjs 前） | exit 0 零输出；**lib/store.ts 零 finding**——方案 P6「未实测推理」补上实测锚：前提成立 |
| M2 复跑 | `pnpm lint`（加规则后＋含新守卫文件） | exit 0；输出与基线 `diff` 逐字节一致（**零新增报错**）；lib/store.ts 仍零 finding（未触发回退条款） |
| M2 可证伪探针 | 注入行首 `// TODO: m2 probe` 跑 eslint | `1:1 error Unexpected 'todo' comment no-warning-comments`，exit 1；探针即删（规则真拦，非摆设） |
| 层② typecheck | `pnpm typecheck` | exit 0 |
| 钩子 fail-closed | 暂存违规 fixture（B1/B2/B3 三行）后直调 `.git/hooks/pre-commit` | 三条 `FAIL R8 B1/B2/B3`＋`R8-STAGED: FAIL`，**exit 1**；探针即清（index 还原） |
| 钩子 fail-open | `PATH=/nonexistent .git/hooks/pre-commit` | `node: command not found`＋`[r8-guard] …failing open`（stderr），**exit 0** |
| 钩子自食其力（正路径） | 精确 `git add` 本波 5 tracked 文件后直调 `.git/hooks/pre-commit` | `R8-STAGED: PASS`，exit 0（§3.5 git 自查节详录） |
| commit-msg 路径未破 | `node tests/qa/commit-audit.mjs --message-file /tmp/r8-wave-msg.txt` | **PASS**，exit 0（R1–R5/R7＋commitlint 双检查点；样例＝本波提交信息草案） |
| M4' 三面冒烟 | `node scripts/batch-clean-guard.mjs --check`（本仓 tracked 脏 / /tmp 干净 fixture / fixture 改脏） | 本仓拒 exit 1（列 4 条 tracked 脏项，含既有 .gitignore M——如实拒，正确）；fixture 干净 exit 0（untracked u.txt 不拦）；改脏后拒 exit 1 |
| M4' 备份冒烟 | `--backup m4-smoke -- u.txt`（/tmp fixture） | `.omo/backups/20261025-150421-m4-smoke.tar` 生成、`tar -tf` 含 u.txt；fixture 已清 |
| 未跑（如实声明） | 层④ build／层⑥ 浏览器探针 | 本波改动为门禁脚本/配置/测试三面，无应用运行时行为面；层①②③⑤已覆盖。主公令提交前可补 `node scripts/verify-all.mjs` 全六层 |

### 3.5 git 自查与提交序列

- **改前基线 3 条既有未提交变更（§一 D7）零触碰**：全程未 `git add -A`/`git add .`；未 add `.gitignore`、`.omo/decisions-20261001.md`、`.omo/plans/pre-push-guard-decree-20261024.md`；未 push、未 `--no-verify`、未 commit。commit-msg 与 pre-push 两既有钩子零改动；`.github/workflows/ci.yml` 零改动。
- **暂不提交**（决策 19）：派单令终态指令。提交信息草案已备并通过 `--message-file` 预验（§3.4），提交时按五步流程精确 add 逐文件、经 pre-commit（R8）与 commit-msg（R1-R5/R7）双钩。
- **changedFiles（沙箱拷贝清单）**：`tests/qa/commit-audit.mjs`、`tests/qa/commit-audit.test.ts`、`eslint.config.mjs`、`scripts/batch-clean-guard.mjs`、`.omo/plans/comment-triage-rollout-20261025.md`、`.git/hooks/pre-commit`（.git 不入版本库，随沙箱拷贝）。

### 3.6 钩子全文（重建源；git 永不跟踪 .git/，照录＋chmod +x 即复装）

```sh
#!/bin/sh
# pre-commit hook — R8 注释增量门禁（2026-10-25 入档，注释分诊 rollout 台账 §三）
# 策略真源: tests/qa/commit-audit.mjs R8（B1/B2/B3 blocking；A1/M3' advisory）
# 台账: .omo/plans/comment-triage-rollout-20261025.md
#
# 失效语义（定死）:
#   - 检出资违规则 → commit-audit --staged exit 1 且输出 "R8-STAGED: FAIL" →
#     exit 1 拦提交（fail-closed）。
#   - 守卫自身崩溃（node 缺失／脚本异常／无明确判定行）→ 不拦（fail-open），
#     stderr 带 [r8-guard] 标记说明——commit-msg hook（R1-R5/R7）仍是人类
#     提交入口的硬门，R8 崩溃不应连锁锁死提交通道。
# 重装（克隆/重建后）：git 永不跟踪 .git/ 内文件——本钩子全文已录入
# .omo/plans/comment-triage-rollout-20261025.md §三，照录重建＋chmod +x 即可；
# 钩子本体只是薄壳，策略全部在仓内的 tests/qa/commit-audit.mjs。
out=$(node tests/qa/commit-audit.mjs --staged 2>&1)
status=$?
printf '%s\n' "$out"
if [ "$status" -eq 0 ] && printf '%s\n' "$out" | grep -q 'R8-STAGED: PASS'; then
  exit 0
fi
if [ "$status" -eq 1 ] && printf '%s\n' "$out" | grep -q 'R8-STAGED: FAIL'; then
  exit 1
fi
echo "[r8-guard] R8 guard did not produce a verdict (exit=$status); failing open - comment gate not enforced this commit" >&2
exit 0
```

### 3.7 审读／沙箱回合记录（2026-10-25 第二轮：逐条修复与反驳）

**输入**：审读意见 0 条；沙箱未过项 1 条（#6 基线--branch-dev）。

**沙箱独立复证（通过面，收录为证据）**：首轮清单 5 个仓内文件拷贝 `cmp` 逐字节一致（CMP-OK ×5）；`.git/hooks/pre-commit` 拷入并 chmod +x；`core.hooksPath` 本地/全局均未设（钩子直跑即真实路径）；`--staged` 与 `--branch`/`--range` 全程零 node_modules（与我 §3.2／§一 D5 锚点一致）；沙箱伪造提交均落 gf-test 分支、dev 历史未变、真仓全程只读且 git status 与快照逐行一致、/tmp 已清——零污染。基线 3 条既有未提交变更（§一 D7）不在首轮清单、未拷入——符合预期（非本波交付物）。

**#6 未过项处置＝反驳（不实项），不改任何代码**：

1. **期望值引用过期基线**：「克隆内 `--branch dev` 须 fail=0」源自方案存档 §3.1/§七 的旧账口径（total=490 … fail=0）；核对员实测调整（§一 D1，派单令锚点原文）已明裁——该基线已过期，现 fail=1（4ac5acf 的 R1+R7），「commit-audit 层绿色门槛应改用 `--range origin/main..HEAD`；若仍须跑 `--branch dev` 作对照，预期 fail=1 并按 known-issue 记录」。沙箱期望沿用了被 D1 废弃的 fail=0。
2. **失败非本波造成、不可由本波修复，且非沙箱伪影**：唯一 FAIL＝4ac5acf0（GitHub PR #22 squash 产物，40ac019 于 2026-10-24 并入 dev）。本轮真仓复跑 `node tests/qa/commit-audit.mjs --branch dev` → exit 1、`ref=dev total=494 pass=479 skip=14 fail=1`、同一条 FAIL（R1 subject 无前缀＋R7 trailer `WHAT:` 空值缺 CJK），输出与本波第一轮 `diff` 逐字节一致；沙箱自身对照真仓复跑结论相同（其备注原文：「真仓 dev 历史×工作区新版脚本的既有事实，非沙箱拷贝伪影」）。
3. **豁免三类结构性不适用（本轮实测元数据钉死）**：`git log -1 4ac5acf` → author=pis1@qq.com（非 dependabot identity）；author-date=2026-10-24T18:16:03+08:00（> R7 锚 2026-09-23 故 R7 不祖父；<= R3 严格锚 2026-10-24 故 R3 走祖父分支——与该 commit 无 R3 finding 一致）；subject=`dev→main：…(#22)` 非 `Merge pull request #N` 形（squash 产物非 merge commit，MERGE_COMMIT_RE 不命中）。R1/R7 findings 是既有规则对历史内容的**正确执行**，非规则缺陷、非本波回归。
4. **修复面双锁死**：把 squash 产物并入豁免类＝改 R1/R7 语义，违反本波硬纪律「绝不破坏既有 R1-R7 任何行为」；reword／改史涉已出仓历史，须主公明令＋force push 法令（push 法令 §push）。该裁决位即 §六 P2-e（本波维持「保持」现状，选项留主公）。
5. **结论**：按 D1 口径，#6 的期望无效、实测符合预期（fail=1 known-issue）；绿色门槛 `node tests/qa/commit-audit.mjs --range origin/main..HEAD` 本轮复跑 `total=73 pass=73 skip=0 fail=0` exit 0。沙箱处置建议（「需主公/上游裁决（squash 并入豁免类或接受 fail=1 口径）」）与本台账一致——「接受 fail=1 口径」即 D1 已裁的现状，「并入豁免类」即 P2-e 待裁选项，均已在档，无需新裁决位。

### 3.8 未决项与提交回执（2026-10-25 第三轮：提交令）

- **未决项入裁决队列**：① 未决验证项＝层④ build／层⑥ 浏览器探针（§3.4 未跑声明）→ §六 P2-f（补跑方式：独立 worktree 跑 `node scripts/verify-all.mjs` 全六层，L2-13 禁主 worktree 在线 dev 服时跑 build；或主公豁免）；② known-issue 4ac5acf 处置 → §六 P2-e 扩为三选项（a 维持现状＝D1 已裁口径／b reword 须明令＋force push 法令／c squash 并入豁免类须主公令），本波维持 a。
- **提交令解除决策 19 终态**：第三轮派单令「现在提交本阶段改动（合规信息＋Plan footer；可拆 1-3 笔）」——拆三笔执行：feat(qa)（R8＋fixture 测试＋M4' 守卫）／chore(lint)（M2）／docs(omo)（本台账）。三笔均先过 `node tests/qa/commit-audit.mjs --message-file` 预验、经 **pre-commit（R8）与 commit-msg（R1-R5/R7）双钩**提交（钩子先装后提交，时序即「自食其力」）、精确逐文件 `git add`（未 `-A`）、**未 push**（push 法令：须主公另行明令）。SHA 以 `git log` 为准。
- **过渡日语义（by design）**：三笔 author date＝2026-10-25 → branch/range 面落 R8 祖父带（采纳日当日整日旧账口径）；其增量内容已在提交时由 pre-commit 面实检（与 §3.4 自食其力正路径同源），次日起 range 面不复检（by design，方案祖父条款语义）。

## 四 Phase 3 试点分诊（存量层）——占位

- 前置门（anti-patterns L1-27）：先过 `docs/business-rules.md` 清单对账确认行为保持前提。
- 范围：**`scripts/` 下 7 个 .mjs**（268 行注释）；2 个 .sh（39 行 `#` 注释）纳入/排除按 P3-b 裁决。
- 评审员＝不携带产出 session 上下文的独立只读评审 session（M5' 可操作定义），逐注释块判删/留/转化出 blocking/advisory 报告。
- 批量动作走 L2-7 git 通道（tracked 先 commit、untracked 先备份）；涉批量改写先 /tmp 沙箱彩排全绿再上真树；禁手搓行匹配（NIH 戒律）。
- 验证：前后六层门禁全绿；探针对照零行为差异；报告数字说话。
- 实收占位：删＿＿／留＿＿／转化＿＿（块数）。

## 五 Phase 4 复盘定策——占位

方案预判：可删项极少，止步 Phase 2 即达本仓最优；若 Phase 3 发现系统性 slop 类别再评估全量清理役。复盘写本台账 §五＋`.omo/doc-status-map` 登记。决策记录须含实收数字与六层门禁证据。

## 六 待主公裁决

| # | 事项 | 选项 / 草案 |
| --- | --- | --- |
| P1-a | **已裁决**：本波 Phase 1 提交（2026-10-25 审读通过，主公令提交） | 拆两笔执行：① `test(probes)` 三测试头＋BR-1 探针列登记；② `docs(comments)` AGENTS/conventions/anti-patterns/business-rules.md :33＋两份 .omo/plans 新建。两笔均先过 `node tests/qa/commit-audit.mjs --message-file` 预验再经 hook 提交；SHA 见 `git log`。未 push（push 法令：须主公另行明令） |
| P2-a | **已裁决（本波派单令 2026-10-25）**：R8 挂载点 | **pre-commit hook 单挂落地**（`--staged` 增量模式）。verify-all ⑤层无需另接：R8 已在 branch/range 模式对采纳日后 commit 生效，⑤层 `--range origin/main..HEAD` 天然覆盖（§3.2）；过渡日（2026-10-25 当日）commit 由 pre-commit 面兜住 |
| P2-b | **已裁决（本波派单令 2026-10-25）**：M2 入 eslint.config.mjs | 采纳落地——首个 rules 条目（error 级），改前/改后 lint 零新增、lib/store.ts 零命中前提实测成立、注入探针真拦（§3.4） |
| P2-c | R6 触发点接入 | A）ci.yml 加 job `commit-audit --range origin/main..HEAD`（PR→main 级自动）／B）维持手动＋清理役 SOP。注意 CI 仅 PR 触发，dev 直提只有 commit-msg hook。**派单令明令本轮不动 ci.yml——维持待主公裁决** |
| P2-d | **已裁决（本波派单令 2026-10-25）**：M4' 守卫机制落地启用 | 守卫＋备份约定落地 `scripts/batch-clean-guard.mjs`（§3.1 ⑤；路径＝§2.2 决策 1 约定路径，无冲突）。后续波若要求既有批量脚本**强制**接入守卫（enforcement 面），另立工单 |
| P2-e | 已知 known-issue 4ac5acf（含沙箱回合 #6 反驳条目） | 三选项留主公：a）**维持「保持」现状**（`--range` 门槛天然不含；R8 锚 2026-10-25 已祖父——§一 D1 已裁口径，本波即此态）；b）reword（涉已出仓历史，须主公明令＋force push 法令）；c）GitHub squash 产物并入豁免类（改 R1/R7 语义＋补豁免测试，须主公令——§3.7 反驳第 4 点修复面锁死的正路）。**本波维持 a，b/c 未动** |
| P2-f | **未决验证项（两轮未尽，2026-10-25 提交令同步入列）** | 层④ build／层⑥ 浏览器探针未随本波跑（§3.4 未跑声明：改动为门禁脚本/配置/测试三面、无应用运行时行为面；层①②③⑤已绿）。补跑方式：独立 worktree（L2-13——主 worktree dev 服在线禁跑 build）执行 `node scripts/verify-all.mjs` 全六层，或主公豁免。留裁决 |
| P3-a | Phase 3 是否启动 | 方案预判止步 Phase 2 即最优；启动则按 §四 |
| P3-b | Phase 3 范围 2 个 .sh | 纳入（含 39 行 `#` 注释）／排除（只 7 个 .mjs） |
| M6 | eslint-plugin-sonarjs | 方案不首推、属新 dev 依赖——**本波明确不采纳**，仅备案 |
