# ulw · one-game-two-versions —— 展示页 + online/offline 双版本 + RESTful API + schema.org 语义对齐

- **日期**：2026-09-19
- **状态**：APPROVED（主公 2026-09-19 御批「执行这个计划」；ZCode 调度者席任派发/轮询/独立验收/目验）
- **触发**：主公御定产品模型——首页转展示页，一局棋两版本（offline 纯本地 / online 实时上云），API 升格 RESTful，词汇表对齐 schema.org
- **基线**：dev @ 26d17dd（.gitignore / next-env.d.ts 本地未提交改动系主公侧，绝不卷入 commit；`.omo/plans/glossary-context-md.md` 系另一待批计划，不触碰）
- **执行体**：fresh codex（herdr **3t** session，每波新 **tab** 非 split pane，席名 `ulw-w1`…`ulw-v6`；串行单写者）

---

## 0. 产品模型（主公御定 + 调研佐证）

**首页 = 展示页**：hero（标题 + 一句话价值）+ 双入口 CTA（按用户意图命名：单机版「离线可玩 · 本地记账」→`/offline`、在线版「战绩实时云端」→`/online`）+ 身份区（折叠态）+ 线上战绩卡 + 合并弹框；RSC/SPA 技术形态说明为次级文案。

**offline 单机版**（SPA 形态 `/offline`）：完全离线、本地账本、**无名不记**、页内完局战绩视图（W3 体验）、回首页合并弹框（唯一网络写、显式同步状态）。

**online 在线版**（RSC 形态 `/online`→`/result`）：需 name（入口拦截：无名点击就地引导不导航）；战绩实时上服（服务端权威 recordOutcome）；`/result` = RSC 读 name 行渲染实时成绩单。

**RESTful API**（Azure/RESTfulAPI.net/AIP-136/RFC 9457 调研）：

- `POST /api/sessions`（注册/登录幂等 `{stats,existed}`）
- `GET /api/players/{name}/stats`（无行 404 / 有行 200）
- `POST /api/players/{name}/stats:merge`（单机合并 custom method，409 防静默建档）
- `POST /api/players/{name}/stats/outcomes`（在线版记一局，outcome 子资源创建，服务端权威累加，404）
- 错误统一 RFC 9457 problem+json（`lib/api-problem.ts`）
- **GraphQL 双兼容**：service 层（lib/db.ts 纯函数）与传输层薄壳强制分离成文；未来 GraphQL 只加 schema+resolver 复用 service；README 预留节。

## 1. 语义与命名（schema.org 词汇表对齐，主公御定 online/offline）

- **词汇表核证**：schema.org GamePlayMode 枚举 = SinglePlayer/MultiPlayer/CoOp，表达**参与人数**维度；版本区分是**连接性**维度——两维正交，故 single 歧义、online/offline 正确。PlayAction（agent+object+participant）即「线下两人同乐」的标准语义。
- URL：`/solo`→`/offline`、`/play`→`/online`、`/result` 保留。testid：`start-offline`/`start-online`、`offline-stats`/`offline-stats-grid`/`reset-offline-stats`。
- store mode：`'online'|'offline'`（差异仅记账路径）；删 `lastWriteAt`/StatsHydrator/旧 api 函数。
- localStorage `ttt.solo.*`→`ttt.offline.*`（三 key，旧 key 弃用不迁移，README 注明）。
- 组件：SoloStatsPanel→OfflineStatsPanel、SoloConfetti→WinConfetti（行为命名）、solo/page→offline/page、solo-net→game-net。
- 探针：solo-*-qa→offline-*-qa、pure-local-qa→offline-qa。
- **展示页 JSON-LD**（W3 落地，schema.org 实证）：`@type:["VideoGame","WebApplication"]` + `playMode:MultiPlayer` + `numberOfPlayers(min1,max2)` + `applicationCategory:Game` + `gamePlatform:"Web Browser"` + `operatingSystem:"Any"` + `offers(price 0)`——Next.js metadata/结构化数据即面试展示点。

## 2. 波及面（探索席实证）

退役链 lib/db.ts 四函数→`/api/stats` 2 文件→StatsHydrator→store 旧字段（mode 双分支 store.ts:290-336，无名也记 store.ts:290-330 需加守卫）；路由字符串 ~90 处；vitest 6 文件（store.test 1040 行、db.test ~20 it）；14 探针 12 删改；docs ~47 行；API 调用方 lib/solo-net/OnlineStatsCard/PlayerNameForm/SyncConfirmDialog/HomeDialogMount/tests/api 三文件。

