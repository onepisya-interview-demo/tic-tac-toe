# 计划：全面 AI slop 清理 + 文档整合（scope: 全项目一方代码/文档）

Intent: 用户要求全面检查并清理 AI slop，同时保持提交规范、全部门禁、工作流清晰、AI 友好，并补齐测试思路/操作手册/学习笔记。分支 diff vs merge-base 为空（HEAD 在 main 上），因此 scope = 全部一方源码 + QA 脚本 + 文档（lockfile/生成物除外）。

## 行为锁定（先行，已完成）
- 基线 GREEN：pnpm vitest run 67/67、typecheck、lint 全过（编辑前）。
- 突变探针：otherPlayer 恒等突变 -> 目标测试 RED（2 失败，原因正确）-> 回滚 -> 目标 GREEN 45/45。套件敏感性已被证明，而非假设。

## 逐文件清理计划（deletion ladder 先行，再按类清理）

### lib/game.ts
- Ladder: simplify-in-place
- 死代码：删除 GameStatus 导出（0 引用；store 已自有 GamePhase）。
- 风险：低。

### db/schema.ts
- Ladder: simplify-in-place
- 死代码：删除 NewGameStatsRow 导出（0 引用）。GameStatsRow 被 lib/db.ts 使用，保留。
- 风险：低。

### lib/store.ts
- Ladder: 2 处 simplify-in-place + 1 处 delete（selectAvailableMoves 为投机 API，唯一消费者是它自己的测试）
- duplication：startGame then/catch 两分支复制同一 set 形状 -> 合并为 .catch(() => emptyStats()).then(单一 set)。行为等价（catch 路径原本就是同形状 + emptyStats）。
- over-defensive：makeMove 对 applyMove 的 try/catch 被前置守卫证明冗余（占位与越界都被 board[index] !== null 拦截，undefined !== null）-> 直接调用。
- 死代码：删除 selectAvailableMoves + store.test 中对应测试块。
- 不一致：两处 apiPutStats swallow catch 统一为带 WHY 注释的写法。
- 风险：中（状态逻辑）；由全量套件兜底。

### tests/store/store.test.ts
- 仅随 selectAvailableMoves 删除其测试块（被测代码已删，非"删测试求绿"）。

### tests/qa/*（结构性去重 + 超尺寸拆分）
- ux-qa.mjs 273 纯 LOC > 250：assertUXContract 按职责迁至 tests/qa/lib/ux-contract.mjs；主文件保留场景定义 + main 循环。
- 抽取共享助手（概念命名，禁 utils/helpers）：
  - tests/qa/lib/browser.mjs：launchQA({ autoplay }) -> { browser, ctx, page }（统一 BASE/viewport/headless）。
  - tests/qa/lib/evidence.mjs：ensureDir/shoot/writeQaLog。
  - tests/qa/lib/win-drive.mjs：driveTopRowWin(page, { clickGapMs })，替换 5 处复制的 0,3,1,4,2 序列。
- 各脚本改造：visual-qa / hydration-check / audio-probe / audio-cheer / audio-confetti-qa 全部改用助手；BASE 统一为 process.env.BASE_URL ?? 'http://localhost:3000'；audio-confetti-qa 的硬编码本机绝对 OUT 改为 EVIDENCE_DIR env + 相对默认值。
- 保留各脚本内联的 AudioContext 探针（脚本特有逻辑，抽取即过度抽象）。
- 风险：中；逐脚本对真实 server 跑 PASS 验证。

### 文档整合（活文档单一事实源；档案保留）
- DESIGN.md S9：删除与 README/AGENTS 重复且过时（npm 命令、coverage 表述漂移）的门禁清单，改为指向 README Gauntlet 表 + AGENTS.md Verification gate。
- README.md：新增文档导航（DESIGN/AGENTS/docs/*）。
- 新增 docs/testing.md（测试思路：分层、阈值、RED-first 政策、运行方式、当前 67 例）。
- 新增 docs/operations.md（操作手册：安装/开发/构建/测试/DB/QA 脚本/DATABASE_URL/证据目录/提交规范速查/排错）。
- 新增 docs/learnings.md（学习笔记：坑 + 版本相关，全部有仓库内证据）。
- 新增 .env.example（仅 DATABASE_URL，无秘密）。
- .omo/plans/commit-policy-*.md 与 ulw-loop/brief.md 为历史档案/源 brief：保留不迁移（被提交 Plan: 页脚/DESIGN 引用）。

## Must-NOT-Have（护栏）
- 不改公开行为/API 语义（除删除 0 引用死代码与投机 selector）。
- 不动 commitlint/commit-audit 策略面（三观察点为文档化有意重复）。
- 不为 QA 探针引入新依赖；不删除 AudioContext 探针逻辑。
- 不重写历史提交；不 push（无 remote）。
- PROSE 文件不加人为"字数/关键词"测试；机器消费值由 commit-audit 真实验证。

## 验证
- pnpm vitest run / typecheck / lint / build 全绿。
- tests/qa 实测：build + start 生产 server -> hydration-check / audio-probe / audio-cheer / audio-confetti-qa / ux-qa after / visual-qa 全 PASS -> 杀 server + 清理回执。
- commit-audit RED/GREEN：坏消息文件 -> violations>0；真实提交消息 -> 0 violations（钩子即时拦截）。
- 提交：原子分组 refactor(core) / refactor(qa) / docs，全部 Conventional + WHAT/WHY/HOW + lore trailers + Plan: 页脚。
