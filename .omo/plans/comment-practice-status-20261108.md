# 注释实践现状总览（comment-practice-status，2026-11-08）

> **时点**：HEAD＝`6ad1138`（dev）；远端 `origin/dev`＝`40ac019`、`origin/main`＝`4ac5acf`（本会话 `git ls-remote origin refs/heads/dev refs/heads/main` 实测）；本地领先 **23 笔、均未 push**。
> **底稿**：三路盘点（落地链 46 项／门禁实况 7 面／待裁清单 10 项，见派单材料）＋本会话逐条复核。标「本会话」的是这次实跑或实读的命令与输出；未标的数字取自所引台账原文。
> **性质**：只读汇总档。不改任何裁决、不代裁；凡「待主公」项只整理呈现。提交终值以 `git log` 为准。
> **关联档**：[practice-v2 方案存档](./comment-triage-practice-v2-20261024.md)／[rollout 执行台账](./comment-triage-rollout-20261025.md)／[误导注释 sweep 台账](./comment-misleading-sweep-20261026.md)／[ADR-0001](./adr-0001-github-committer-exemption-20261026.md)／[P2-c 调研存档](./p2c-remote-trigger-research-20261101.md)／[文档状态总图](../doc-status-map-20260927.md)

## 〇 结论先行

1. **方案生命周期收口**。v2 方案四阶段（Phase 1 规范与对账／Phase 2 增量门禁／Phase 3 试点分诊／Phase 4 复盘定策）加后续五波（10-27 依赖新政令、10-27 误导注释清扫、11-01 P2-c A＋远程触发点、11-06 P4-a、11-08 P3-b）全部落地。落地链 46 项：**已落地 39／待主公 6／明确不采纳 1**（M6 eslint-plugin-sonarjs）。rollout §六 10 个裁决位全部已裁或核销（rollout :420-429），总图 :238 已宣告「rollout 台账 §六 无未决项、全收口」。
2. **还剩 9 项须主公裁，可并成 6 组**。裁决位收口不等于动作做完：A＋落地遗留 3 件（push 批准／runner 首跑／升格 required），sweep 台账遗留 3 件（poteto 调研采信／源头抑制立项／只报告项处置），ADR-0001 附记二 1 件，盘点新暴露 2 件（.sh 补防线票未立项、`.gitignore` 他人未提交改动意图未知）。清单见 §一.2。
3. **门禁实况**。本地三钩齐（commit-msg／pre-commit R8／pre-push）；`node tests/qa/commit-audit.mjs --branch dev` 本会话实跑 exit 0，末行 `ref=dev total=515 pass=499 skip=16 fail=0`。**远程注释门禁还没生效**：commit-audit.yml 从未到过远端（本会话 `gh run list` 返回 404），ruleset 仍是 11 项。注释类门禁里，现在唯一在 PR→main 合并面有阻断力的是 M2——它借 ci.yml「Lint (ESLint)」job 生效，该 job 名在 ruleset 必需检查内。
4. **预判经两次实证**。slop 删除面极薄（scripts/ 63 块删 5）→ 不启动全量清理役；误导面不薄（全仓确认 108 条），但处置以对齐改写为主，不推翻「删除面极薄」，已由主公令 3 的一轮全仓 sweep 消化（落地 55 处）。见 §四。
5. **本波动作**。新建本档，另在 sweep 台账 :109 追加 1 处纯事实勘注（P2-c 已裁 A＋，此前未回写）；零代码改动、未提交、未 push。漂移 4 处（1 处本波已勘）与口径缺口 4 条列 §五.5。

## 一 待主公决策最新清单

### 1.1 已裁四项（终态一行）

| 裁决位 | 终态 | 裁决日 | 出处 |
| --- | --- | --- | --- |
| P2-e | 留——第四类豁免 `8abcff6` 留任，越线自决追认收口，revert 路径关闭 | 2026-10-26 | rollout :425；ADR-0001 :9 |
| P2-c | A＋——独立 workflow `.github/workflows/commit-audit.yml`（`e4894ea`），advisory 起步，ci.yml 零改动 | 2026-11-01 | rollout :423 |
| P4-a | a——删 `scripts/ci-verify.mjs:570`「（供 fixture 级单测复用）」括注（`1e97868`） | 2026-11-06 | rollout :429 |
| P3-b | D——纳入＋声明（正式口径＝06c7358 评审面 scripts/ 9 文件；.sh 门禁盲区写入 conventions.md:73） | 2026-11-08 | rollout :428；`6ad1138` |

其余 6 位（P1-a／P2-a／P2-b／P2-d／P2-f 核销／P3-a）均于 2026-10-25 裁毕（rollout :420-427）。

### 1.2 待主公裁决（9 项／6 组）

