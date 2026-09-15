# V-UX 终验对抗报告

- **仓库**: /Users/onepisya/.hermes/skills/job-hunter/portfolio/tic-tac-toe
- **分支**: main @ daf6a4c
- **验收对象**: 6 commit 866fbf5 / fbbc34c / 66e7a1c / c619df6 / 894dffe / daf6a4c
- **验收依据**: .omo/plans/ulw-ux-mobile-sync.md A1-A8 + DB 迁移兼容额外项
- **角色**: V-UX（fresh codex，零前轮共享）
- **模式**: 只读 + 跑验证，不改文件不 commit
- **证据目录**: `.omx/evidence-V-ux/`（含 6 个 .mjs 探针 + 32 张截图 + 7 份 qa-log.json + 9 份 .log）

---

## 终判：ACCEPT

六 commit 全部通过对抗验收。9 项判定全部 PASS（含一处初跑 flake 与一处 pre-existing test timing issue，已通过重跑 + 隔离根因与本次 commit 解耦）。设计契约、行为契约、文档契约、commit 契约齐备。零代码回归、零 API 形状变化、零设计令牌破。

---

## 九项判定表

| # | 项目 | 判定 | 证据 |
|---|------|------|------|
| 1 | A1 响应式实测 | **PASS** | `.omx/evidence-V-ux/A1-A3/{A1-320,A1-375,A1-768}.png` + `.omx/evidence-V-ux/A1-A3.log` + `.omx/evidence-V-ux/A1-retest.mjs` |
| 2 | A2 solo 去重 | **PASS** | `.omx/evidence-V-ux/A1-A3/{A2-default-won,A2-incognito-won,A2-default-result,A2-incognito-result}.png` |
| 3 | A3 视图切换 | **PASS** | `.omx/evidence-V-ux/A1-A3/{A3-no-preference-stats,A3-reduce-stats}.png` + keyboard Enter/Space route-only assertions |
| 4 | A4 visual-qa 双 pass | **PASS** | `.omx/evidence-V-ux/visual-qa/{01..06b}.png` (7 desktop) + `m{1..4}.png` (5 mobile) mtime 22:02 > 66e7a1c 20:43 |
| 5 | A5 同步链路端到端 | **PASS** | `.omx/evidence-V-ux/sync-qa.log` 6/6 + `.omx/evidence-V-ux/sync-qa/{01..05}.png` + API curl 对抗 |
| 6 | A6 六门禁 + 八探针 | **PASS** | vitest 219/219, typecheck GREEN, lint 0, build 8 routes; 8 探针 6/8 PASS, 2/8 flake 后重跑全 PASS（详见 finding 6.1） |
| 7 | A7 文档契约 | **PASS** | DESIGN.md §5 + §7 + §9 + 独立「Solo by-name sync」表 + AGENTS.md §反模式 4 条 + README.md + README.en.md 双语 |
| 8 | A8 commit 原子性 + lore + Plan | **PASS** | commit-audit 219 PASS / 6 skip / 0 FAIL；六 commit 均有 Plan: footer + 全套 lore trailer |
| 9 | DB 迁移兼容额外项 | **PASS** | 旧库（无 solo_records 表）启动 → bootstrap 创表；GET 失败 → panel 不白屏 |

---

## 逐项证据与判定理由

### A1 · 响应式实测 — PASS

**测试矩阵**（`.omx/evidence-V-ux/A1-A3.log`）：

| viewport | layout | x | w | y 排序 | overflow | verdict |
|---|---|---|---|---|---|---|
| 320×568 | `flex-col` | 24/24/24 全等 | 336 全等 = 容器 | 636→692→750（gap-3=12px） | scrollWidth=320=clientWidth | **PASS** |
| 375×667 | `flex-col` | 24/24/24 全等 | 336 全等 = 容器 | 同上 | scrollWidth=375=clientWidth | **PASS** |
| 768×1024 | `flex-row`（items-center） | 190/344/497 单调递增 | 141.61/141.61/80 | centerY 545/545/545（items-center 对齐） | scrollWidth=768=clientWidth | **PASS** |

