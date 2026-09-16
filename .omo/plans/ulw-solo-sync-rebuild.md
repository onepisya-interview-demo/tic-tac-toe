# ulw-solo-sync-rebuild — solo 同步语义重建 + UI 抖动/动效修复

- **状态**：APPROVED（主公谕 2026-09-17：存名须落库换设备可恢复；同步须弹框问询，合并=单机+线上，同步后清本地防重复，拒同保留；切换不得重播结算动画；宽度不得抖；重开按钮不得现于战绩视图；PlayerNameForm 须响应式；每项 UX 决策须对齐调研；执行器 fresh codex；终验 fresh-context 对抗）
- **输入工件**：/tmp/ttt-wave1/{diag,rux,rvt}.md（三路只读调研，已互证）
- **审美参照**：sanyam.sh/lab（sub-second 节律、box/content 解耦、每动效须有「为什么」注释）
- **总原则**：双线文件面正交并行（worktree 各一）；门禁六层每 commit；reduced-motion 归零保底；不 push 不 PR

## 病灶（diag 实证根因）

1. **Bug A 名不入库**：`PlayerNameForm.handleSubmit` 只写 localStorage+store（0 fetch）；`GET /api/solo-stats` 纯读不自建行；唯 solo 完局 POST `{name, outcome}` 方建行。主公「存名即登记、换设备可恢复」契约缺位。sync-qa step02 只断本地态、step04 靠下棋建行——探针盲区。
2. **Bug B 动画重播**：`SoloConfetti` 在 `view==='board'` 分支内，toggle 即 unmount/remount → `Confetti` useEffect 重播 burst（实测 confettiInDom true→false→true）。
3. **Bug C 宽度抖动**：StatusBar 脉冲点仅 playing 态渲染（dot+mr=24px，实测按钮宽 62→46px 跳 16px）；view-toggle 无 min-width；Card 棋盘↔战绩高差 ~80px；header flex space-between 随文本重排。

## 波次编排

### 波 A · W-UI（fresh codex，worktree feat/solo-ui-fixes，PORT=3101）

文件面（严格限于）：`app/solo/page.tsx`、`components/GameShell.tsx`、`components/ui/StatusBar.tsx`、`components/SoloConfetti.tsx`、`components/ui/Card.tsx`、`app/globals.css`、`DESIGN.md`（§5 动效行）、`tests/qa/`（探针）。
禁碰：`components/PlayerNameForm.tsx`、`components/SoloStatsPanel.tsx`、`lib/store.ts`、`lib/solo-net.ts`、`app/api/**`、`AGENTS.md`（B 线领地）。

- A-T1（Bug B）：`SoloConfetti` 提升出视图三元，置于 `ViewTransition(key=view)` 之外、GameShell 同层；渲染条件 `view==='board' && phase==='won'`；testid 契约不变。探针：toggle 往返 burst 次数不变。
- A-T2（Bug C）：header 改 `grid grid-cols-[auto_1fr_auto]` 三列锁位（h1 | statusSlot | SoundToggle）；StatusBar 三态文本 grid-stack 同格叠放（`grid-area:1/1` + opacity 切换，宽度恒取最宽者，rvt 决议 2）+ `min-width` 兜底；脉冲点常驻占位或并入 stack 消 24px 跳。探针：对局全程 view-toggle 宽 max−min < 2px。
- A-T3（Bug C 高度）：solo Card `min-h` 锁高（取两视图大者）+ Card 容器 `viewTransitionName: 'solo-card'` 使两态同位 morph（rvt 决议 3）。
- A-T4：重开/返回按钮按视图条件渲染——`restart` 仅 board 视图；stats 视图 DOM 无 `data-testid="restart"`。solo-mode-qa 断言同步。
- A-T5：globals.css `@supports` 块末尾注释契约：本仓刻意不启用 `@view-transition { navigation: auto }`（App Router 已 100% 拦截，rvt 决议 1）。
- A-T6：新动效注释「为什么不选另一条」（sanyam 克制原则）；DESIGN.md §5 增行。
- commit ≤4，原子。

### 波 B · W-SYNC（fresh codex，worktree feat/solo-sync-merge，PORT=3102）

文件面（严格限于）：`app/api/solo-stats/**`、`lib/db.ts`、`lib/store.ts`、`lib/solo-net.ts`、`lib/player-name.ts`、`components/PlayerNameForm.tsx`、`components/SoloStatsPanel.tsx`、`components/SyncConfirmDialog.tsx`（新）、`AGENTS.md`（契约行）、`README.md`（边界注）、`tests/`。
禁碰：`app/solo/page.tsx`、`components/GameShell.tsx`、`components/ui/StatusBar.tsx`、`components/SoloConfetti.tsx`、`components/ui/Card.tsx`、`app/globals.css`、`DESIGN.md`（A 线领地）。