| # | 组 | 问题 | 选项（摘） | 推荐 | 证据 |
| --- | --- | --- | --- | --- | --- |
| 1 | A＋收尾链 | dev 本地 23 笔是否批准 push（11-01 收口时记 18 笔，现已积压到 23） | a）明令后以 `MASTER_PUSH_DECREE=1` 推 dev，push 前后 tip 以 `git rev-parse` 留痕——解锁 #2／#3，出仓后要撤回须再走 force push 法令；b）继续积压——零风险，但 23 笔只在本机、远程防线持续空转 | **a**。建议执行时 push 前先复跑一次 `node scripts/verify-all.mjs`：末次全链 exit 0 记录在 11-01 收口波（rollout :423），之后 `1e97868` 改了 1 行代码注释，只经双钩实检（rollout :429 无 verify-all 记录）。须主公明令，agent 不得自推 | rollout :423 pending ①；本会话 `git rev-list --count origin/dev..HEAD`＝23、`git ls-remote` dev＝`40ac019`；AGENTS.md:27 |
| 2 | A＋收尾链 | commit-audit.yml 真实 runner 首跑实证（从未跑过） | a）并入 push 执行链：push→dev 自然触发，绿即核销；红则按 `fatal: ambiguous argument 'origin/main..HEAD'` 浅克隆形态诊断；b）与 push 一并挂起 | **a**——首跑是 #3 升格的前置证据（runner 裸 fetch、checkout@v7 refspec 属调研未覆盖面） | rollout :423 pending ③；本会话 `gh run list --workflow=commit-audit.yml` → `HTTP 404: workflow commit-audit.yml not found on the default branch`；本会话 `gh api …/actions/workflows` 远端只有 `CI` 与 `Dependabot Updates` |
| 3 | A＋收尾链 | 是否升格 required：PUT `rulesets/23195249` 追加「Commit audit (commit-audit --range)」→ 12 项 | a）升格——PR→main 真阻断；没有首跑实证就盲升，runner 实况一旦意外会阻断合并；b）维持 advisory（红可见、不阻断） | **先 b 后 a**：#2 首跑绿了再升格。须主公亲操或明令，check 名按精确字符串一字不改（`311d91c` 命名错位先例） | rollout :423 pending ②；commit-audit.yml:8-11；本会话 `gh api …/rulesets/23195249` → `main-gate`、enforcement `active`、required 11 项、无该名 |
| 4 | sweep 调研反哺 | poteto 调研结论（主公 10-26 亲令）是否采信 | a）采信（含身份纠正 poteto＝Lauren Tan；「全禁不适用本仓」沿 practice-v2:46 先裁）；b）只留档 | **a**——五条 implications 与 sweep 实收同向互证，也为 #5 的轻量路径铺路 | sweep :24-50、:106；令 3 原话 :11 |
| 5 | sweep 调研反哺 | 源头抑制（生成时就压住注释）是否立项 | a）缓立重技能，轻量路径先行：把「误导三型」判据补进 conventions.md 分诊矩阵或 AGENTS.md 注释写作纪律（纯文档、零依赖）；b）立项 poteto 式重技能（Comment Sicko 只读子代理＋/swarm）——若涉新依赖须按 AGENTS.md:29 三类自证，否则询问人类 | **a**（台账原推荐）；重技能等出现新的系统性 slop 类别再评估（与 rollout §5.4 定策同口径） | sweep :112、:50 |
| 6 | sweep 只报告项 | 只报告项的终态：翻案改写（涉保护面须主公令）还是永久留档。范围按 §三.6 原文＝§1.4 十二条＋各分区保护面只报告项（如 §1.3 db 行候选 1/2「维持只报告」，未入 §1.4 表） | a）永久留档——保护面纪律不破，但 12 条（high 11／medium 1）永留码面；b）逐条翻案改写（决策回链块 #1/#4/#5、测试名 #6/#7 涉保护面），须单独波次逐条两半验证；c）只把死代码本体 #10/#11/#12 另立代码债票 | **a 为主；在意失真则 c**——判据 3／5 已把保护面与代码债划出注释 sweep 范围；死代码是行为面债，另票处理比翻案保护面干净 | sweep :74-91、:111、:57-58、:67 |
| 7 | ADR 附记二 | R9（政令／越线自决 trailer 硬拦）与 known-issue 基线是否令实施 | a）维持不执行（储备）；b）令实施 R9（`MASTER_DECREE=1` 形态，同 push 法令）；c）令实施 `--baseline` 清单 | **a**——基线没有已知消费场景（ADR :75 自述）；R9 对应的缺口（教训 3，ADR :70）真实但不迫切，可在下次门禁面改动波顺带复议 | ADR :72-77；sweep :110；本会话 `grep -n 'R9' tests/qa/commit-audit.mjs` 零命中 |
| 8 | .sh 盲区 | 3 个 tracked .sh 零机械覆盖，是否开「补防线」票（所谓「另一票」在仓内零落档） | a）维持声明现状——盲区已写入 conventions.md:73，语义层靠 fresh-eyes 兜底；b）开票——最小零依赖形态是给 `tests/qa/commit-audit.mjs:158` 扩展名组加 `sh`；引 shellcheck 类工具须按依赖政令另问 | **默认 a**（P3-b 主公选的是「纳入＋声明」而非补防线）；若开票，限 b 的零依赖形态——动门禁规则须主公令（ADR 附记一教训 3） | rollout :428；conventions.md:73；本会话 `grep -rn -E '另一票\|补防线\|sh 门禁' .omo/ docs/` 零命中 |
| 9 | 工作区知悉 | 他人未提交的 `.gitignore` 改动（删掉已提交版 :115-116：OPS-IGNORE 备案注释＋`/.omo/decisions-20261001.md` 忽略行）意图未知，如何处置 | a）维持现状（各波零触碰先例，以已提交真源为准）；b）主公认领并说明意图——裁留须同时裁 `decisions-20261001.md` 是否入档（档内自述永不 commit），或裁撤；c）不是主公改的就还原 | **先澄清再处置；澄清前维持 a**——这处改动一旦被提交，`decisions-20261001.md` 就脱离忽略面，与已提交的 OPS-IGNORE 口径直接冲突 | 本会话 `git diff .gitignore`（−2 行）与 `git show HEAD:.gitignore`；rollout :439（决策 38）；ADR :62；rollout :29（D7，10-25 起即存在） |

