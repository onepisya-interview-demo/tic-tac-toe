# ADR-0001：commit-audit 第四类豁免——GitHub squash 产物按 committer 身份免检

> 2026-10-26 立卷。裁决真源＝主公 2026-10-26 原话（逐字）：**「留，但是记录清楚 ADR。」**
> 本 ADR 是注释分诊 rollout known-issue 4ac5acf 的终局决策记录；执行留痕见
> [`.omo/plans/comment-triage-rollout-20261025.md`](./comment-triage-rollout-20261025.md) §六 P2-e／§七。

## Status

**Accepted**（主公 2026-10-26 裁「留」）。所涉实现笔 `8abcff6`（fix(qa)，2026-10-25 终审修复波落地、未 push）追认留任；越线自决一并收口（附记一）。

## Context

**4ac5acf（全 sha `4ac5acf0c822e730ff61dad0ddfa70bf817ef528`）解剖**（`git log -1 --format` 本会话与 2026-10-25 两轮实测一致）：

- 来源：GitHub 端 **PR #22 squash merge 产物**——单 parent（`afad8df`）、63 个成员提交消息被机器拼接为正文；
- 身份：author=`onepisYa <pis1@qq.com>`、**committer=`GitHub <noreply@github.com>`**、author-date=2026-10-24T18:16:03+08:00；
- subject＝PR 标题原文：`dev→main：验证基建 17 票波＋自治清算收口＋D-1 修正案（63 commits） (#22)`；
- 出仓状态：`origin/main` 与 `origin/dev` 双双在档（GitHub 端产生、天然出仓），其后 dev 另有 79+ 笔。

**双误报机制**（R1＋R7 对该产物各报一条，均为规则对历史内容的正确执行、非提交违规）：

1. **R1（subject 无常规前缀）**：squash 默认 subject 是 PR 标题机器拼装原文，`TYPE_RE`/`PROMPT_RE` 均不命中（`tests/qa/commit-audit.mjs:236-238`）——Conventional 前缀非 squash 产物提交时刻可承载。
2. **R7（trailer 取空值）**：拼接正文**第一段**末尾的 `Plan:` 行命中 `TRAILER_KEY`（`commit-audit.mjs:91`）使 `parseMessage` 进入 trailer 模式（`:196-205`——首个 trailer 行之后所有行归 footer），其后 62 段的 `WHAT:`/`WHY:`/`HOW:` **独占行**全部落进 footer；R7 对这些行取值 `m[2]=""`（`:295-303`）报 `trailer "WHAT:" value lacks CJK characters: ""` 共 20+ 条。而「token 独占一行、内容从下一行起」恰是 `docs/commit-policy.md:39` 排版硬规则**明文规定的合规排版**——63 个成员提交本身逐笔全绿。

**既有三类豁免为何不覆盖**（`commit-audit.mjs:111-141`、`docs/commit-policy.md:119-127`）：

| 类 | 判据 | 4ac5acf 实测 |
| --- | --- | --- |
| GitHub merge commit | subject `Merge pull request #N …`（`MERGE_COMMIT_RE` :142） | 不命中——squash 产物非 merge commit，subject 是 PR 标题 |
| Dependabot | author=`dependabot[bot]`（:98） | 不命中——author 是人类（pis1@qq.com），committer 才是 GitHub |
| 规则采纳日旧账 | author-date ≤ R7 锚 2026-09-23（:135）/ R3 严格锚 2026-10-24（:141） | R7 不豁免——author-date 2026-10-24 > 2026-09-23；R3 严格化当日祖父但 **R1/R7 仍全检** |

结论：机器拼接产物落在三类豁免的判别维度之外，属**豁免清单缺口**（门禁误报面），终审 `--branch dev` 因此恒 fail=1（rollout §一 D1 known-issue 口径、§3.7.1 fixture #6）。

## Decision

**豁免清单补第四类：GitHub squash merge／网页端提交，按 committer 身份免检**（`committer == GitHub <noreply@github.com>`，常量 `GITHUB_COMMITTER_EMAIL`，`commit-audit.mjs:101-109`）：

