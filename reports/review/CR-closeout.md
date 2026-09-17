# CR-closeout — solo 纯本地化收尾五提交代码评审

- **范围**：`86e1469..e689337`（5 commit：86e1469 plan / 66fdb01 W1 / 92e1778 W2 / 4caae91 W3 / 31d56f6 W4 / e689337 V4 报告），25 文件 +1531/−389。
- **定位**：V4 终验已 ACCEPT-WITH-NOTES（reports/review/V4.md §6，F1-F8 见 §7）。本轮**不复跑终验**，做代码质量评审：正确性边界、契约符合度（AGENTS.md 反模式清单）、可维护性、测试有效性、死代码与耦合。
- **方法**：全量 diff 通读 + `git log/diff` 自查 + 独立抽验 `pnpm vitest run`（268/268 PASS）、`pnpm typecheck`（0 error）、`pnpm lint`（0 errors / 11 warnings 全部来自 gitignored `.delta/` 沙箱）。只读代码，唯一写入为本报告。

---

## § 0 Teach-back

**复述任务**：以独立评审官身份评审 closeout 五提交（W1 纯本地化 + 拦截弹框为主面），四档分级（P0 阻断/P1 应修/P2 账级/P3 nit），对 V4 的 F1-F8 逐条给「现在修 / 下波修 / 永不修」三择裁决，给修复波建议与机器可判验收线，终评「可冻结候推」或「须先清某几条」。**判定逻辑**：P0 = 破坏正确性/契约/数据；P1 = 应修的真实缺陷或测试缺口（不阻断正确性）；P2 = 有意为之但留债（须有注释/决议背书）；P3 = 纯工艺。除报告与 commit 外零写入；不改任何文件让检查变绿。

---

## § 1 逐文件发现

### lib/store.ts（W1 主面，−138/+… 净删）

| # | 档 | 发现 |
| --- | --- | --- |
| 1 | **P2** | `lib/store.ts:233-247` 悬空 JSDoc：自述「no longer called from the store」的 `apiPostSoloOutcome` 已整函数删除，注释块现直挂 `export const useGameStore` 之上，会被工具误读为 useGameStore 的文档。建议：面包屑内容并入 AGENTS.md（已有对应行）后删除注释块。（=V4 F6，本评审独立确认） |
| 2 | **P2** | `lib/store.ts:75,143` `soloSync{pending,inflight,error}` 成僵尸态：W1 后恒为 null/false/null，字段保留理由仅是「setPlayerName 的 reset 仍写它 + panel 可能订阅」。三处订阅方（SoloStatsPanel:58-60）相应留下永不成立的分支。注释诚实，但这是有意的死状态。建议：下波做协调删除（store 字段 + panel 订阅 + store.test 断言一把清），或升级为显式决议入 AGENTS.md。 |
| 3 | **P3** | `startGame` 内 `mode: resolvedMode,` 与 `restart` 内 `});` 缩进漂移（V4 F6 附带，prettier 一遍可平）。 |

**正面确认**：删除干净——`apiPostSoloOutcome`、`retrySoloSync` action、`persistSyncedServerTotal` import 全部无残留（grep 0 命中）；solo 分支仅剩 `recordOutcome + persistSoloStats`，`lastWriteAt` 有意不打戳且有注释（:398）；`setPlayerName` 仍持久化 localStorage（runMerge 改名路径正确）。

### components/StartGameButton.tsx（+136，W1 拦截面）

