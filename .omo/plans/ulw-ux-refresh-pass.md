# ulw · 首页战绩链路激活 + solo result 页内化 + 身份区编辑态 + 弹框合规

- **日期**：2026-09-18
- **状态**：APPROVED（主公 2026-09-18 御批 ExitPlanMode；三决策点未获逐条答复，按推荐项与 hotfix 波先例裁决，见 §2）
- **触发**：主公 ：3000 实测反馈（弹框左上角 / 线上卡不刷新 / solo 无 result 体验 / 身份区裸奔 / 调试文案）+ 新谕「所有页面改动必须 e2e 录制并查看 session 后才算通过」
- **基线**：dev @ df69f84（工作树有主公侧 `.gitignore`/.zcode 与 `next-env.d.ts` dev 引用两处未提交改动，本计划全部 commit 禁 `git add -A`，只 add 自改文件）
- **执行体**：fresh codex（herdr **tab**，非 split pane），调度者只拆解、派发、独立验收、e2e 目验

---

## 0. 答疑（不改代码）

| 主公之问 | 答复（证据） |
|---|---|
| 「总场次 1」vs「总场次 5」是什么关系 | 两张不同源的卡：「战绩」卡 = RSC 服务端渲染读 id=1 双人公共行（app/page.tsx:17,35-49）；「线上战绩」卡（online-stats-grid）= 客户端 fetch `GET /api/solo-stats?name=` 读 per-name solo 行（OnlineStatsCard.tsx:45）。数字本就该不同，非同一数据两状态。 |
| `/api/solo-stats?name=` 干什么用 | 线上战绩卡唯一数据源，跨设备只读恢复（A2 红线：响应只入组件 state）。 |
| `/api/stats` 无 name 为何更新成功 | 写路径按硬编码 `STATS_ROW_ID=1` 定位（lib/db.ts:12、:224、:250-259），不依赖 name——ranked 公共行本无用户身份概念，设计使然。 |
| `DELETE /api/stats` 删谁 | 非真删：`resetStats()` = 把 id=1 行 UPDATE 成全零（lib/db.ts:291-295），永不触碰 solo per-name 行。无鉴权为已知缓议（D3）。 |

## 1. 根因（三探索席实证）

- **P1 线上卡永不刷新**：OnlineStatsCard fetch 依赖仅 `[playerName]`（OnlineStatsCard.tsx:66）；合并成功链路（HomeDialogMount.handleConfirm:104-124）无信号到达它；两条事件总线皆死线——`ttt:solo-stats-changed` 无人 dispatch、`ttt:player-name-changed` 无人 listen。
- **P2 重置语义混乱**：首页重置只清 id=1 公共行（ResetStatsButton scope='server' → DELETE /api/stats），UI 未标注作用域；/solo 清空只动 localStorage（store.ts:356-371）。
- **P3 solo 无 result 体验**：/solo 胜利后永留棋盘视图（PlayController.tsx:72 solo 早退）；无「再来一局」主按钮；win-glow 1.4s infinite（globals.css:240）、confetti 1100ms（lib/confetti.ts:23）挂 page 级；SoloConfetti celebratedRef 单次守卫（SoloConfetti.tsx:44-55）是现成挂点；/solo 的 view 切换是页内 state + ViewTransition（app/solo/page.tsx:14,57-63）。
- **P4 弹框左上角**：Tailwind v4 Preflight `* { margin: 0 }`（node_modules/tailwindcss/preflight.css:13）覆盖 UA `dialog:modal { margin: auto }`，项目零补偿（SyncConfirmDialog.tsx:199 无 m-auto、globals.css 零 dialog 规则）；backdrop `bg-black/60` 违反 DESIGN.md:197「禁纯黑 #000，应 bg-base/70 + backdrop-blur-sm」。
- **P5 身份区裸奔**：已登录仍常显 input+登录+清除，无编辑态（PlayerNameForm.tsx:156-292）。
- **P6 调试文案**：「（保存在 localStorage「ttt.player.name.v1」）」+「当前：」硬编码（PlayerNameForm.tsx:281-291），零测试面引用，删除零破坏。
- **波及面**：P3 破 solo-mode-qa step08/09（statsRestart===0 的 V3 断言）+ confetti-origin-qa toggle 竞态；P5 破 PlayerNameForm.test 全部 10 例 + home-return-qa/pure-local-qa 4 处直填步骤；P4/P6 保住 `<dialog>`+showModal+既有 sync-confirm-* testid 即零探针破坏。

## 2. 裁决

- **D1 重置语义 = 标清作用域**：首页按钮改「重置对战战绩」+ 就地 caption「仅清零双人公共战绩，不含线上/单机战绩」。线上 solo 行是跨设备累积，不做破坏性删除。
- **D2 solo 结束切换 = 胜平都切**（对齐在线版 /result 胜负平皆跳的行为）。
- **D3 `/api/stats` 无鉴权 = 接受 demo 语义，列已知缓议**（README 边界注已有；同「同名并发 last-write-wins」同款边界）。

## 3. 波次（串行单写者）

