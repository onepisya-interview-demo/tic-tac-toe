# Plan: 合并弹框触发规格变更（BR-1：仅「离线局 → 首页」导航转换触发）

- 日期: 2026-09-22
- 状态: executing（主公 decree 同日当面下达：修复 + 业务规则外化 + 沉淀思考，思考优先）
- 分支: dev
- 触发: 主公实测发现「直接进入首页也弹合并战绩弹框」，违背业务规定「从单机离线游戏进入到首页的时候才提示合并战绩」；事件反思见 `docs/learnings.md` §32

## 一、命题

把合并弹框（SyncConfirmDialog / HomeDialogMount）的触发条件从「任何首页挂载 + pending>0」收窄为「**离线局 → 首页的软导航转换** + pending>0」，并把触发规则外化为 `docs/business-rules.md` BR-1（反面场景 + 探针钉）。

## 二、背景与定责（证据优先）

- **e83b526 无辜**：新旧谓词逐语义等价（5 finite 检查 + key-set 白名单），接线不变，db 只删注释。主公报告时用词「似乎引入」——比对后排除。
- **真根因**：W3（161d7cb）的触发设计「任何首页挂载都 evaluate」（组件头注释明文含 "Hard reload on `/` (initial mount fires)"），A3 验收只写了「solo→回首页弹」「首页直接起战不弹」，从未钉「直接打开首页不弹」；`HomeDialogMount.test.tsx` 反而把「seed pending → render → 弹」钉成期望。**spec 有洞，测试把洞固化，六层门禁对着错误契约全绿**。

## 三、规格变更（BR-1）

| | 旧行为（W3 起） | 新行为（本 plan） |
| --- | --- | --- |
| 触发 | 任何首页挂载 + focus / visibilitychange / storage / 自定义事件重评 | **仅** consumeNavPrev() === '/offline'（软导航到达） |
| 直接打开/硬刷新首页（pending>0） | 弹 ❌ | **不弹** ✅ |
| 从 /online、/result 回首页 | 弹 ❌ | **不弹** ✅ |
| 同会话 pending ≤ declined 哨兵 | 不重弹 | 不重弹（保留） |
| 拒绝/确认语义 | 不变 | 不变 |

## 四、机制：NavPrevTracker（layout 层来源路由）

「组件只在 `/` 挂载」→ 离开即卸载 → 组件内 ref 记 pathname 在软导航下不可行（anti-patterns L1-28）。机制：

- `components/NavPrevTracker.tsx`：root layout 常驻 client 组件；`useLayoutEffect`（pre-passive，保证先于页级 passive effect）在每次路由变化时把上一路由写 `sessionStorage['ttt.nav.prev.v1']`；首载不写。
- `HomeDialogMount`：挂载时 `consumeNavPrev()`（**读即清**）——硬刷新天然无标记 → 不弹，无需额外状态。

## 五、改动清单

1. `components/NavPrevTracker.tsx`（新建）+ `app/layout.tsx` 挂载
2. `components/HomeDialogMount.tsx`：触发条件改造；退役 4 个 defence-in-depth 监听（focus/visibility/storage/ttt:offline-stats-changed）+ handleConfirm 尾部 dispatch（BR-1 下会话未经 /offline 不得弹，监听唯一效果就是弹）
3. `components/HomeDialogMount.test.tsx`：翻转 6 处「mount 即弹」用例为 BR-1 语义（直进不弹 / 软导航弹 / 来源路由特定 / 退役触发不弹）
4. `tests/qa/home-return-qa.mjs`：step 02/04/05/06/08 改 `softNavHome(page)`（点 in-app「返回首页」Link，更贴真实用户）；新增 **step 02b BR-1 反面探针**（本地 3 局未合并 + 硬进首页 → 断言弹框不开）
5. `docs/business-rules.md`（新建，BR-1..10）+ `AGENTS.md` L2 指针一行
6. `docs/learnings.md` §32 + `docs/anti-patterns.md` 追加 L1-27 / L1-28

## 六、验收

1. `pnpm vitest run` 全绿（HomeDialogMount 11 用例含 4 条 BR-1 反面）
2. typecheck / lint / build 绿
3. `home-return-qa.mjs` 10 step 全 PASS（含新 step 02b 反面）
4. commit-audit dev 0 violations
5. 业务验收（主公实测）：直接打开首页不弹；离线玩完点「返回首页」弹

## 七、红线

- 不动 declined 哨兵语义、W4 F1 baseline 模型、handleConfirm/reject 清理三连
- 不引入新库；NavPrevTracker 渲染 null 不触 SSR 首帧行为
- 不 push；不 --no-verify