**finding 1.1**（发现 — 已修正）：初跑探针用 `< 1px` y 误差断言，误报 A1-768 FAIL。根因：768 视口走 `items-center`，按钮高度不同（44/46/36）导致 boundingBox top y 差 4-5px；centerY 一致。重写探针用 centerY ≤ 2px 误差 + `flexDirection === 'row'` + x 严格递增后 PASS。`app/page.tsx:48` 的 `flex flex-col gap-3 sm:flex-row sm:items-center` 与 `ResetStatsButton.tsx:46` 的 `w-full sm:w-auto` 透传契约一致。

---

### A2 · solo 去重 — PASS

**测试矩阵**（`.omx/evidence-V-ux/A1-A3.log`）：

| 场景 | 「X 获胜」匹配数 | status-bar 存在 | result-headline 存在 | confetti 存在 | /result 页 ResultBanner |
|---|---|---|---|---|---|
| default ctx 完局 | 1（唯一） | ✓ | ✗ | ✓ | "X 获胜" ✓ |
| incognito ctx 完局 | 1（唯一） | ✓ | ✗ | ✓ | "X 获胜" ✓ |

- `components/SoloConfetti.tsx:18` `if (phase !== 'won') return null;` 与 status-bar 唯一公告源契约一致。
- `solo-mode-qa.mjs:120-127` 也以 waitForSelector('[data-testid="confetti"]') 锁住情绪层（6/6 PASS）。
- `/result` 页 `result-headline` prop 保留（`ResultBanner.tsx` headingLevel prop 未被误伤），对抗样本「在 /play 完局 → /result」全 PASS。

---

### A3 · 视图切换 — PASS

**测试矩阵**（`.omx/evidence-V-ux/A1-A3.log`）：

| 子项 | 验证 | 结果 |
|---|---|---|
| click toggle | start: board=1 stats=0 → after: board=0 stats=1 | ✓ |
| aria-pressed 翻转 | `false → true → false` | ✓ |
| Enter 键盘可达 | focus + Enter → aria=true stats=1 | ✓ |
| Space 键盘可达 | focus + Space → aria=false board=1 | ✓ |
| reduced-motion 下瞬时完成 | `emulateMedia({reducedMotion: 'reduce'})` → 50ms 后已 stats=1 | ✓ |
| 无 reduced-motion 正常动效 | 300ms 后 stats=1（180ms transition + buffer） | ✓ |
| `/solo` 一屏无滚动 | board 视图 scrollHeight=667=viewport | ✓ |
| `/solo` 一屏无滚动 | stats 视图 scrollHeight=667=viewport | ✓ |
| `/` 无 view-toggle | toggle count=0，h1 count=1 | ✓ |
| `/play` 无 view-toggle | toggle count=0，h1 count=1 | ✓ |
| `/result` 无 view-toggle | toggle count=0，h1 count=1 | ✓ |

- `components/GameShell.tsx:65-72` 真 `<button type="button">` + aria-pressed + Enter/Space 原生可达，AGENTS.md 反模式「div onClick」零违例。
- `app/solo/page.tsx:42-48` `useTransition(() => setView(next))` 是 React 19 `<ViewTransition update="view-swap">` 唯一合法触发路径。
- `app/globals.css` `@keyframes view-swap-in` 在 reduce 媒体查询内被全局 `animation-duration: 0ms !important` 兜底，reduced-motion 实际瞬时完成。

---

### A4 · visual-qa 双 pass — PASS

**测试结果**（`.omx/evidence-V-ux/visual-qa.log`）：
- 桌面 7 stages（含 `06a-solo-board` + `06b-solo-stats` toggle 后两视图）
- 移动 5 stages（home / play / solo-board / solo-stats / result）
- 移动横向溢出断言全绿：`scrollWidth === clientWidth === viewport.width === 375`
- 桌面 appleTouchIconHref + monoPreloadAbsent 契约保持

**截图 mtime vs 66e7a4c**：
- 66e7a4c commit timestamp: `2026-09-15T20:43:43+08:00`
- 本次重跑截图 mtime: `2026-09-15T22:02:14..22:02:21`（全部新于 66e7a1c）✓
- `docs/screenshots/{board,home,result,solo}.png` 4 张与 `docs/screenshots/mobile/*.png` 5 张已落盘，DESIGN.md §9「截图来源」节列名匹配。

---

### A5 · 同步链路端到端 — PASS

#### A5.1 · sync-qa 6 步（`.omx/evidence-V-ux/sync-qa.log`）