**【2026-11-08 裁决叠注】§1.2 九项终态（主公 2026-11-08 /workflow『全部执行』令；执行实况以推送执行员／首跑观察员／升格执行员回执为准，本块只落终态）**

1. **#1 push：已批准并执行完毕**——六层 verify-all exit 0（绿）＋队列核验 `git rev-list --count origin/dev..HEAD`＝24（恰 24 笔；§6.1 的 23 笔系立卷时点，含总览入档笔 `e71726f` 后终值 24）→ `MASTER_PUSH_DECREE=1 git push origin dev` 成功：普通 push 快进 `40ac019..e71726f`、零 force；回验 `git ls-remote origin refs/heads/dev`＝本地 HEAD `e71726f1120052322784583818fb9a95b991543e`。他人 4 件未提交变更（§五.4）全程原样未碰。
2. **#2 首跑：成功（绿）**——run `42494216534`（push 事件、headBranch=dev、headSha 与 ls-remote 逐字符一致）：全 7 步 success，job 9s；远端 `node tests/qa/commit-audit.mjs --range origin/main..HEAD` 汇总 total=95 pass=95 skip=0 fail=0（调研底数 85/85 系 dev 其后又前进 10 笔，fail=0 双口径一致）。调研未覆盖面①checkout@v7 refspec 已实证（v7 实解析 SHA `3d3c42e`、fetch 为 getRefSpecForAllHistory 全量双 refspec、origin/main 建立，与按 main 源码推断一致）；面②runner 裸 fetch 依旧未实测（配方以 fetch-depth:0 规避且规避路径已在真实 runner 验证有效），是否补实证留主公裁。
3. **#3 升格：已执行**——PUT `rulesets/23195249` 追加「Commit audit (commit-audit --range)」成功：required 11→12 项（新项 idx=11）、权威名与 `.github/workflows/commit-audit.yml:36` 及 run 唯一 job name 逐字一致（无 `311d91c` 式命名错位）、enforcement 仍 active、GET 回验原 11 项及其余字段零变动。PR→main 合并面自此对该检查真阻断。
4. **#4 poteto 调研：已裁采信（a）**——结论整体采信（含身份纠正）；sweep §三.1 已叠注。
5. **#5 源头抑制：已裁缓立（a）**——重技能不立项，等新的系统性 slop 类别再评；轻量路径仅备注可选、本波不落地；sweep §三.7 已叠注。
6. **#6 只报告项：已裁永久留档（a 为主）**——sweep §1.4 十二条维持永久留档＋db 行候选 1/2 维持只报告；死代码本体（#10/#11/#12）属行为面债、另票口径（未来处置属新票新令，本波不开票）；sweep §三.6 已叠注。
7. **#7 ADR 附记二：已裁不实施（a）**——R9 与 known-issue 基线维持储备；ADR 附记二已叠注关闭。
8. **#8 .sh 补防线票：已裁不开**——维持声明现状（conventions.md:73 盲区声明＋fresh-eyes 兜底）。本表原文「所谓『另一票』在仓内零落档」自本令起事实修正为**主公已裁不开**——零落档状态自此有了裁决口径。
9. **#9 `.gitignore` 他人未提交改动：仍待主公澄清——唯一人裁残留**。『全部执行』令未含此项处置；push 执行波全程原样未碰（`git status` 实测四件与 §五.4 快照一致），澄清前维持 a。

### 1.3 分诊为非待裁（备案，不呈裁）

- **依赖政令消费规则**（sweep §三.3 :108）：规则就是主公令 2 原话（sweep :10），AGENTS.md:29 已载同款；没有选项冲突，也没有动作面——维持备案。
- **文档滞后勘注**（§五.5 D-2／D-3，anti-patterns.md 状态行）：属事实同步，可按 `048527d`「附带自决·主公可令回退」先例交后续文档波处理；若涉段位分类重算且有疑义，再问。

## 二 方法论谱系

### 2.1 立场三派（practice-v2 §一 1.1-1.3 浓缩）

