# Plan: ulw · 分支策略入档 + README 截图双语（ulw-readme-shots-bilingual-20260913）

- 日期：2026-09-13
- ulw-loop：`.omo/ulw-loop/ulw-readme-shots-bilingual-20260913/`
- 覆盖两枚原子 commit（docs 系）：

## C1: 分支策略入档

- 新增 `docs/branching.md`：trunk-based 决策（无 dev/release/hotfix 之由）、
  双 Ruleset（main-redline 无 bypass / main-gate bypass admin）、
  squash-only 与线性史、协作演进（bypass→协作者自动受限）、重审触发条件
- README §文档导航 增一行索引

## C2: README 截图 + 英文双语

- 复用 `tests/qa/visual-qa.mjs`（1280×900，生产构建）出三帧：
  `docs/screenshots/{home,board,result}.png`
- README 增 §预览 三联图 + 语言切换行
- 新增 `README.en.md` 全文英译 + 切换行；README.md 保持中文为主

## 验收标准

- AC1: docs/branching.md 就位且入导航索引；两 commit 皆七门绿
- AC2: 三帧截图存在、尺寸合理（<400KB/帧）、与 QA 探针同源（可复现）
- AC3: README 图三联渲染、README.en.md 全节对译无缺节、双文件互链
- AC4: subject 小写、trailer 全、消息=授权件
- AC5: 不 push

## 边界

- codex 通道今陷宣言循环（两次派发零产出），调度者按 W1.x 先例自执，如实披露
- 不动 DESIGN.md / docs 其他档；译文以中文版为准逐一对应