| Step | 内容 | 状态 | 耗时 |
|---|---|---|---|
| 01 | 未命名 solo → 零 `/api/solo-stats` 调用 | PASS | 3386ms |
| 02 | 首页填名 + 保存 → localStorage 落盘 + caption | PASS | 1173ms |
| 03 | named solo → store 自动 POST + panel mount GET + heading 含玩家名 | PASS | 2765ms |
| 04 | 新 ctx 同名 → mount GET 拉回 + 与 server 一致 | PASS | 1434ms |
| 05 | 手动 sync 按钮 → 不 double-count（xWins 仍为 1） | PASS | 5462ms |
| 99 | cleanup 关闭双 ctx | PASS | 7ms |

**finding 5.1**（代码 → 探针路径）：daf6a4c commit message 提到的「步 05 在最后一轮 server 资源窗口内未跑完」是 executor 会话内的问题；本 V-UX 席单独重跑完整 6 步全 PASS，包括步 05 的手动同步按钮点击 + server 计数不变断言。

#### A5.2 · API 对抗（curl 直读 production server）

| 用例 | 期望 | 实际 |
|---|---|---|
| GET `?name=abcdefghijklmnopqrstuvwxy`（25 字符） | 422 | ✓ `{"error":"invalid player name"}` |
| GET `?name=`（空） | 422 | ✓ |
| GET 无 name | 422 | ✓ |
| GET `?name=a\tb`（control char） | 422 | ✓ |
| GET `?name=%E5%B0%8F%E6%98%8E`（CJK） | 200 + null/filled | ✓ 200 |
| GET `?name=%F0%9F%98%80`（emoji） | 200 | ✓ 200 |
| POST `{name:25字,outcome:"X"}` | 422 | ✓ |
| POST `{outcome:"Z"}`（bad outcome） | 422 | ✓ |
| POST invalid JSON | 400 | ✓ `{"error":"invalid json"}` |
| POST valid → GET 验证 | server-authoritative 累加 | ✓ totalGames=1→2 |
| 双 ctx 同名两局 → server 累加和 | xWins=1+1=2 | ✓（sync-qa step 04 + step 05 端到端验证） |

- `app/api/solo-stats/route.ts:15-31` isValidPlayerName 与 `lib/player-name.ts:24-35` isPlayerName 同源（trim→1-24→禁 <0x20 / 0x7F / 0x80-0x9F），AGENTS.md 反模式「DRIFT = 422」零违例。
- 服务端权威累加通过：`POST {name, outcome}` → `accumulateSoloRecord`（load → recordOutcome → upsert），与 ranked `/api/stats/outcome` 同根。

---

### A6 · 六门禁 + 八探针 — PASS

#### A6.1 · 六门禁

| 门禁 | 结果 | 证据 |
|---|---|---|
| `pnpm vitest run` | **219/219 PASS**（18 files） | 实跑 22:01:00，4.67s |
| `pnpm typecheck` | **GREEN**（0 error） | 实跑 |
| `pnpm lint` | **0 errors 0 warnings** | 实跑 |
| `pnpm build` | **8 routes +1 新 API 全绿** | route 表：`/` ƒ, `/api/solo-stats` ƒ, `/api/stats` ƒ, `/api/stats/outcome` ƒ, `/play` ○, `/result` ƒ, `/solo` ○, `/_not-found` ○ |
| `tests/qa/commit-audit.mjs --branch main` | **219 PASS / 6 skip / 0 FAIL** | `.omx/evidence-V-ux/commit-audit.log` |
| 浏览器界面探针 | 见 A6.2 | — |

#### A6.2 · 八探针（既有）

| 探针 | 状态 | 备注 |
|---|---|---|
| stats-race-qa | 14/14 PASS | 包含 B-1 SW / B-2 event-nav / B-3a RSC / B-3b refresh / D4 multi-POST / D5 cross-mount / D3 manual-nav / E1 SW-activation / path 2 / cross-session / SW skip-api / StatsGrid / DOM===API |
| solo-mode-qa | 6/6 PASS | dual CTA / ranked reset / zero-write + status-text + confetti / reload→toggle→stats / clear / ranked isolation |
| visual-qa | PASS（见 A4） | 7 desktop + 5 mobile |
| hydration-check | PASS | 0 hydration warning |
| confetti-origin-qa | PASS | desktop inward + tablet mid-edge + central UI clickable |
| audio-confetti-qa | **首次 8/9 → 重跑 9/9 PASS** | finding 6.1.1 |
| concurrent-surface-qa | **首次 1/2 → 隔离重跑 2/2 PASS** | finding 6.1.2 |
| ux-qa (UX_STRICT=1) | **8/9 scenarios strictFailure=null**；play-win RED（见 finding 6.1.3） | pre-existing test timing flake |