| 派 | 核心主张 | 代表（practice-v2 行号） |
| --- | --- | --- |
| 删除派（激进） | 注释是表达失败；默认处死 | Robert C. Martin《Clean Code》ch.4「Comments are always failures」（:55）；pstack 上游 `/no-comments`＋只读子代理 Comment Sicko「默认处死＋五类窄例外，存疑即删」（:57，一手最系统）；sarahfim 反 slop 工厂（:56）；anatomy 项目「no comments in code」（:58）；HN 上的 AI 时代变体——删光省 token、否定式注释诱导 agent（:59） |
| 保留派 | 注释是设计与思维工具 | Ousterhout《A Philosophy of Software Design》ch.13「Comments Should Describe Things that Aren't Obvious from the Code」（:63，保留派最系统的一手著作）；bugzmanov 系统反驳 Clean Code（:64）；pi-agent-book（:65）；Mario Zechner 移植工作流（:66）；AI 时代价值上升派（:67） |
| 分诊派（业界主流） | 按类处置：why 留、how 删 | Atwood「Code tells you how, comments tell you why」（:71）；Henney（:72）；Google Python Style Guide §3.8（:73，制度化范本）；Linux kernel ch.8（:74，口径是 WHAT-not-HOW，与 Atwood 的 WHY-not-HOW 有细别）；Anthropic 官方提示模板（:75——本仓 AGENTS.md:50-53 两条写作纪律即其落地） |

主公知识库立场（:77-81）：**分诊派、偏删、带三重工程纪律**（NIH 戒律／沙箱彩排／测试锚点不得依赖可清理内容）。本仓据此判定「全禁派不可行」，理由是会摧毁决策编号体系与 plan 回链，而不是 R6 会阻断提交（:46 已纠正初稿）。

### 2.2 共识区与争议区（practice-v2 :85-87）

- **共识区**（存档原文为四条、按共识度排序；派单结构稿写「三条」，以原文为准）：① 注释掉的代码必删（SonarQube S125 Major 等）；② 公共 API doc、非显然理由与性能取舍该留（五方独立收敛）；③ 复述代码的注释该删——口头一致，**机械化无解**；④ AI slop 注释现象已确立，治理呈「上游抑制（提示词）＋下游门禁」双层。
- **争议区**（两条）：① 注释整体存废——规范性争论；② AI 时代 why 注释的价值——「删光省 token、防误导」对「帮 agent 理解意图」，未收敛，按「why 留、how 删」兜底。
- **两处真实矛盾**（:91-95，不强行调和）：poteto 谱系里「全禁」转述与一手「默认处死＋窄白名单」不一致——采信优先级为一手代码＞一手技能文件＞书笔记＞评论区转述；Anthropic 双面口径——裁为「裸抑制转化，带理由抑制留」（本仓 B3 即此口径）。

### 2.3 10-26 poteto 调研定案（载体＝sweep §1.1 :24-50，未另立调研档）

sweep :24 标题与总图 :235 同口径自述「未单独立调研档，结论内嵌本节」。主公 2026-10-26 令 3 下令（sweep :11），10-27 收口波补做。

- **身份纠正**（:26）：poteto＝Lauren Tan（前 Meta/Stripe、现 Cursor 工程师、pstack 作者）；立卷时「Hiroshi Tsubokura／zenn 系」的猜测不成立。
- **机制全在技能／工作流层，没有 lint/CI 强制**（:30-34）：`/no-comments` skill（:30）＋只读子代理 Comment Sicko（:31）＋poteto-mode SKILL:117-119 禁装饰与叙述性注释（:32）＋`/swarm` 重构流（:33）；她自带的代码 3,661 行 TS 只留 23 行注释（0.63%，全是例外清单类型，:34）。
- **禁止原因**（:38-42）：agent 爱复制既有内容（含过期注释）当捷径；解释 workaround 的注释会像杂草一样蔓延；真问题应修根源；例外只限问题确实不在自己控制范围内；叙述性注释让 diff 显得没做完。
- **对本仓的含义**（:46-50）：同向验证（108 条确认里多类正是「复制／过期」机制）；全禁不适用（治理资产由行内注释承载）；她的例外清单与本仓留格规则部分对应；争议面如实呈报（Sentry David Cramer 反对）；**机制层缺口**——「误导性」要对照代码实况做语义判断，R8/M2 只覆盖机械面，没有自动门禁能拦。这是 §一 #5 立项建议的出发点。

## 三 工具栈对照

### 3.1 业界现成工具

| 工具 | 能拦 | 局限 | 本仓处置 |
| --- | --- | --- | --- |
| SonarQube S125（Major） | 注释掉的代码 | 只覆盖死代码一类，不判复述与误导；须接 SonarQube／SonarCloud 扫描面——本仓零接入（本会话 `grep -rni sonar package.json .github/workflows/ eslint.config.mjs` 零命中） | 只作「死代码必删」的依据引用（practice-v2:85、:112）；死代码形状由 R8-B1 承担 |
| eslint-plugin-sonarjs `no-commented-code`（M6） | 同上（ESLint 内） | 启发式有已证实的误报（分号结尾注释）与漏报（TS 对象属性）；属新 dev 依赖（practice-v2:194） | **明确不采纳，仅备案**（rollout :431）；若重提须过依赖政令三类自证（AGENTS.md:29） |
| ESLint `no-warning-comments`（M2） | 行首 TODO／FIXME／XXX | 拦不住块内 TODO 与拆词绕过「to do」（practice-v2:178）；`tests/qa` 在 globalIgnores 内不可见（eslint.config.mjs:9-15）；.sh 不在面 | **已采纳**（eslint.config.mjs:17，error 级） |
| LLM 语义层技能族（pstack `/no-comments`＋Comment Sicko；gajae-code ai-slop-cleaner 7 类 taxonomy） | 复述、装饰、叙述、误导等语义类 | 没有机械判据、不可证伪，靠清单纪律（practice-v2:192）；要在生成时载入 agent 才有源头抑制效果（sweep :30、:50） | 语义层由 M5' fresh-eyes 一次性评审承载；生成时抑制未立项（§一 #5） |