- B-T1（Bug A）：新增 `PUT /api/solo-stats`（body `{name}`，幂等 upsert 空战绩行，name 白名单照 POST）；`PlayerNameForm` 保存成功后 fire-and-forget PUT（8s 超时 fail-soft，失败仅本地生效不阻断）；探针 step02.5：存名 500ms 内 GET 返回非 null 全零行。
- B-T2（合并 API）：`POST /api/solo-stats/sync`（body `{name, stats}`）→ server 读行（无则空）→ `accumulate` 合并 → upsert → 返回合并后 `{stats}`；server 权威，客户端禁预写全行（AGENTS 反模式）。
- B-T3（弹框）：`SyncConfirmDialog`——触发：solo-sync 钮（本地有未同步战绩时）。文案正框架（rux 决议 3/4）：主「合并战绩」+ 副「将上传本机 N 局；同步后本机清零以防重复」；未命名时弹框内含名字输入（1-24 字符规则前置 label，rux 决议 1）；选项「合并并清空」（主）/「保留本地」（次），禁 Confirm/OK 通用动词。实现原生 `<dialog>` 或自制 modal，不引库；ESC 关闭、焦点管理、reduced-motion。数字 fuse 与 undo toast 裁剪不做（Rejected：轻量作品集 + undo 需反向 API，复杂度失衡）。
- B-T4（同步语义）：确认 → `PUT`(若新名) → `POST /sync` → 成功后清本地 solo stats（沿用 fail-soft）→ 面板示合并明细（「线上 a + 本机 b = 共 c」rux 决议 8）→ 钮退化为纯 GET 刷新（wave2 §A5 契约）。拒同步：零改动保留本地。防重复：本地清零后 sync 无源可并，天然幂等。
- B-T5：`PlayerNameForm` 响应式——375px 纵排（input 全宽、按钮行全宽纵排）、sm+ 横排；label「名字（1-24 字符）」+ `n/24` live 计数；「当前」行 + 编辑 affordance（rux 决议 1/2）。
- B-T6：AGENTS.md 契约行（PUT/sync API + lib 入口）、README 同步模型边界注更新。
- 探针：sync-qa 补 step02.5 + 04b（save-only 跨设备）；新 `tests/qa/merge-sync-qa.mjs`（合并数字正确/清零/重复点幂等/拒同保留/422 对抗）。
- commit ≤5，原子。

### 波 C · V3 终验（fresh codex，对抗复核）

- merge 双线入 main（调度者执行）→ 六门禁全量 + 全探针（desktop+mobile）+ 双线验收逐条复核 + 对抗用例（名非法输入/ Turso 超时降级/ reduced-motion/ 键盘全链）。
- 产出 `reports/review/V3.md`，终判 ACCEPT / ACCEPT-WITH-NOTES / REJECT。

## 验收标准（可机器判定）

- V1 Bug B：`view-toggle` 往返后 confetti burst 调用数不变；`[data-testid="confetti"]` 每胜局恰一 mount。
- V2 Bug C：一局全程（idle→playing 轮换→won）`view-toggle` 宽 max−min < 2px；375×667 solo 两视图 `scrollHeight <= viewport.height`；Card 高度跳 < 8px（min-h 锁定后）。
- V3 stats 视图无 `restart` 节点；board 视图有。
- V4 375px：PlayerNameForm 纵排无横向溢出；sm+ 横排。
- V5 Bug A：UI 存名 → ≤1s 内 GET `{name}` 非 null（全零行）；新 context 同名打开 /solo 面板示该名线上战绩。
- V6 合并：本地(3,2,1,0)+线上(2,1,0,1) → sync 后 GET=(5,3,1,1)；本地清零；再点同步数字不变；拒同步本地原样。
- V7 弹框：ESC 可关、焦点入弹框、reduced-motion 瞬时；「保留本地」后零网络写。
- V8 六门禁全绿（双线各自 + 合并后 main）；既有八探针 + visual-qa 双端无回归。
- V9 commit 原子、lore trailer 全套、Plan footer；不 push 不 PR。
- V10 V3 终验 ACCEPT。

## 风险备忘

- 双 worktree 各自 `pnpm install`（pnpm store 复用，快）；探针端口 3101/3102，3000 主公活服永不碰，3100 已释。
- merge 冲突裁决权在调度者；AGENTS.md 仅 B 线可改，DESIGN.md 仅 A 线可改——防撞。
- Turso 形制：PUT/sync 走 `accumulateSoloRecord` 同一 upsert 点，file:sqlite 与 Turso 双形制自洽（照 sync 探针隔离惯例）。
- B-T3 未做 fuse/undo（Rejected 已注）；若主公欲加，另立计划。
- 00:00±15min 窗口不做批量文件操作。

**Plan: .omo/plans/ulw-solo-sync-rebuild.md**