| # | 档 | 发现 |
| --- | --- | --- |
| 4 | **P1** | `components/StartGameButton.tsx:99` `void fetchSoloStats(name);` 死网络请求：GET 结果被丢弃、无任何状态写入，注释自认「it isn't on the home page today」。每次「合并并清空」多发一次无人消费的请求，违本仓「请求面最小」卫生（未破 pure-local 契约——该契约束写不束读）。建议：直接删除该行；若确要预热面板缓存则须 await 并消费。 |
| 5 | **P1** | 测试缺口：拦截块整体（pending>0 弹框 / runMerge 的 PUT 失败与 POST 失败分支 / onAfterConfirm 失败不触发）零单元测试——`StartGameButton.test.tsx` 三条 it 全是 W1 前旧契约（渲染 + startGame），`SyncConfirmDialog.test.tsx` 无任何 `onAfterConfirm` 断言（grep 全仓 test 文件 0 命中）。e2e 仅有 pure-local-qa 的 happy path（A2a/A2b/A3）。组件不在 Stryker `mutate` 范围，回归无变异测试兜底。建议：补 4-5 条组件级 it（详见 §3 验收线）。 |
| 6 | **P2** | `handleClick`（:108 起）对**两个 CTA 一视同仁拦截**：`单机练习`（solo→solo）也弹合并框。主公谕字面是「切换到在线版本的时候就弹窗」，solo→solo 属语义扩面。AGENTS.md 新增行已如实记载双按钮行为（文档与实现一致），但与御批字面有偏差，须决议背书：或收窄为 ranked，或明谕 bless 现行为并入计划。 |
| 7 | **P2** | `runMerge`（:60-104）与 `SoloStatsPanel.confirmSync`（:~103-160）约 25 行核心序列重复（PUT-if-changed → POST /sync → clearSoloStats → clearSyncedServerTotal → persistSyncedServerTotal → soloSync reset），注释自认「deliberate duplication — future refactor target」。且两处分叉：panel 多调 `useGameStore.getState().__resetInternalForTests()`，button 不调——今日无害（startGame 会重播镜像缓存），但同步模型一旦改动极易单点漂移。建议：下波抽 `lib/solo-sync.ts:mergeAndClear(name)` 单一实现，两处消费。 |
| 8 | **P3** | `handleClick` 无条件 `e.preventDefault()`：cmd/ctrl/shift+click 的新标签页打开能力丢失（同页导航）。建议加 `if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;`（放行修饰点击走 Link 默认）。kiosk 型产品下影响小，nit。 |

### components/SyncConfirmDialog.tsx（+15）

| # | 档 | 发现 |
| --- | --- | --- |
| 9 | **P2** | `onAfterConfirm` 契约本身正确（success-only，注释明确 MUST NOT run on throw，catch 路径确实不触发），但如发现 5 所述零测试覆盖——契约全靠注释自律。归入 P1-5 一并补测。 |

### components/SoloStatsPanel.tsx

| # | 档 | 发现 |
| --- | --- | --- |
| 10 | **P2** | `components/SoloStatsPanel.tsx:48` 头注释陈旧：「named → network first, localStorage only as a fallback」在 W1 后不实——具名模式同样本地先行，网络仅显式同步时发生。同段上方 bullet 已改对，独此句漏网。建议：改为「unnamed → 纯本地零网络；named → 本地先行 + 显式同步才联网」。 |
| 11 | **P3** | `openSyncDialog` 已无 await 点仍保留 `async`（:100 起）；`syncButtonLabel` 的 `inflight ? '同步中…'` 分支恒不触发（inflight 恒 false）。随发现 2 的僵尸态清理一并处理。 |

### tests/（探针与单测）

| # | 档 | 发现 |
| --- | --- | --- |
| 12 | **P2** | `tests/qa/sync-qa.mjs` 进程 SUMMARY 后悬死不退场（V4 F4，采纳其记录；本评审未复跑复现）。建议尾加 `process.exit(0)`。 |
| 13 | **P3** | `tests/qa/pure-local-qa.mjs:6,92` 注释称「断网」，实现是 `page.route` 只 abort /api 写、GET 照放——系「写封锁」非「断网」。对 A1 断言（零写+本地累计）封锁法反而更对（setOffline 会杀 RSC 导航），但名实须符。建议改措辞「写封锁（writes-blocked）」。 |
| 14 | **P3** | `tests/qa/one-screen-qa.mjs` 头注「A6 every route ≤ viewport+8px」与实现不符：result **和 home** 双双 INFO 豁免（:192-196）。豁免本身有据（V3 先例 + home 结构性高），头注须补 home。 |
| 15 | **P3** | `tests/qa/ux-qa.mjs` strict 块 `window.__winGlowPeak` 全局泄漏且 MutationObserver 永不 disconnect（页面随即导航，实际无害）；`pure-local-qa` A2b 断言 `writes.length >= 1` 可收紧为恰 1 POST（新名场景 PUT 已在写计数复位前落完）。 |
| 16 | **P2** | `tests/qa/sw-console-hygiene.mjs` step05 硬编码 `:3000` 字体 URL（V4 F5，采纳其记录），对 :3101 必 FAIL，非本轮回归。建议改用 BASE_URL。 |