通则：没有任何主流 linter 能判断注释是否在复述代码（practice-v2:47、:172）——「复述注释该删」所以一直停在口头共识。

### 3.2 本仓自建栈（位置均为本会话实读）

| 件 | 位置 | 触发面与现状 | 拦得住 | 拦不住 |
| --- | --- | --- | --- | --- |
| R8 注释增量门禁 | `tests/qa/commit-audit.mjs` :157 采纳日 2026-10-25、:158 扫描面正则、:549 `preR8Adoption`、:507／:510 `R8-STAGED: FAIL／PASS` | ① pre-commit `--staged`：**生效**（`.git/hooks/pre-commit` 1356B；:6-11 违规 fail-closed、守卫自身崩溃 fail-open）；② verify-all ⑤层 `--range`：手动；③ commit-audit.yml 远程 job `--range`：**未生效**（文件没到远端），生效后也只是 advisory | 六目录 × ts/tsx/mjs/js/cjs 新增的 `//` 行：B1 死代码形状／B2 `(Phase\|Step)\s*\d`／B3 eslint-disable 缺 ` -- ` 描述（blocking）；A1 banner 与 M3' 无标记占比只报不拦 | 语义（复述、误导）；块注释与 JSX 注释不在 blocking 内；.sh 与 .md 不在扫描面；新克隆没重装钩子则①失效（rollout :423 选项 B 缺点②） |
| M2 | `eslint.config.mjs:17` | 本地 `pnpm lint`＋ci.yml「Lint (ESLint)」job（PR→main，ci.yml:3-5、:16、:27）；该 job 名在 ruleset 必需检查内 → **注释类门禁里现在唯一在合并面有远程阻断力的一门** | 行首 TODO／FIXME／XXX | 块内 TODO；tests/qa；.sh |
| R6 BR 头双向绑定 | `docs/business-rules.md:33`；对账 11/11（rollout :90） | 只在 branch/range 面跑（手动 verify-all ⑤层或 `--branch`；远程 job 未生效）；commit-msg hook 不跑 R6 | 探针列登记的 BR 头被删或错绑 | 提交时不挡——靠 AGENTS.md:28 的 L0 条守住 |
| M5' fresh-eyes 评审 | rollout §4.2（:318-338） | 一次性只读评审（评审时点 `06c7358`，scripts/ 9 文件） | 机械规则判不了的语义层 | 不可证伪、非常驻；`tests/qa/pre-push-guard.sh` 从未评审 |
| 第四类豁免（committer 身份） | `commit-audit.mjs` :109 `GITHUB_COMMITTER_EMAIL`、:231-232 短路、:572 SKIP 行；ADR-0001 Accepted（:9） | branch/range 面；`--message-file`（人类提交入口）不受任何豁免（docs/commit-policy.md:119） | GitHub squash 产物（如 `4ac5acf`）的 R1/R7 历史误报 | ——（人类本地提交的 committer 恒为本人，结构性不可命中，rollout :425） |
| M4' 批量清理守卫 | `scripts/batch-clean-guard.mjs`（100 行，`--check`／`--backup`） | 自觉调用（P2-d 已裁落地启用；既有批量脚本强制接入另立工单，rollout :424） | 经脚本入口的批量清理：tracked 脏即拒；untracked 打包到 `.omo/backups/<ts>-<label>.tar` | 不经入口的未知进程删除（anti-patterns.md:219 机制注自述收窄） |
| B3 存量补理由 | rollout §3.9.1（:236-246） | 一次性存量收尾（`06c7358`） | 7 处 eslint-disable 从 7/0 补到 7/7 带 ` -- ` 理由 | —— |
| 依赖新增政令 | AGENTS.md:29；ADR-0001 :77 附记二引同款；sweep :108 消费规则 | 政令（文档层，无机械防线） | 新增依赖须自证属「改进环境／改进验证／增加人类对 agent 信任」三类，否则询问人类 | 靠纪律执行 |
| 写作纪律两条 | AGENTS.md:50-53 | 提示词层的上游抑制 | 「不给未改动的代码加注释」「只在 logic 不自明处加注释」 | 不可机械验证 |

## 四 预判验证记录

**预判**（practice-v2:222，Phase 4 动作）：「可删项极少，止步 Phase 2 即达本仓最优；若发现系统性 slop 类别再评估全量清理役。」