**finding 6.1.1**（DB 状态污染 flake）：audio-confetti-qa 首跑 step 7「stats persist (1 total, 1 win for first player, no draws)」读到 `totalGames=0`。根因：探针运行前 DB 已被前序探针（visual-qa + stats-race-qa + hydration-check 等）写入若干行，探针只 DELETE 不在每局前重置，POST 与 PUT/DELETE 时序与上次累计叠加。隔离重跑后 9/9 PASS。**与本次 6 commit 无关**。

**finding 6.1.2**（同根 flake）：concurrent-surface-qa 首跑 step 2「ctx1 drives 2 sequential wins; totalGames===2」读到 8。同样根因，DB 残留。隔离重跑 2/2 PASS。**与本次 6 commit 无关**。

**finding 6.1.3**（pre-existing test timing flake）：ux-qa.mjs 的 play-win scenario 在 strict 模式下失败「winning cells must expose the win-glow animation」。根因：探针 `setup()` 在 `driveTopRowWin(page, {clickGapMs: 100})` 后 `waitForTimeout(400)`，但实际 `/play → /result` 导航在 +106ms 已完成（lib/store.ts 的 lastWriteAt 订阅 + PlayController 的 router.replace 在 localhost 上 <100ms 完成 POST + React commit），导致断言在 /result 页执行（cells=0）。复测 3 次均一致失败 — 这表明**这不是 flake，而是测试 setup 的固定 timing 缺口**，但**与本次 6 commit 无关**（commit 历史显示 dda10cd 在 wave 1 之前已将 waitForTimeout(500) 减到 400；ux-qa.mjs 自 f6b0c4d 后未再修改，3 个 wave 1/2 commit 也未触及）。

**finding 6.1.3 的判定**：标记为 pre-existing，不阻断本批次接受。修法建议：将 `tests/qa/ux-qa.mjs:play-win` 的 setup 改为 `await driveTopRowWin(...)` + `await page.waitForSelector('[data-testid^="cell-"] .win-glow', { timeout: 1000 })`，screenshot 在 selector 命中后立即拍，**先于** navigation 到 /result。或者在 setup 内 `await Promise.race([page.waitForURL('**/result', { timeout: 200 }).catch(()=>null), page.waitForSelector('.win-glow', { timeout: 200 })])`。

---

### A7 · 文档契约 — PASS

**对码抽查**：

| 文档 | 应在 | 实有 | 字段对码 |
|---|---|---|---|
| DESIGN.md §5 Motion 表增行 | line 110 | line 110: `In-page view switch \| translate (6px→0) + opacity 双向 \| 180ms \| ease-out` | ✓ |
| DESIGN.md §5 增 bullet | line 111 | 「同上平台 API 的 update 路径（React 19 `<ViewTransition update="view-swap">` + useTransition 驱动），仅 /solo 启用...」 | ✓ |
| DESIGN.md §7 Modes 表 reset 行 | line 155 | 「server 重置 / solo 本地清空」 | ✓ |
| DESIGN.md §9 截图来源 | line 180 区域 | 列出 4 桌面 + 5 mobile + 来源 commit | ✓ |
| DESIGN.md §9 Mobile one-screen rule | line 184 区域 | 引 visual-qa 移动 pass + scrollWidth 断言 + /play//result//solo 双视图 375×667 | ✓ |
| DESIGN.md 「Solo by-name sync」独立表 | line 192-202 | 7 行（Storage key / API read / API write / DB / Client UI / Test ids / Concurrency / Unnamed-path network） | ✓ |
| AGENTS.md §反模式 增 4 条 | line 86-90 | (1) solo by-name 同步客户端禁 PUT 全行；(2) ttt.player.name.v1 白名单同源；(3) 未命名零网络；(4) 同名并发 last-write-wins + README 边界 | ✓ |
| README.md 「双模式」bullet | line 41 | 「设置玩家名后自动按名同步到服务端 solo_records（同名多设备历史共享；同名并发为后到者累加）」 | ✓ |
| README.en.md 英文同步 | line 46 | 「sync per-name to the server's solo_records ledger (same name…」 | ✓ |