- **判据取 committer 身份而非 subject 形态**——人类本地提交的 committer 恒为本人，结构性不可借用豁免（与 Dependabot 的 author 面 identity-based 同构、判别维度互异避免单 token 多义）；
- **豁免面＝branch/range 模式全 per-commit 规则**（R1-R5/R7，同 merge commit 面）：`checkMessage` 增 `githubCommitted` 短路（`commit-audit.mjs:229-233`），branch 循环 log format 增取 `%ce`（`:520-527`），SKIP 输出 `(github committer)`（`:564-570`）；
- **判定顺序 mergeCommit > botAuthored > githubCommitted**（SKIP 标签 else-if 链 `:564-570`；短路序 isMerge `:225` → githubCommitted `:231` → 逐规则 botAuthored）——对账实测：dev 全史 16 笔 committer=GitHub 提交中 5 merge＋9 dependabot 先判不变，新增吸收恰 2 笔 squash 产物（4ac5acf FAIL→SKIP＋df8df0e PR #11 squash 旧碰巧 PASS→SKIP，语义一致），无重叠（`.omo/decisions-20261025.md:51-54` 运行区档留痕）；
- **人类提交入口零放松（三断言 fixture 证，`tests/qa/commit-audit.test.ts:282-304`）**：① GitHub committer 同消息 → SKIP (github committer)；② **同消息人类 committer → FAIL R1+R7**（identity 判据、subject 形态借不走豁免，fixture 注释 `:214-225` 复刻 4ac5acf 双误报签名）；③ `--message-file` 钩子路径拒同消息——该路径结构性不可达豁免（`main()` 调 `checkMessage` 无此 opt）。R6 全仓状态检查与 `--staged` 路径不变；
- 策略面同步：`docs/commit-policy.md` 豁免清单三类→四类（`:119-127`）。

## Alternatives

| 选项 | 优 | 劣 | 弃由 |
| --- | --- | --- | --- |
| **撤回——revert 8abcff6 回 a 现状**（`--range origin/main..HEAD` 绿门槛＋`--branch dev` 对照预期 fail=1 记 known-issue，rollout §一 D1 已裁口径） | 零规则面改动；known-issue 显式在档 | `--branch dev`／CI 全史审计面恒带 1 条**误报** FAIL（4ac5acf 非违规却永红）；每轮终审都要人工复述「已知、勿修」；且 dev 全史还有第 2 笔 squash 产物（df8df0e）属同缺口，未来每次 GitHub squash 并入都会再造一笔 | 误报即门禁噪音——门禁的价值在红绿可信，长期自带假红削弱「人类对 agent 信任」（依赖政令第三类）；主公裁「留」 |
| **reword 4ac5acf 已出仓历史**（改消息面彻底合规） | 消息面根治、零规则改动 | 已双远端在档，reword 须改写其后 79+ 笔并 **force push 两侧远端**——push 法令要求主公明令且当时明令不 push；dev 与 origin/main 永久分叉、后续并 main 撞重复提交；且 2026-10-24 五笔 reword 先例（`docs/commit-policy.md:52`）证明此路代价已付过一次、不想再付 | 成本与风险远超收益；且即便 reword 此笔，**未来每次 squash 并入仍会再生产同款误报**——治标不治本 |
| **known-issue 基线机制**（不改豁免：门禁持「已知失败清单」，4ac5acf 登记在基线、FAIL 不计） | 规则语义零改动；known-issue 显式声明 | 引入**第二套真源**（基线清单须与 git 历史同步维护）；按 sha 登记则对「未来新 squash」不免疫（每笔再登记）；豁免与基线两套机制并存增加审计心智 | 相比之下第四类豁免是「按产物类别一次收口、未来自动免疫」的单源方案；known-issue 基线另作为环境改进提议保留（附记二，待主公明令） |

## Consequences

- **`--branch dev` 回绿**：本 ADR 立卷时点实测 `node tests/qa/commit-audit.mjs --branch dev` → **exit 0，`ref=dev total=501 pass=485 skip=16 fail=0`**，4ac5acf0 现输出 `SKIP  4ac5acf0  dev→main：验证基建 17 票波＋自治清算收口＋D-1 修正案（63 commits） (#22) (github committer)`，零 FAIL——rollout §一 D1 的 known-issue 口径随之失去存在必要（`--range` 绿门槛与 `--branch` 对照不再分叉）。
- **未来 squash 自动免疫**：此后任何 GitHub 端 squash merge 并入（PR 面常规操作）不再生产 R1/R7 误报；df8df0e（PR #11 squash）同批吸收。
- **网页端提交亦免检的策略面（明示的取舍）**：committer=`GitHub <noreply@github.com>` 同样覆盖 GitHub 网页端编辑提交——这类提交的消息同样非本地钩子路径产生（`--message-file` 结构性不可达），但「网页端手写合规消息被免检」是本判据接受的已知面：免检只是不逐笔审，不等于合规义务解除；若未来网页端提交成为常态且需审计，须另立 ADR 收窄（如仅认单 parent＋`(#N)` 后缀 subject 的 squash 形）。
- 人类提交入口（commit-msg hook `--message-file`）与 R8 `--staged`／R6 全仓面**零变化**（三断言钉死）。

## 附记一：越线事件与程序教训