| # | 实证 | 范围与方法 | 实收 | 落地 | 出处 |
| --- | --- | --- | --- | --- | --- |
| 1 | Phase 3 试点分诊（slop 删除面） | `scripts/` 9 文件（7 .mjs＋2 .sh，P3-b 裁 D 后的正式口径）；M5' fresh-eyes 只读评审，评审时点 `06c7358` | 63 块：删 5（7.9%）／转化 0／留 58；教科书五类（死代码／TODO-FIXME／裸抑制／阶段叙述／reviewer 临时说明）全零命中 | `fa0d4e9`：4 个代码文件 5 处＋台账（本会话 `git show --stat`：5 files，+37／−7） | rollout :318-338、§5.4 :385-399 |
| 2 | 误导注释全仓 sweep | 7 分区；两半验证定谳＋误导三型判据（过期复述／失真声明／超前用途） | 候选 109＝确认 108＋证伪 1 | 55 处：生产面 `bcc40a4`（15 文件 17 处，+58／−48）＋测试面 `db6f80f`（16 文件 38 处，+139／−136），diffstat 为本会话实测；§1.4 登记只报告 12 条 | sweep :52-91 |

**结论**：

- 实证 1 **证实**预判 → 不启动全量 slop 清理役，存量层止于已完成的试点一波（rollout :397-398）。
- 实证 2 揭示了另一个维度：误导面不薄（确认 108 条），但它的性质是代码演进后的「过期／失真／超前」，处置以对齐改写为主（sweep :69 tests 除 qa 分区「30 改写＋1 删＋1 只报告」是台账里唯一单列处置分布的分区），并不推翻「删除面极薄」。这一面已由主公令 3 的一轮全仓 sweep 消化（sweep :21 阶段 2 ✅），源头抑制待 §一 #5 裁。
- **口径提醒**：108（确认条）、55（落地处）、12（只报告条）单位不同，台账内没有逐条映射（sweep :91 自述 evidence 全文在台账外的扫描交付材料），不能拿 55＋12 与 108 相减推断有无遗漏——已列 §五.5 口径缺口。

## 五 遗留与盲区

### 5.1 .sh 零机械覆盖（补防线票未立项）

- 全仓 tracked .sh 恰好 3 个（本会话 `git ls-files '*.sh'`）：`scripts/vercel-ignore-build.sh`、`scripts/vercel-ignore-build.test.sh`、`tests/qa/pre-push-guard.sh`。
- 机械面：R8 扫描面正则 `commit-audit.mjs:158` 的扩展名组不含 sh；M2 不扫 .sh；CI 与 verify-all 也没有 .sh 检查（conventions.md:73）。
- 语义面：只有 `06c7358` 那次一次性评审覆盖过 scripts/ 下的 2 个；`tests/qa/pre-push-guard.sh` **从未评审**，而它是 `.git/hooks/pre-push` 的真源（hook :2-3 自述），也就是 push 法令机械防线本体。
- 票状态：P3-b 裁 D 只落地了声明（conventions.md:73，`6ad1138`）；「补防线属另一票」在仓内零落档（本会话 grep 零命中）→ §一 #8。

### 5.2 R9 未点头

ADR-0001 附记二两项（R9 trailer 硬拦、known-issue 基线）「已提议、待主公明令，不执行」（ADR :72-77）；`commit-audit.mjs` 里没有 R9（本会话 grep），R1-R8 全占。教训 3「门禁规则改动与业务代码同走一笔，可借门禁压力自我豁免」（ADR :70）对应的缺口仍敞开 → §一 #7。

### 5.3 只报告项

sweep §1.4 登记 12 条（high 11／medium 1；其中 #8 注释本身如实，债在恒真断言），另有各分区保护面只报告项（sweep :111 原文；如 :67 db 行候选 1/2）。类型分布：决策回链块内失真 #1/#4/#5、路由词汇与计数过期 #2/#3、测试名字符串 #6/#7、恒真断言 #8、自引用行号未核 #9、死代码本体 #10/#11/#12 → §一 #6。

### 5.4 工作区他人未提交变更（知悉项）

本会话 `git status --porcelain` 与会话起始快照逐字一致：` M .gitignore`、`?? .omo/decisions-20261001.md`、`?? .omo/decisions-20261025.md`、`?? .omo/plans/pre-push-guard-decree-20261024.md`，本波零触碰。`.gitignore` 改动意图未知 → §一 #9。`.omo/decisions-20261025.md` 是 10-25 终审修复笔 `git rm --cached` 后留在运行区的档（rollout :439 决策 38），按运行区口径不入库。

### 5.5 漂移清单与勘注建议

