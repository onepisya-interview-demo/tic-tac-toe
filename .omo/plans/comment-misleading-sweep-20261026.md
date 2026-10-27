# 误导注释清理 Sweep 台账（comment-misleading-sweep）

> 2026-10-26 立卷（骨架）。裁决真源＝主公 2026-10-26 三令原话（§〇，逐字）。
> 本台账是「全仓清理容易误导的注释」方向令的执行账本：阶段落地动作、自决决策（证据 file:line 或命令输出）、验证证据、待主公裁决项。提交 `Plan:` footer 指向本文件。
> 关联档：[ADR-0001](./adr-0001-github-committer-exemption-20261026.md)（P2-e 终局）／[注释分诊 rollout 台账](./comment-triage-rollout-20261025.md)（前置四阶段，含分诊矩阵与增量门禁 R8/M2）。

## 〇 主公三令原话（2026-10-26，逐字记录）

1. P2-e 裁决：「留，但是记录清楚 ADR。」
2. 依赖新政令：「可以新增依赖，但是依赖必须是非常必要的，改进环境的，改进验证与增加人类对 agent 的信任的依赖。否则应该询问人类。」
3. 方向令：「如果我们没法在一开始就不允许 AI 写注释，现在也算止血了。但是所有代码我觉得我们都应该清理容易误导的注释」＋令调研：「poteto 她是如何不允许模型写注释的？你知道 poteto 禁止注释的原因吗？可以上网查一下。」

**落地形态**：令 1 → [ADR-0001](./adr-0001-github-committer-exemption-20261026.md)＋rollout §六 P2-e 裁决叠注；令 2 → AGENTS.md L0 依赖新增政令行＋本台账 §三.3 消费规则；令 3 → 本台账主体阶段（§一）＋poteto 调研（§三.1）。

## 一 阶段（占位）

| # | 阶段 | 状态 |
| --- | --- | --- |
| 0 | **落档波（本波，2026-10-26）**：三件落地——① ADR-0001（Status=Accepted、附记一越线教训／附记二环境改进提议标注待主公明令不执行）；② AGENTS.md L0 依赖政令行（仅项目块，BEGIN:nextjs-agent-rules 零触碰）；③ rollout §六 P2-e 回写已裁决＋本台账骨架。**暂不提交**，改动清单见 §四。**【提交叠注 2026-10-26】审读通过，主公令提交**：拆两笔 `docs(adr)`／`docs(policy)`，SHA 以 `git log` 为准（§四） | 已落地（本波） |
| 1 | poteto 调研：上网查 poteto（Hiroshi Tsubokura／zenn 系）如何不允许模型写注释、禁止注释的原因 | **占位待派** |
| 2 | 误导注释清理 sweep 主体：全仓「容易误导的注释」盘点＋分诊＋执行（沿用 rollout 分诊矩阵：删/留/转化＋四条归格规则；L1-27 前置门；`// BR:` 头与决策编号/plan 回链注释**只报告不改动**） | **占位待派**（范围/判据/批量 SOP 待主公或派单令定） |
| 3 | （预留）调研结论反哺：若 poteto 机制可移植（如系统层禁注释写入门禁），按依赖政令评估是否立项 | **占位** |

## 二 验证（占位；已跑项随阶段回填）

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| ⑤层 `--branch dev`（P2-e 终态复核） | `node tests/qa/commit-audit.mjs --branch dev` | 落档波实跑：**exit 0，`ref=dev total=501 pass=485 skip=16 fail=0`**，4ac5acf0 输出 `SKIP … (github committer)`、零 FAIL（ADR Consequences 同锚） |
| 提交信息预验①（hook 同款路径） | `node tests/qa/commit-audit.mjs --message-file /tmp/msg-adr-20261026.txt` | **PASS**，exit 0（R1-R5/R7＋commitlint 双检查点） |
| 提交信息预验②（hook 同款路径） | `node tests/qa/commit-audit.mjs --message-file /tmp/msg-policy-20261026.txt` | **PASS**，exit 0（同上） |
| 其余层 | 层① vitest／② typecheck／③ lint／④ build／⑥ 浏览器探针 | 落档波改动全为 .md 文档（AGENTS.md＋3 个 .omo/plans 文件），零代码行为面——未跑，如实声明；后续代码改动阶段（§一.2）按六层门禁全跑 |

## 三 待主公裁决（占位）

1. **poteto 调研结论**（§一.1 回填后）：是否采其机制（禁注释写入门禁/约定）入本仓——待调研材料呈报。
2. **sweep 主体范围与判据**（§一.2 派单前）：「容易误导的注释」的操作性定义（过期复述／失真声明／超前用途如 rollout P4-a 一族）、范围（六目录+tests+scripts？含 .sh？）、是否沿用 M5' fresh-eyes 评审＋执行员两段制。
3. **依赖政令消费规则**（令 2 的执行面）：本波零新增依赖；未来任何依赖新增须自证「非常必要且属改进环境／改进验证／增加人类对 agent 信任」三类（AGENTS.md L0 已载），否则**询问人类**——本台账不设自决空间。
4. **rollout 遗留裁决位**（本波不动，维持待裁决）：P2-c（R6/commit-audit 触发点接入 ci.yml）／P3-b（Phase 3 范围 2 个 .sh）——仍留 [rollout §六](./comment-triage-rollout-20261025.md)原位；P4-a（ci-verify.mjs:570 用途声明失真）与 sweep 主体（§一.2）同族，可并案裁。
5. **ADR 附记二环境改进提议**：R9 保护面（Decree／越线自决 trailer 硬拦）／known-issue 基线机制——**已提议、待主公明令，不执行**（ADR 附记二原样标注）。

## 四 git 自查（落档波）

- 改动文件清单：`AGENTS.md`（L0 追加一行，项目块内）、`.omo/plans/adr-0001-github-committer-exemption-20261026.md`（新建）、`.omo/plans/comment-triage-rollout-20261025.md`（§六 P2-e 两处回写）、`.omo/plans/comment-misleading-sweep-20261026.md`（新建，本文件）。
- 既有未提交变更（git status 实测：` M .gitignore`、`?? .omo/decisions-20261001.md`、`?? .omo/decisions-20261025.md`、`?? .omo/plans/pre-push-guard-decree-20261024.md`）零触碰；P2-c/P3-b 行未动。
- 提交：审读通过后派单令（2026-10-26）执行，拆两笔——① `docs(adr)`（ADR-0001＋rollout §六 P2-e 回写＋本台账）；② `docs(policy)`（AGENTS.md L0 依赖政令行）。两笔均先过 `--message-file` 预验（§二），经 pre-commit（R8 `--staged`）＋commit-msg（R1-R5/R7＋commitlint）双钩，精确逐文件 `git add`（未 `-A`／`.`），永不 `--no-verify`；**未 push**（push 法令：须主公另行明令）。SHA 以 `git log` 为准。
