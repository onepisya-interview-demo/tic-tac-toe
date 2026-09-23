# ulw · solo 纯本地化收尾 + UX 紧凑化（对账 + 三波）

- **日期**：2026-09-17
- **状态**：APPROVED（主公 2026-09-17 御批「在 dev 分支上执行……必须按照我的要求来做，并且留下证据」；四决策点 D1-D4 依愚见照准）
- **触发**：主公重申旧 brief（拆分单机 / VT / 名字同步 / 弹框 / 一屏 / 宽度一致 / 抖动 / 结算动画一次）
- **基线**：dev @ 6f20cca（dev ⊇ main，工作树干净）
- **执行体**：fresh codex（herdr **tab**，非 split pane），调度者只拆解、派发、独立验收

---

## 0. 对账结论（先查 git logs 之答）

主公 brief 所列诸项，**大半已落地并经 V3 fresh-context 对抗终验（ACCEPT-WITH-NOTES，reports/review/V3.md）**：

| 主公诉求 | 状态 | 证据 |
|---|---|---|
| 拆分单机模式、复用组件 | ✅ 已落地 | bb171bf BoardGrid / c65d876 GameShell / 4f5ec71 store mode / 2b79d14 /solo |
| MPA 多页跳转动画（antfu 式状态迁移） | ✅ 已落地 | f45ddbf 四页 React 19 `<ViewTransition>`（antfu 命令式的声明式版本，css-tricks 的 `@view-transition{navigation:auto}` 因软导航不卸载文档而弃，决策记录于计划 §2.2） |
| 名字输入 + localStorage 记住 + 跨设备恢复 | ✅ 已落地 | c619df16 solo_records 按名主键 / 569b80d PUT 存名 / sync-qa step04b 跨设备拉回 PASS |
| 合并弹框 + 防重复 + 清本地 | ✅ 已落地 | 700a388 SyncConfirmDialog / a9973b2 per-field 累加 / 1cbcdde 哨兵 / merge-sync-qa 6/6 |
| 结算动画只播一次 | ✅ 已修复 | SoloConfetti `celebratedRef` 单次守卫，V1 复核 PASS（1/1/1） |
| 切换宽度抖动 | ✅ 已修复 | header 三列 grid + StatusBar 四态叠放，四态宽 delta=0，V2 复核 PASS |
| restart 不现于战绩视图 | ✅ 已修复 | `{view==='board' ? <RestartButton/> : null}`，V3 复核 PASS |
| 按钮排版乱 / 375px 响应式 | ✅ 已修复 | 866fbf5 + f419848，V4 复核 PASS（375px 无横向溢出） |
| 玩家名落库 | ✅ 已修复 | PUT `/api/solo-stats` 落行 ≤1s，V5 复核 PASS |
| 四页布局宽度一致 | ✅ 结构已齐 | 四页均 `page-shell`（max-w-[640px]），本轮加探针断言固化 |
| 一屏显示 | ⚠️ 差 19px | V3 实测 solo 375px scrollHeight 686 > 667；DESIGN.md 一屏契约已有，需收紧 |

**故本轮非重做，乃收尾。** 真正悬案三条：

---

## 1. 悬案（本轮要害）

### 悬案一：solo 并非零请求（与主公明谕相悖）

主公谕：「单机版本，不需要发送任何请求，全部存在本地。只有线上版本才需要发送 outcome 请求。」

现实现（lib/store.ts）：**具名玩家每局 auto-POST**（win L354 / draw L399 / retrySoloSync L492 三处）。
匿名玩家才是纯本地。此系波 B 的设计偏差，V3 仅记 MINOR-F4 未判违规。

**本轮正之**：删除三处 auto-POST（F4 之「抽 helper」随之作废——删比抽更净）。
solo 战绩 100% 本地累计 + localStorage；上服务端仅两条路：
① solo 页既有「同步」按钮（merge 弹框，已验证）；
② **新增**：solo → online 导航时自动弹框询问（见悬案二）。

### 悬案二：「切换到在线版本时弹窗」未做

主公谕：「切换到在线版本的时候就弹窗，询问，或者有个专门页面。」
现仅 solo 页手动按钮。本轮：`StartGameButton`（首页「开始对战」）点击时，
若 `pendingSyncCount > 0`（本地 ahead）→ 拦截导航，先弹 SyncConfirmDialog：
- 「合并并清空」→ 同步成功后继续导航 /play
- 「保留本地」→ 直接导航（零网络写，既有语义）
pendingSyncCount === 0 → 静默直行，不弹。

### 悬案三：V3 三条 MINOR 尾账

- **F3**：sync-qa stale-DB 复跑必挂（探针不重置服务端行）→ 探针改用唯一名 `syncprobe-<ts>`（零新增端点，最省）
- **F4**：被悬案一吸收（删除而非抽象）
- **F1**：ux-qa UX_STRICT=1 下 win-glow 1/9 失败（pre-existing 时序）→ 顺手修（strict 断言挪至 result 场景或截图前留 400ms）

---

## 2. 波次设计（串行单写者 + 并行只读调研）

> 同一 worktree 同一时刻只允许一个写者（AGENTS 卫生铁律）。调研只读，可并行。