| # | 位置 | 漂移 | 性质 | 处置 |
| --- | --- | --- | --- | --- |
| D-1 | sweep 台账 :109（§三.4） | P2-c 仍写「维持待裁」，但 11-01 已裁 A＋，未回写——同行 P4-a、P3-b 都已有勘注；sweep 台账的修改史只有 `0f5f339`／`3a81f1b`／`3f957a8`／`6ad1138`，11-01 那波没碰过它（本会话 `git log -- <sweep 台账>`） | 纯事实、1 处 | **本波已勘**：行末追加【2026-11-08 勘注】一句，原文零改写（沿 `3f957a8`／`6ad1138` 在同一行的先例） |
| D-2 | docs/anti-patterns.md :343（L1-35 字段行）、:431（文档段位对照表行）、:445（重修索引第 3 类） | 仍写 R8/M2「方案 v2 在档、待主公裁决，未裁决不实施」；实况是 P2-a／P2-b 已于 2026-10-25 裁决，`6eaf05b`／`433ab49` 已落地。conventions.md 的同类滞后行已由 `048527d` 对齐，anti-patterns 没跟上（本会话 `git log 6759b3b^..HEAD -- docs/anti-patterns.md` 只有 `6759b3b`） | 事实滞后，外加段位分类判断（L1-35 要不要改「部分机制化」，「文档段位 6 条」「无机制条目重修索引 17 条」等计数要不要重算） | **未动**：不是台账，且涉段位分类与多处计数，超出「几行纯事实勘注」的范围。建议后续文档波按 `048527d`「附带自决·主公可令回退」先例对齐状态措辞；分类重算有疑义再问 |
| D-3 | docs/anti-patterns.md :215（L2-7 字段行）、:219（机制注）、:432、:443 | :219 机制注仍是将来时「守卫约定位置 `scripts/batch-clean-guard.mjs`（Phase 2 门禁工程师按同路径落地…）」，而守卫已由 `6eaf05b` 在同一路径落地（P2-d 已裁落地启用，rollout :424）；字段行仍是「无机制 → 候补池 C12（已收编未裁决）」 | 措辞滞后，外加分类判断（守卫只防经入口的操作，:219 自述已收窄） | **未动**：随 D-2 同波复议 |
| D-4 | 总图 :235／:236 | 10-27 叠注（`3a81f1b`）插在 10-25 叠注（`5c724cc`）之前（本会话 `git blame -L 234,238`），与 rollout 决策 35「文件末尾按日期顺序叠加」的体例不符 | 排版次序，不是数字错 | **建议不重排**：rollout :428 与总图 :238 都按现行号引用 :236，重排反而制造新的行号漂移 |

**时点口径（不算漂移，无需勘注）**：rollout :423 与总图 :237 的「本地待推 18 笔」（11-01 时点，现为 23）；rollout §5.4 :399「P2-c／P2-e／P3-b／P4-a 待裁」（10-25 时点，§六 各行叠注与总图 :238 已接续）；sweep §二 的 `total=501` 等审计数（10-26／27 时点）。叠注体例下以后注为准。

**口径缺口（台账内无法闭合，不是已证实的错误）**：

1. sweep §1.4 标题写「reportedOnly 全量登记（12 条）」，但 §1.3 db 行候选 1/2「维持只报告」不在表内，§三.6 原文也写「§1.4 十二条＋各分区保护面只报告项」——「全量」二字与 §三.6 不一致；108／55／12 之间也没有逐条映射。要闭合需要扫描交付材料，本波不动。
2. `docs/commit-policy.md` 没有 R8 条目（本会话 `grep -n R8` 只命中 :50，那是 10-24 R3 收紧语境下的「不开 R8」，早于 R8 注释门禁入档）。R8 的说明实际在 conventions.md:71 与 pre-commit 头注。同名歧义风险低，可选在 commit-policy 补一行指针。
3. 路由文档 `docs/repo-map.md`／`docs/code-symbols.md`／`docs/commands.md` 都没登记 commit-audit.yml、batch-clean-guard.mjs 和 `--staged` 模式（本会话 grep 零命中）；查找入口只有 conventions.md:69-73 与 anti-patterns.md:219。属覆盖面观察。
4. rollout :429 的简报链接指向 `.omo/evidence/p4a-decision-brief-20261104.md`：`/.omo/evidence/` 被 `.gitignore:113` 忽略，tracked 0 份（本会话 `git ls-files .omo/evidence | wc -l`＝0），链接只在本机可达，属既定设计。

### 5.6 其他盲区

- **远程门禁空窗**：push 之前，dev 直提只有本地钩子把关（新克隆须按 rollout §3.6 :164 重装钩子），R6/R8 的远程面全部要等 push 后才生效。
- **全链验证时效**：verify-all 末次全链 exit 0 记录在 11-01（rollout :423），`1e97868` 之后未复跑（§一 #1 推荐附带）。本波只跑了 `commit-audit --branch dev`，没跑 verify-all（本波零代码改动，派单也未要求）。

## 六 提交与 push 批准点

### 6.1 本地待推全量（23 笔）

本会话 `git log --format='%h %ad %s' --date=format:'%m-%d %H:%M' 40ac019..HEAD` 实测 23 笔，diffstat 取自本会话 `git show --stat`。归波依据为 subject、提交时间与台账记录（门禁实况⑥）。

