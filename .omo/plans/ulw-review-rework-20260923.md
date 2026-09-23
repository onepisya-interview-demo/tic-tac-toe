# ulw-review-rework-20260923 — 裁决执行波交叉审 findings 处置表

> 性质：调度者收尾票。裁决执行波（基线 c50532a，herdr fresh codex 4 修复席 + 4 交叉审席）产出 6 条 low findings，全部经独立复核员换人复现（verified），无 medium/high、无返工轮次。本文档为逐条处置记录：修 4 条文档级，记 2 条不可修/无需修。

| id | 位置 | 内容 | 处置 |
|---|---|---|---|
| r1-F1 | ulw-commit-lang-rule plan §A1 | plan 称「bot 豁免 R3-R5，不豁免 R7」，实现把 R7 subject+trailer 两处校验放进 `!isPrompt && !botAuthored` 闸内（commit-audit.mjs :154-193），bot/prompt 实际全豁免 | **修 plan 措辞就实现**——豁免方向正确：bot subject 为上游生成的英文，强制 CJK 会挂掉全部 dependabot PR |
| r2-F1 | Board.test.tsx:208 | 正面偏离：plan 负面清单列为「不迁移」的内联 setState（4 字段全等 initial 默认）被改判为重置块并迁移 | **记录不修**——偏离合理且 commit body 已显式记载「+1 inline setup」 |
| r2-F2 | commit 47ad7d7 subject | subject「迁移 15 处重置块」vs rg 实测 16 处 resetStore() 调用（15 块 + 1 内联 setup） | **记录不修**——主公御裁不 reword 存量 commit；body 已自解释 |
| r2-F3 | ResetStatsButton.test.tsx:62 | 注释「mode is 'online' after resetStore」但该文件从未调用 resetStore（先存注释，非本波引入） | **修注释**——改为实况：mode 由测试内 setState 置 online |
| r3-F1 | ulw-transition plan §三 case 5 | callback 行号 :41 不精准——:41 是 onEnd 内的 finish() 调用，真正 callback 调用在 finish 体内 :34 | **修行号** |
| r3-F2 | ulw-transition plan §三 4b footnote | spyOnGetAnimations 行号 :51-60 已漂移（同票测试文件加注释挤位）→ 现行 :58-68 | **修行号** |

## 处置原则

- 全部为文档/注释级零行为改动，调度者按收尾惯例亲自微修，不重派 codex 席（一张票的调度成本 > 四条注释级收益）。
- 波次终态门禁：vitest 498/498（基线 494 + 新增 R7 用例等）、typecheck/lint exit 0（主控亲跑）；红线（02c 探针与 lib 产品码零 diff）通过；票面 file face 越界 0 处。
- 交叉审 verdict：四席全 PASS；交叉审明细见工作流汇总报告 artifact（run dwfrun-e00694a9-b3a7-4f4c-9d48-71e442c0fa1a）。