| 波 | 主题 | 改动面 | 门禁增项 |
|---|------|--------|----------|
| W1 | `feat(solo): 纯本地化——删三处 auto-POST + 首页起战拦截弹框` | lib/store.ts（删 auto-POST 分支 + retrySoloSync + soloSync 状态瘦身）、components/StartGameButton.tsx、components/SyncConfirmDialog.tsx（复用，加「同步后继续导航」回调）、app/page.tsx、AGENTS.md 契约行、README 同步模型段 | 六层 + **Stryker**（store.ts ≥ 50.49 基线）+ **coverage** + merge-sync-qa / sync-qa / solo-mode-qa 更新后全绿 |
| W2 | `fix(qa): sync-qa 唯一名复位 + ux-qa strict win-glow 时序` | tests/qa/sync-qa.mjs、tests/qa/ux-qa.mjs | UX_STRICT=1 9/9 PASS；sync-qa 同 DB 连跑两次 PASS |
| W3 | `fix(ui): 一屏收紧 + sticky 紧凑 header + 宽度一致探针` | app/globals.css（page-shell 移动端 py 收紧）、components/GameShell.tsx（header sticky + backdrop，滚动收紧留白，reduced-motion 无动效路径）、tests/qa/one-screen-qa.mjs（新：375px 四页 scrollHeight ≤ viewport+容差、四页 page-shell 宽恒等）、DESIGN.md §5 动效表 + 52 法则对照段 | 六层 + visual-qa 双端 + 新探针 |
| W4 | `docs: 52 法则对照 + 玩家名最佳实践调研 + 截图重制` | DESIGN.md（法则映射段）、docs/ 或 DESIGN.md（玩家名输入调研结论：label 前置 / n/24 / 即存即忘 对照行业实践）、docs/screenshots/*.png、README 双语 | commit-audit + 人工目验 |
| V4 | fresh-context 对抗终验 | reports/review/V4.md（独立 codex，零共享 session，只许写该文件 + :3101 探针） | V1' 纯本地断网玩局战绩仍累计 / V2' 拦截弹框全路径 / V3' 同 DB 复跑探针 / V4' 一屏 + 宽度恒等 / 六层全绿 |

**并行只读调研（W1-W3 进行时择机派发，产出供 W4 汇编）**：
- R1：玩家名输入表单行业最佳实践（websearch/firecrawl：disable-autocomplete 例外、错误时机、记住我语义、跨设备恢复暗示）
- R2：52 法则中择 5-6 条（初选：菲茨定律、多尔蒂门槛、信噪比、渐进呈现、留白感知、泰斯勒定律）读原文并映射本轮改动
- R3：sanyam.sh/lab 审美参照 → sticky header 收紧的克制边界（延续 DESIGN.md「每动效必注 why not」）

---

## 3. 决策点（请主公裁夺）

| # | 决策 | 建议 |
|---|------|------|
| D1 | 删具名 auto-POST，solo 改纯本地 + 显式同步（悬案一） | ✅ 建议照删——主公明谕优先；跨设备恢复不受损（GET 按名拉回 + merge 弹框均在） |
| D2 | POST `/api/solo-stats`（per-outcome 端点）保留还是删 | **保留**——探针在用、系公开 API 面；仅客户端不再自动调用（删端点则 diff 面扩大，收益低） |
| D3 | 「切换到在线时弹窗」用拦截式弹框还是专设同步页 | **拦截式弹框**——少一路由少一份 RSC 面；既有 SyncConfirmDialog 复用，专页属过度设计（奥卡姆剃刀） |
| D4 | sticky 紧凑 header 是否本轮加 | ✅ 建议加——主公点名「像导航栏一样上下紧凑」；但须守 DESIGN.md 克制契约（无 slide-in、reduced-motion 归零、附 why-not 注释） |

---

## 4. 验收标准（机器可判）

| # | 验收项 | 判定 |
|---|--------|------|
| A1 | solo 全程零网络写（具名亦然） | 断网 + 具名玩 3 局 → localStorage 战绩累计 3；`page.on('request')` 过滤 `/api/` 写请求 = 0 |
| A2 | 具名 + 本地 ahead → 首页点「开始对战」弹框 | pending>0 弹框现；「保留本地」→ 导航且零网络写；「合并并清空」→ 服务端 per-field 累加 + 本地清 + 哨兵更新 + 导航 |
| A3 | pending=0 → 点「开始对战」无弹框直行 | 探针断言 dialog count = 0 |
| A4 | sync-qa 同 DB 连跑两次 PASS | 唯一名策略 |
| A5 | UX_STRICT=1 9/9 | 修复 win-glow 时序 |
| A6 | 375×667 下 /solo 两视图纵向溢出 ≤ 8px；/play /result 严格一屏 | one-screen-qa |
| A7 | 四页 page-shell 宽恒等 | one-screen-qa 断言 |
| A8 | 六层门禁 × 每 commit 全绿；store.ts Stryker ≥ 基线 | 既有脚本 |
| A9 | V4 终验 ACCEPT | reports/review/V4.md |

---

## 5. 执行协议

- 分支：**dev**（已在其上）；Conventional Commits + WHAT/HOW/WHY 正文 + lore trailer + `Plan: .omo/plans/ulw-solo-pure-local-closeout.md` footer
- 执行器：**codex**（herdr tab，每任务 fresh session；**codex 通道禁 apply_patch，编辑一律 shell：sed / python / git apply / heredoc**）
- 派发协议：接收方先 teach-back 复述任务与验收 → 动手；产出未经独立验证视为未完成
- 调度者（本 session）：拆解、派发、轮询、独立验收、终审沉淀；不亲自写主线代码
- 完成后各 worker 采现 session id 记 `.omo/sessions.local.md` 再 /exit + `herdr pane close`
- 探针端口规约：QA 用 :3101，不触主公 :3000 活服

---

## 6. Rejected（本轮不做）

- ❌ 专设「同步页」路由（D3 已裁弹框）
- ❌ 删 POST /api/solo-stats 端点（D2 保留）
- ❌ CRDT / 时间戳合并（同名并发 last-write-wins，README 已注边界）
- ❌ 动画库引入（禁动画库契约不动）
- ❌ `@view-transition { navigation: auto }`（软导航不触发，既往已裁）
- ❌ 重做已落地项（对账 §0 所列）——本轮只收尾