**正面确认**：`store.test.ts` 重写后 afterEach 统一清 localStorage + restore mocks（卫生改善）；`ux-contract.mjs` win-glow 移除处留了指路注释（指 V3 MINOR-F1）；`solo-mode-qa` 选择器随 testid 迁移同步更新且注明缘由；`pure-local-qa` 整体质量高（RUN_SUFFIX 唯一名、写计数过滤、unhandledRejection 守卫、证据落盘、步骤解耦注释明确）。

### 配置与文档

| # | 档 | 发现 |
| --- | --- | --- |
| 17 | **P2** | `eslint.config.mjs` globalIgnores 缺 `.delta/**`：本轮同范围给 vitest（vitest.config.ts）与 stryker（stryker.config.mjs）都加了 `.delta` 排除，eslint 漏网 → `pnpm lint` 11 条 warnings 全部来自 gitignored 陈年沙箱（本评审独立复现）。三工具配置不一。建议：globalIgnores 追加一行 `.delta/**`。（=V4 F8） |
| 18 | **P2** | `SoloStatsPanel.confirmSync` 产线调用 `__resetInternalForTests()` 测试缝（V4 F7；`git show 6f20cca` 证实 wave-B 旧账、非本轮引入）。与 store doc「production code never calls it」相悖。建议：改名正式 action 或删调用。 |
| 19 | **P3** | `DESIGN.md:152`「（rux 决议 3/4 既约）」疑为「ux 决议」笔误；`.page-shell` 新增 `w-full` 属冗余（块级 + flex 拉伸本已满宽），无害。 |

**契约符合度抽验（AGENTS.md 反模式清单）**：命名令牌 ✓（sticky 用 bg-base/border-border-subtle，无新 hex）；SSR 不读 localStorage ✓（拦截走 `pendingSyncCount()` 直读 localStorage，与水合无关）；不引新依赖 ✓（无新 package）；网络写带 8s AbortController ✓（putSoloName/postSoloSync 皆走 solo-net withTimeout）；data-testid 契约 ✓（迁移自 Button→Link，全部探针选择器已同步，`[data-testid]` 点击语义不变）；单一水合触发点 ✓（未新增水合路径）；force-dynamic ✓（未触路由）；`overflow-x: clip` 替代 hidden 的理由注释（sticky containing-block）技术上正确 ✓；DESIGN.md §5 每个新决策带 why-not ✓。

---

## § 2 V4 F1-F8 三择裁决

| F | 内容 | 裁决 | 理由 |
| --- | --- | --- | --- |
| F1 | 合并后 catch-up 窗口：拦截被抑 + 「本机 N 局」文案少报（总账恒正确、无双计） | **下波修** | 真实语义疣但零数据风险；修法二选一（baseline 记账 vs 文案改报全量）需产品决议，不入冻结 |
| F2 | 首页硬刷新后弹框不预填已存名 | **下波修** | 小改动（StartGameButton 挂载时从 localStorage 回填），可机器判；不阻断（合并守卫仍生效，不会 422） |
| F3 | 弹框初焦落输入框而非主 CTA，与码注不符（pre-existing） | **下波修** | 一行级修复 + 注释校正；a11y 相关但非回归；本波只评不改 |
| F4 | sync-qa 进程悬死 | **下波修** | 探针工艺一行修（process.exit）；证据完整性不受影响 |
| F5 | sw-console-hygiene step05 硬编码 :3000（陈年） | **下波修** | 一行改 BASE_URL；陈年探针非本轮面，但留着必假 FAIL，污染门禁信号 |
| F6 | store.ts 悬空 JSDoc + 缩进漂移 | **下波修** | 注释失位会误导后来者（挂错符号），须清；纯 cosmetic 不阻断 |
| F7 | `__resetInternalForTests()` 产线调用（wave-B 旧账） | **下波修** | 语义级行（改名/删调用），动它要连带验证合并路径；既有测试全绿说明今日无害 |
| F8 | eslint 扫入 `.delta/` 致 11 warnings | **下波修** | 一行 config；lint 现状 0 errors 不阻断，但三工具配置不一是卫生债 |

