# 文档对账回写波执行记录（doc-audit-backfill 2026-10-24）

> 状态：随六档对账笔入档；四笔提交哈希回执待执行后回填。
> 来源：① 仓态对账与三线简报（汇总席落款 2026-10-24 18:55 +0800）：
> `/Users/onepisya/.zcode/tmp/workflow-artifacts/dwfrun-b9bbd5d3-35a2-4b51-aa8e-53567a0c0886-4d9edabf/next-report-f607cf7f/v1/next-report.md`
> （§一 六档对账结论；§五 建议执行顺序）。② 主公 2026-10-24 /workflow 自决令
> （A 组调度者立即可自决项授权执行）。

## 口径

- **本地 commit、不 push**——push 批准点（简报 §五）：order 2 文档波与 order 3 并回两处须主公明示；push 法令见 `docs/commit-policy.md` §push 法令（2026-10-24）。
- 逐文件精确 add（并发会话活跃）；提交走 commit-msg hook，禁 `--no-verify`。

## §五 order 2 八项清单（幽灵锚换新表适用全部相关档）

哈希换新：`fd8db3f→1ad6bd5`、`5165933→6f0377f`、`d9c608b→022c1b4`、`c303d8b→c966292`、`35ac680→311d91c`（旧锚任何分支不可达，仅本地 reflog／filter-branch 备份 ref 可解；五新锚经 rev-parse 亲证可达）。

| 项 | 内容 | 本波处置 |
|---|---|---|
| ① | commit-policy.md：R3 段补 body≥60 先决＋五锚换新＋「不 reword」断言改执行回执＋R7 误粘段清理 | docs(omo) 笔 |
| ② | verification-gauntlet.md：层①测试数改实测口径＋§5.4 引言列号勘正＋d9c608b 勘注 | docs(omo) 笔 |
| ③ | 总图＋ledger：三波叠注＋「32 笔待推」作废＋尾巴 5 条标已清＋47→47+1＋:76 笔误勘正 | docs(omo) 笔 |
| ④ | 路线图：遗留项①②③标了结＋:287 作废＋:133→:183＋:277 层级 | docs(omo) 笔 |
| ⑤ | 调研档：§五/§六闭环终态＋行号勘注＋:186 空锚 | docs(omo) 笔 |
| ⑥ | 票 18 票面 :4 executing→done＋终态收口节 | docs(omo) 笔 |
| ⑦ | 外部记忆档：5 锚换新＋10-24 波一节＋D-4/D-5 线索收口 | 改档动作、非 git add（路径未随简报附）——不在本 git 波 |
| ⑧ | .gitignore 补 `/.omo/decisions-20261001.md`（OPS-IGNORE） | chore(gitignore) 笔 |

## §五 A 组六项处置

| 序 | 事项 | 处置 |
|---|---|---|
| 1 | 决策台账回写波 | **不 commit**（台账自述纪律 :3「不 commit、不 stage」/:598「永不 commit」），工作区档另行——非本波 git 面 |
| 2 | tracked 文档补写波 | 本记录＋六档（①-⑥），docs(omo) 笔 |
| 3 | dev 并回 main | 本地 merge `4ac5acf` 回 dev（先例 343e51c），chore(qa) merge 笔；基线实测 origin/main...HEAD＝1/67、merge-tree 预演干净 |
| 4 | L4 补课（锚①③④＋锚②定义取齐） | 不在本波——D-4 呈报前置件，另行 |
| 5 | AI-Q3 勘误（practice-map §1.2 三处 ChildPlay 断言） | 同窗口另笔 docs(evals)；源＝10-14 审批表 **§2 自决备案区** :87 改判注记（派单转述作 §3，审批表实况 §2——§3 系人审区） |
| 6 | AI 线无害预制备（gitignored 四件） | 不在本波——低优先、随时可做 |

## 提交分解与回执（待回填）

| # | 提交 | 哈希回执 |
|---|---|---|
| 1 | docs(omo): 六档对账回写——幽灵锚换新、三波叠注、作废口径收口＋票 18 终态 | 待回填 |
| 2 | docs(evals): practice-map ChildPlay 三处勘误 | 待回填 |
| 3 | chore(gitignore): 决策台账运行区文件入忽略——OPS-IGNORE 自决备案落地 | 待回填 |
| 4 | chore(qa): 并回 main——PR #22 squash 产物（4ac5acf）并入 dev（merge 笔） | 待回填 |