| 波 | 主题 | 改动面 | 门禁增项 |
|---|------|--------|----------|
| W0（并入 W1） | QA 录制基建 | tests/qa/lib/browser.mjs 增 recordVideo + 关键步骤截图约定，证据目录 .omo/evidence/ulw/ulw-ux-refresh-pass/ | W1 自身探针即首验 |
| W1 | `fix(ui): 弹框居中 + backdrop 契约修正 + 删调试文案` | SyncConfirmDialog.tsx（m-auto + backdrop:bg-base/70 + backdrop-blur）、PlayerNameForm.tsx（删调试行 :281-291）、DESIGN.md 若有偏差同步 | 六层 + visual-qa + home-return-qa + e2e 录像目验 |
| W2 | `fix(home): 线上卡刷新链路激活 + 重置作用域标注` | HomeDialogMount.handleConfirm dispatch `ttt:solo-stats-changed`；OnlineStatsCard 监听该事件 refetch + window focus refetch；首页重置按钮文案+caption | 六层 + home-return-qa 增断言（合并后 ≤2s 线上卡=新值；跨设备模拟后 focus 刷新）+ e2e 录像 |
| W3 | `feat(solo): result 体验页内化` | app/solo/page.tsx（订阅 phase → 胜/平后 ~1.2s startTransition(setView('stats'))）、stats 视图加「再来一局」accent 主按钮（restart()+setView('board')）+「返回首页」、board 恒有「重新开局」；改写 solo-mode-qa step08/09 + confetti-origin-qa + 新增 solo-result-qa 探针 | 六层 + e2e 录像（全程 URL=/solo 断言） |
| W4 | `feat(home): 身份区编辑态折叠` | PlayerNameForm.tsx（hasSaved → 只读态：名字+「编辑」；编辑 → input+登录+清除；反向 hydration 保留）；改写 PlayerNameForm.test 10 例 + home-return-qa/pure-local-qa 表单步骤 | 六层 + e2e 录像 |
| V5 | fresh-context 对抗终验 + 独立评审 | fresh codex + **$omo:review-work** → reports/review/V6.md | P0/P1 未处置则修复后复审 |

## 4. e2e 录制验收（主公新谕，全波适用）

每个涉及页面改动的波：探针带视频录制 + 关键步骤截图 → 调度者多模态直读 session 核验后才判测试通过；证据入 `.omo/evidence/ulw/ulw-ux-refresh-pass/<wave>/`。QA 一律 :3101 生产构建，不触 ：3000 活服。

## 5. AC（机器可判）

| # | 验收项 | 判定 |
|---|--------|------|
| A1 | 弹框居中 | 375px 与 1280px 下 dialog 中心与视口中心偏差 ≤8px；backdrop = bg-base/70 + blur（目验+computed style） |
| A2 | 调试文案绝迹 | 「保存在 localStorage」在 DOM 与 .next build 产物零命中 |
| A3 | 身份区折叠 | 已登录只见名字+编辑；点编辑才见 input/登录/清除；改写后 vitest+探针全绿 |
| A4 | 线上卡活链路 | 合并成功 ≤2s 线上卡=服务端新值（data-value 断言）；模拟跨设备变更后 focus → 刷新 |
| A5 | 重置作用域 | 文案+caption 就地标注；点击后公共行清零、线上卡与单机卡数值不变 |
| A6 | solo result 页内化 | win→自动 ≤2s 切 stats 视图 + confetti 出现于战绩视图；draw 同路径；「再来一局」→ board 视图 phase=idle；全程 URL=/solo |
| A7 | 双视图入口 | board 恒有「重新开局」；stats 恒有「再来一局」 |
| A8 | e2e 录制 | 每波录像+截图 → 调度者目验后判过；六层 × 每 commit 全绿 |
| A9 | 终验 | V6.md 无未处置 P0/P1；52 法则映射（反馈环/映射关系/心流/图底关系/图层化/渐进呈现/约束性/信噪比/宽容性/确认性操作）汇编进 DESIGN.md |

## 6. 执行协议

- 分支 **dev**；每 commit Conventional + 中文 WHAT/HOW/WHY 正文 + lore trailer + `Plan: .omo/plans/ulw-ux-refresh-pass.md` footer
- **禁 `git add -A`**（工作树有主公侧未提交改动）；只 add 自改文件
- 禁 --no-verify；每任务 fresh codex session，teach-back 后一回合到底；完成后记 `.omo/sessions.local.md` 再 /exit + pane close
- 调度者：派发、轮询、独立验收（重跑 vitest/探针比对 worker 报数）、e2e 目验；不亲自写主线代码
- 探针端口 :3101；codex 通道禁 apply_patch，编辑走 shell（sed/python/git apply/heredoc）

## 7. Rejected（本轮不做）

- ❌ 删线上 solo 行的重置按钮（D1 裁标清作用域）
- ❌ /api/stats 加鉴权（D3 缓议）
- ❌ solo result 跳独立路由（页内 view 切换已满足「和在线版类似只是不跳页面」）
- ❌ 动画库引入、改 `<dialog>` 为 div modal（原生 showModal 的 focus trap/ESC/inert 是白拿的）
- ❌ 平局不切（D2 裁胜平都切）
