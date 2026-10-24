# Plan: ulw · 分支策略入档 + README 截图双语（ulw-readme-shots-bilingual-20260913）

- 日期：2026-09-13
- **状态**：已交付——C1 `fe7fef9`（docs/branching.md 分支策略入档）+ C2 `e61cea2`（README 三帧截图 + README.en.md 双语，e1e7e85/cb3ce79 跟进；后续 02c654d/31d56f6 截图重制迭代），2026-09-14 落地（状态线 2026-10-04 D25 卫生票补记）
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

## 更正附录（2026-09-13 主公指出）

初版 Features 之「键盘优先」句宣称「落子、回车、回溯全部键控可触」，
过实——码中（Board.tsx）键控唯二：↑↓←→ 移焦邻格、Enter/空格落子；
「回溯」无撤销实现（grep undo/history 零命中），导航钮仅原生 Tab 可达。
两档措辞已收敛为实测之键：中「游玩无需鼠标」/英「gameplay needs no
mouse」，不越表格之实。

## 更正附录二（2026-09-13 主公追问 Tab）

首更正漏「Tab 入盘」一步。码证：Board.tsx:97 九格唯焦点格 tabIndex=0
（phase='playing' 时），且无 mount 自动聚焦（focus() 仅在箭头处理内），
Tab 乃入盘唯一之门。两档补「Tab 入盘 / Tab enters the board」。