> 调度者复核注（2026-09-19 @ 26d17dd）：`app/api/stats/{route,outcome/route}.ts` 在；prod 引用 `api/stats` 者 = lib/store.ts、components/ResetStatsButton.tsx(+test)；`GameMode` 定义在 lib/store.ts:37（`'ranked'|'solo'`）；`lastWriteAt` 13 处；StatsHydrator 被 app/page.tsx、app/result/page.tsx、components/PlayController.tsx、tests/qa/stats-race-qa.mjs 引用。行号系探索席旧基线，以 rg 实测为准。

## 3. 波次（herdr 3t tab，fresh codex 串行单写者，每波 e2e 录制目验）

| 波 | 主题 | 改动面 |
|---|------|--------|
| W1 | 数据层 | `/api/stats` 链退役；service per-name 改造（+新 `recordOutcomeForName`）；store mode 平移 + 无名不记守卫；db.test 清理；store.test 大改 |
| W2 | RESTful API | 四端点 + problem+json（`lib/api-problem.ts`）+ game-net.ts 调用方 + tests/api 重构 + service 分离契约成文（AGENTS.md） |
| W3 | 展示页 + online 版 | 首页 landing 化（hero+双 CTA+JSON-LD+撤公共卡）；`/online` 入口拦截；phase 驱动导航 `/result`；`/result` RSC 实时成绩单+无 name 兜底；ResultActions 简化；组件测试 |
| W4 | offline 版 + 探针改写 | 全链更名 + stats 视图无名提示 + 12 探针删改 + 新增 one-identity-qa（无名零记账/入口拦截/实时上服/唯一网络写/404/problem+json/RSC 源码/JSON-LD 断言） |
| W5 | 文档 | README（叙事/双版本/API 参考/GraphQL 预留节/旧 key 弃用注/词汇语义说明）、DESIGN（§Modes→双版本）、AGENTS.md + lib/AGENTS |
| V6 | fresh-context 终验 | fresh codex + `$omo:review-work` → reports/review/V7.md；P0/P1 未处置则修复波 |

## 4. AC（机器可判）

| # | 验收项 | 判定 |
|---|--------|------|
| A1 | 退役绝迹 | `/api/stats` 404；全仓无旧函数/StatsHydrator/lastWriteAt 引用（历史存档除外） |
| A2 | RESTful | 四端点 URL/语义/problem+json 逐条断言（404/409/422/幂等 sessions） |
| A3 | 语义清退 | URL/testid/组件/key/探针/docs 零 solo/ranked 残留；`ttt.offline.stats.v1` 生效 |
| A4 | 无名不记（offline）+ 入口拦截（online） | 两形态分别断言 |
| A5 | online 实时 | 完局 → POST outcomes → `/result` 源码含本局新战绩数字 |
| A6 | offline 唯一网络写 | 3 局写请求仅 sessions+merge 各 1 |
| A7 | offline 体验回归 | offline-result-qa 七步全绿 |
| A8 | 展示页 | hero+双 CTA 指向正确+无公共卡+线上卡刷新行为不变；首页 HTML 含 schema.org JSON-LD（VideoGame/playMode/applicationCategory 断言） |
| A9 | 双兼容成文 | service 分离约束 lib/db.ts doc + AGENTS.md；README GraphQL 预留节 + 词汇语义说明 |
| A10 | 门禁 | 六层门禁 × 每 commit 全绿；每波 QA_VIDEO 录像调度者目验后判过 |
| A11 | 终验 | V7 终验无未处置 P0/P1 |

## 5. 执行协议

- 分支：**dev**；计划先入档 `.omo/plans/ulw-one-game-two-versions.md`（docs commit）。
- 每 commit：Conventional + 中文正文（行宽 ≤100）+ lore trailer + `Plan: .omo/plans/ulw-one-game-two-versions.md` footer；**禁 --no-verify、禁 git add -A**（主公侧 .gitignore 不卷入）。
- 探针 **:3101** hermetic 库（`DATABASE_URL=file:/tmp/ulw-og2v/*.db`），不触主公 :3000 活服。
- 通道疫关席换棒：每席首回合先验通道（确认工具调用真实执行，防 ttt-w4 式 harness 拒绝空转）；坏席立即关闭换 fresh 席。
- codex 通道**禁 apply_patch**，编辑一律 shell（sed / python / git apply / heredoc）。
- 派发协议：接收方先 teach-back 复述任务与验收 → 动手；产出未经调度者独立验证视为未完成。
- 完成记 `.omo/sessions.local.md`；调度者不亲自写主线代码。

## 6. Rejected（本轮不做）

- ❌ solo/ranked 词汇保留（与用户意图错位；schema.org 两维正交已核证，online/offline 正名）
- ❌ GraphQL 即刻引入（仅 service/传输分离契约成文 + README 预留节）
- ❌ 旧 localStorage key 迁移（`ttt.solo.*` 弃用不迁移，README 注明）
- ❌ 专设同步页路由（既有合并弹框契约延续）
- ❌ 匿名线上对局记账（online 无名入口拦截，不导航不记账）