| 波 | SHA | 时间 | subject（摘） | diffstat |
| --- | --- | --- | --- | --- |
| 波 1 · 10-25 注释分诊 rollout（9） | `0ca1dc3` | 10-25 14:44 | test(probes) 收口 BR 头差集 11/11 | 4 files +10／−4 |
| | `6759b3b` | 14:45 | docs(comments) Phase 1 落地 | 6 files +509／−11 |
| | `6eaf05b` | 15:34 | feat(qa) R8 入 commit-audit＋批量清理守卫 | 3 files +388／−2 |
| | `433ab49` | 15:34 | chore(lint) M2 行首 TODO/FIXME/XXX 零容忍 | 1 file +12 |
| | `54eeb6a` | 15:34 | docs(omo) Phase 2 台账立卷 | 1 file +113／−21 |
| | `06c7358` | 15:50 | chore(lint) B3 存量收尾 7 处 | 8 files +51／−8 |
| | `fa0d4e9` | 16:11 | chore(comments) 试点 scripts 4 文件删 5 处 | 5 files +37／−7 |
| | `5c724cc` | 16:44 | docs(omo) Phase 4 复盘定策收口 | 2 files +126／−11 |
| | `8abcff6` | 17:04 | fix(qa) 第四类豁免 | 4 files +131／−6 |
| 波 2 · 10-27 混合波（5：ADR 1＋依赖政令本体 1＋sweep 3） | `0f5f339` | 10-27 17:07 | docs(adr) ADR-0001＋sweep 台账立卷 | 3 files +130／−1 |
| | `0eb2edd` | 17:07 | docs(policy) 依赖新增政令入 AGENTS.md L0 | 1 file +1 |
| | `bcc40a4` | 19:51 | chore(comments) sweep 生产面 15 文件 17 处 | 15 files +58／−48 |
| | `db6f80f` | 19:51 | chore(comments) sweep 测试面 16 文件 38 处 | 16 files +139／−136 |
| | `3a81f1b` | 20:07 | docs(omo) sweep 收口 | 2 files +96／−21 |
| 波 3 · 11-01 P2-c A＋（5） | `e4894ea` | 11-01 22:45 | feat(ci) commit-audit.yml 落地 | 2 files +57 |
| | `70aef91` | 22:46 | docs(gauntlet) 三文档口径回写 | 4 files +14／−9 |
| | `8cd120b` | 22:56 | docs(omo) 修障叠注 | 1 file +1／−1 |
| | `33b0a7a` | 23:08 | docs(omo) 收口叠注 | 2 files +2／−1 |
| | `e1aa7ae` | 23:11 | docs(omo) 终审计勘注 | 1 file +1／−1 |
| 波 4 · 11-06 P4-a 裁 a（3） | `1e97868` | 11-06 22:35 | chore(comments) 删 ci-verify.mjs:570 括注 | 1 file +1／−1 |
| | `048527d` | 22:37 | docs(comments) conventions 机械化指向节对齐 | 1 file +3／−3 |
| | `3f957a8` | 22:38 | docs(omo) P4-a 台账回写 | 2 files +2／−2 |
| 波 5 · 11-08 P3-b 裁 D（1） | `6ad1138` | 11-08 14:44 | docs(omo) P3-b 台账回写 | 4 files +6／−5 |

合计 9＋5＋5＋3＋1＝**23**。审计：`node tests/qa/commit-audit.mjs --branch dev` 本会话 exit 0，末行 `ref=dev total=515 pass=499 skip=16 fail=0`；23 笔全部 PASS；其中 3 笔带 R8 M3' 纯报告行（`bcc40a4` added=58 marked=24／`db6f80f` added=139 marked=8／`1e97868` added=1 marked=0，均为 pure report、不拦）。

### 6.2 本波新增

- **已提交 0 笔**（派单令「暂不提交」）。待提交改动 2 个文件：① 新建本档；② sweep 台账 :109 一处勘注（§五.5 D-1）。
- 预计 1 笔 `docs(omo)`；落笔后待推＝23＋本波笔数，**终值以 `git log origin/dev..HEAD` 为准**。
- 提交时只精确 add 上述 2 个文件；他人 4 件未提交变更（§五.4）不触碰；Plan footer 指向 `.omo/plans/` 下的文件（运行区 `.omo/decisions-*` 永不入库）。是否同笔在总图追加叠注登记本档（沿 10-25／10-27／11-01／11-08 先例），留给提交波决定。

### 6.3 push 批准点

- **须主公明令**后以 `MASTER_PUSH_DECREE=1` 执行（AGENTS.md:27；机械防线 `.git/hooks/pre-push` :2-3）；push 前后 tip 以 `git rev-parse` 实测留痕。
- 建议顺序：push 前复跑 `node scripts/verify-all.mjs` → push dev → 观察 commit-audit.yml 首跑（§一 #2）→ 首跑绿后再裁升格 required（§一 #3）。

**【2026-11-08 裁决叠注】push 批准点已按实际走完**（主公 2026-11-08 /workflow『全部执行』令）：上方建议顺序四步全部执行完毕——①六层 verify-all exit 0（绿）＋队列核验恰 24 笔（§6.1 的 23 笔系立卷时点，含总览入档笔 `e71726f` 后终值 24，全部随本次出仓）；②`MASTER_PUSH_DECREE=1 git push origin dev` 普通推送成功（快进 `40ac019..e71726f`、零 force），`git ls-remote` 回验远端 dev＝本地 HEAD（`e71726f1120052322784583818fb9a95b991543e`）；③commit-audit.yml 首跑绿（run `42494216534`，total=95 pass=95 fail=0）；④ruleset 升格完毕（`rulesets/23195249` required 12 项）。远程门禁空窗（§5.6）自此闭合：R6/R8 远程面已生效且从 advisory 升为 required。push 前后 tip 以 `git rev-parse`／`git ls-remote` 留痕（见上）。