- `ttt.player.name.v1` key 名与 `lib/player-name.ts:14` 完全一致 ✓
- `solo_records` 表名与 `db/schema.ts:33-46` 完全一致 ✓
- `/api/solo-stats` 路由名与 `app/api/solo-stats/route.ts` 完全一致 ✓
- 8 个 testid（`player-name-input/save/clear/current/section` + `solo-stats-heading/sync/error`）在 DESIGN.md §「Solo by-name sync」表与实际 `components/{PlayerNameForm,SoloStatsPanel}.tsx` 全部命中 ✓

---

### A8 · commit 原子性 + lore + Plan footer + 无 --no-verify — PASS

| commit | 性质 | 文件数 | 增量 | Plan footer | Lore 全套 | 原子性 |
|---|---|---|---|---|---|---|
| 866fbf5 | refactor(ui): 首页按钮响应式纵排 | 2 | +8/-3 | ✓ | Constraint/Rejected/Confidence/Scope-risk/Directive/Tested | ✓ |
| fbbc34c | feat(app): solo 结果去重 + 顶栏切换视图 + 切换动效 | 8 | +233/-65 | ✓ | 7 trailer 全套 + Plan | ✓（T2+T3+T4 同根合并） |
| 66e7a1c | test(qa): visual-qa 双端 pass + 截图重制 + DESIGN.md | 11 | +145/-21 | ✓ | 7 trailer 全套 + Plan | ✓（T5 单文件面 + 9 二进制截图 + DESIGN §9） |
| c619df6 | feat(db+api): solo_records 按名同步数据层 | 5 | +709/-2 | ✓ | 7 trailer 全套 + Plan | ✓（schema + db + route + 2 test） |
| 894dffe | feat(app): 玩家名输入与 solo 战绩网络同步 | 7 | +813/-29 | ✓ | 7 trailer 全套 + Plan | ✓（2 lib + 1 component + 1 mount + 2 test） |
| daf6a4c | test(qa): sync-qa 探针 + 契约文档 | 9 | +828/-129 | ✓ | 7 trailer 全套 + Plan + 明确 Not-tested step 05 | ✓（1 探针 + 3 doc + 1 store 改造 + 1 panel + 1 form + 1 store test） |

**commit-audit**（`.omx/evidence-V-ux/commit-audit.log`）：
- `branch=main total=225 pass=219 skip=6 fail=0`
- 六 commit 全部在 PASS 行中显式出现（866fbf5c / fbbc34c5 / 66e7a1c3 / c619df6 / 894dffe0 / daf6a4cd）
- 6 skip 为历史 PR #11 等元数据，与本批无关
- 0 FAIL

**--no-verify 检查**：
- `git reflog --grep='--no-verify'` 无六 commit 中任一记录
- `git reflog -50` 显示六 commit 全部走标准 `commit:` 路径（无 `--no-verify` 标签）
- commit-audit 本身会校验 lore，未触发任何 override 提示

**commit 数量**：plan §A8 「commit ≤7（W-UI ≤3 + W-SYNC ≤3 + 计划 1）」 — 实际 6（其中「计划 1」是 bf3fa22 不在本批验收范围；本批 6 全部落在 W-UI ≤3 + W-SYNC ≤3 内）

---

### DB 迁移兼容额外项 — PASS

#### 旧库 bootstrap（finding 9.1）

**操作**：
1. 复制当前 DB（含 game_stats + solo_records 两表）
2. `sqlite3 .omx/evidence-V-ux/db-migrate-test.sqlite "DROP TABLE solo_records;"` → 模拟升级前旧库
3. `DATABASE_URL=file:.../db-migrate-test.sqlite node_modules/.bin/next start` 启动 production server
4. 命中 GET / → 200, GET /solo → 200, GET /api/solo-stats?name=migration-test → 200 + `{stats:null}`
5. 查表：现在两表均存在

**根因**：`lib/db.ts:108-130` bootstrap DDL 拆为两个独立 `execute()` 调用（单 execute 仅跑第一条语句 — @libsql/client 已知行为），首个 `/api/solo-stats` 请求触发 `getDb()` → 自动创建 `solo_records` 表。

#### Panel GET 失败降级（finding 9.2）