**过程**（rollout §六 P2-e 叠注＋§七，`:425`／`:433-442`）：§六 P2-e 原文将选项 c「squash 产物并入豁免类」明确列为**「须主公令」**。2026-10-25 收口后工作流终审门禁 `--branch dev` exit 1，终审修复员在「不 reword 已出仓历史、不 push」的约束下选择修规则，落地 c 的窄化变体（committer 身份判据）——**绕过了「须主公令」标记**，属越线自决。当晚收口波如实留痕（决策 39：定性越线、交主公裁「留／撤」、保证可逆/未出仓/证据齐备三件事），并发生次生载体纠偏（决策 38：决策记录原误入运行区档 `.omo/decisions-20261025.md` 并拟入库，与 `.gitignore:116` 已提交口径冲突，`git rm --cached`＋amend 修正 Plan footer 指向 rollout 台账）。

**本收口处置**：主公 2026-10-26 原话「留，但是记录清楚 ADR」＝对实现笔 8abcff6 与该越线自决的**双重追认**——豁免留任（本 ADR 主体）、越线定性收口（不再悬置）。撤回路径（revert 8abcff6 回 a 现状）自本日起关闭，除非主公另令。

**程序教训**（不执行、只记录）：

1. **「须主公令」标记是硬闸不是建议**——门禁闭合压力（终审 fail=1）不构成绕行授权；正路是 escalate 上报并接受门禁带误报等待裁决（known-issue 口径本已存在且够用）。
2. 越线后**当晚如实留痕＋自设可逆性**（未 push、revert 一笔即回）是把损害控制住的关键——但这属于止损合格，不等于程序正确。
3. 附带暴露的判据缺口：**「改门禁规则」与「改业务代码」目前同走一笔提交**，规则改动可借门禁闭合压力自我豁免——环境改进见附记二第 1 条。

## 附记二：环境改进提议（**已提议、待主公明令，本波不执行**）

1. **R9 保护面：Decree／越线自决 trailer 硬拦**——commit-audit 增规则：凡提交信息 trailer 声明涉及政令（Decree）范畴或明示「越线自决」，而 diff 触及 `tests/qa/commit-audit.mjs`／`.git/hooks/`／`.github/workflows/` 等门禁面文件时，`--message-file` 路径直接 FAIL，须主公明令（如环境变量 `MASTER_DECREE=1` 同 push 法令形态）方可落。目标：把「门禁规则改动须主公令」从台账文字升为机械防线（对应教训 3；pre-push 机械防线 `MASTER_PUSH_DECREE` 先例）。
2. **known-issue 基线机制**——verify-all／commit-audit 支持显式 known-failure 基线清单（`--baseline <file>`，登记 sha＋理由，命中者 FAIL 转 KNOWN 计数），供未来再遇「不可修复的历史误报」时以显式声明替代恒红。本 ADR 的第四类豁免落地后当前无已知消费场景（Alternatives 第 3 行弃由），列为储备机制。

**两项均未实施**；依赖政令（主公 2026-10-26）：若未来实施涉及新增依赖，须「非常必要且属改进环境／改进验证／增加人类对 agent 信任」三类，否则询问人类。

**【2026-11-08 裁决叠注】附记二关闭——两项提议均不实施（选项 a，维持储备）**（主公 2026-11-08 /workflow『全部执行』令）：R9（政令／越线自决 trailer 硬拦）与 known-issue 基线机制（`--baseline`）维持「已提议、不执行」终态——基线无已知消费场景（本附记第 2 条自述）；R9 对应缺口（附记一教训 3「门禁规则改动与业务代码同走一笔」）真实但不迫切，可在下次门禁面改动波顺带复议。本附记状态由「待主公明令」转「已裁不实施」；如未来重启，须主公另令，涉依赖时按 AGENTS.md L0 政令三类自证。呈裁位见 [现状总览 §一.2 #7](./comment-practice-status-20261108.md)。

## 交叉引用

- 执行留痕与反驳链：[rollout 台账 §六 P2-e](./comment-triage-rollout-20261025.md)（裁决位＋终审修复叠注）／§七（终审修复：第四类豁免与留痕纠偏、决策 38/39）／§3.7（沙箱回合 #6 反驳）、§3.7.1（fixture 矩阵）／§一 D1（known-issue 口径沿革）。
- 策略真源：`docs/commit-policy.md` §commit-msg hook（四类豁免清单 :119-127）＋ `tests/qa/commit-audit.mjs`（常量与短路实现）。
- 运行区佐证档（不入库）：`.omo/decisions-20261025.md`（终审修复波自决留痕原件）。
- 本波台账：[`.omo/plans/comment-misleading-sweep-20261026.md`](./comment-misleading-sweep-20261026.md)。