**汇总**：现在修 0 / 下波修 8 / 永不修 0。无「现在修」：生产行为零 P0，五提交已被 V4 对抗矩阵独立验证；无「永不修」：八条皆真实债，无一属于「故意保留且永不应动」。

---

## § 3 修复波建议

**建议开 `ulw-minor-sweep`**（单 codex worker 一波，1 commit 或按 F 组拆 2-3 commit），范围 = §1 发现 1/2/4/5/7/10/12/13/14/16/17/18 + §2 F1-F8 全部；P3 项顺手清（3/8/11/15/19）。

**机器可判验收线**：

1. `grep -n "fetchSoloStats" components/StartGameButton.tsx` → 0 命中（P1-4）
2. `grep -rn "onAfterConfirm" components/SyncConfirmDialog.test.tsx` → ≥2 命中（success 触发 / failure 不触发）；`StartGameButton.test.tsx` 新增 ≥4 it：pending>0 弹框、保留本地零写导航、合并成功导航、PUT 失败弹框不关不导航（P1-5）
3. `pnpm lint 2>&1 | tail -1` → `✖ 0 problems`（eslint ignores 追加 `.delta/**`，F8）
4. F2：pure-local-qa 新 step——硬刷新首页（localStorage 预置名+3 局）→ 点 start-game → `input` 值 === 预置名
5. F3：dialog `showModal()` 后 `document.activeElement.dataset.testid === 'sync-confirm-confirm'`（单测断言）
6. `grep -rn "apiPostSoloOutcome\|__resetInternalForTests" lib/ components/ --include="*.ts*"` → 0 命中（F6/F7；F7 若取「改名正式 action」路线则 grep 命中的是新名且 store doc 同步）
7. F1：决议落地后 pure-local-qa 新 step——合并(S=3)→再玩 1 局→首页点击→弹框 pendingGamesCount === 实际将发送局数（选 baseline 方案）或文案含全量说明（选文案方案）
8. `node tests/qa/sync-qa.mjs` 同库两番 8/8 且进程 <10s 自退（F4）；`sw-console-hygiene` 5/5 PASS（F5）
9. 回归底线：六层门禁全绿 + Stryker store.ts ≥ 50.49 + one-screen-qa 11/0/1 不劣化

**P2-6（双 CTA 拦截超谕批字面）不入 sweep**——须主公一句话决议（收窄 or bless），决议后改 AGENTS.md 一行或收窄 handleClick 即可。

---

## § 4 终评

**可随 dev 冻结候推。**

依据：① 生产代码零 P0；两条 P1 一为多余 GET 请求（不破契约、不破正确性），一为测试缺口（行为已被 V4 对抗矩阵 8/8 独立验证兜底）；② 六层门禁本评审独立抽验三层全绿（vitest 268/268、typecheck 0 err、lint 0 err）；③ W1 删除面干净无死代码残留，核心契约（零网络写/拦截双路/静默直行）实现与 AGENTS.md 新增三行契约一一对应；④ W3/W4 的 CSS、探针、文档质量高于本仓均值，why-not 注释齐备。P1 两条与 F1-F8 全部赶**冻结后的 ulw-minor-sweep** 清偿即可，无须阻塞推送。

---

*评审官：独立 CR session（与 W1-W4/V4 执行者零共享）。本报告为唯一写入物；生产代码与测试零改动。*