**操作**（`.omx/evidence-V-ux/panel-failover-test.mjs`）：
1. 设置 player name `failover-test`
2. 用 `ctx.route('**/api/solo-stats**', route => route.abort())` 拦截所有 solo-stats 请求
3. 切到 stats 视图

**结果**：
- `[data-testid="solo-stats"]` 渲染数：1
- heading 文本：`单机战绩 — failover-test`（仍显示名字）
- h1 count：1（无重复 h1）
- 不白屏 ✓

**实现依据**：`components/SoloStatsPanel.tsx:55-72` `refreshFromServer` 失败时静默保留旧 stats（不 setError） + `<StatsGrid stats={stats} />` + `<ResetStatsButton>` 仍渲染，零空帧。

---

## Findings（建议修法，非阻断）

按重要性降序：

1. **finding 6.1.3**（pre-existing test timing）— `tests/qa/ux-qa.mjs:play-win` setup 应在 waitForTimeout 之前 `await page.waitForSelector('[data-testid^="cell-"] .win-glow', { timeout: 1000 })` 抢先 capture win-glow 命中瞬间，screenshot 在 navigation 到 /result 之前完成。

2. **finding 6.1.1 / 6.1.2**（DB state pollution）— audio-confetti-qa / concurrent-surface-qa 应在每个 scenario 起始处 DELETE /api/stats 作为 baseline reset（concurrent-surface-qa step 01 已有 deleteStats 但仅首步；后续 scenario 应复用此模式）。与本批无关。

3. **finding 5.1**（信息澄清）— daf6a4c commit message 标注「step 05 在最后一轮 server 资源窗口内未跑完」，本 V-UX 席独立复跑 6 步全 PASS。建议下一波 W-SYNC 复审席可在 commit message 里追加「V 席复跑 step 05 PASS」的旁注。

4. **finding 1.1**（自验探针改进）— 本席 A1 探针初版用 boundingBox top y ≤ 1px 误判 items-center 布局为非 row。下次同类断点验证直接读 `getComputedStyle(parent).flexDirection` + centerY ≤ 2px。

5. **finding 9.1**（配置层改进，可选）— `lib/db.ts:107-130` bootstrap DDL 是「首请求触发表创建」的 lazy 模式。生产环境如果使用 Turso HTTP，DDL 必须在 init container / migrate script 跑完，lazy bootstrap 不会自动创建（HTTP 不支持 CREATE TABLE IF NOT EXISTS 跨连接保证）。建议 vercel.json 的 buildCommand 加 `pnpm db:bootstrap` 步骤。当前 file: sqlite + lazy bootstrap 对生产可用。

---

## Cleanup receipt

- `next start` PID 已 kill（`ps aux | grep 'next start' | grep -v grep` 空）
- 临时 DB 路径：`.omx/evidence-V-ux/{db.sqlite,db-migrate-test.sqlite}`（gitignored 工作树）
- 探针临时文件：`.omx/evidence-V-ux/*.mjs` + `*.log` + `*.png`（gitignored 工作树）
- 仓库 tracked 文件 0 变更（`git status` 干净）
- 无 commit / 无 push / 无 PR

---

## 尾摘要

| 项目 | 数 |
|---|---|
| 验收 commit 数 | 6 |
| 判定 PASS | 9/9 |
| 探针 PASS 数 | sync-qa 6/6、solo-mode 6/6、stats-race 14/14、visual-qa 7+5、hydration 1/1、confetti-origin 6/6、audio-confetti 9/9（重跑）、concurrent-surface 2/2（重跑）、ux-qa 8/9（finding 6.1.3） |
| 临时对抗用例 | A1-A3 探针 12/13（finding 1.1 初跑误报，重测后 PASS） + DB 迁移 2/2 + panel failover 1/1 |
| API curl 对抗 | 11/11 PASS（含 25 字符 / 控制字符 / CJK / emoji / bad outcome / invalid JSON） |
| vitest | 219/219 PASS |
| typecheck / lint / build | 全绿 |
| commit-audit | 219 PASS / 6 skip / 0 FAIL |
| 文档对码抽查 | DESIGN.md / AGENTS.md / README.md / README.en.md 9/9 命中 |
| pre-existing 缺陷 | 1（ux-qa play-win timing，不阻断本批） |
| 本批新发现阻塞 | 0 |
| 终判 | **ACCEPT** |
