# 全仓五维只读评审报告（工单 W-RV，RC-quality-20260922）

- 日期: 2026-09-22；评审席: herdr codex rvreview（fresh session，只读约束）
- 基线: dev @ 39acfaa（W-T0 合入后）+ 11baadd（W-OPT-a 合入，评审期间落位）
- 结论: 未发现 P0/P1；4 条 P2 + 7 条 P3；无契约红线被违反

## Findings（11 条）

收集完整信息完成。开始输出评审报告。

---

# 评审报告 — W-RV（39acfaa / dev 最新）

## 验证基线

- `pnpm vitest run`：30 个测试文件，363 例全绿（实测）
- `pnpm typecheck`：exit 0，无输出（实测）
- `pnpm lint`：exit 0，无警告（实测）
- 工作树 clean，git detached @ 39acfaa（实测）
- 本评审未触碰任何仓库文件，未 git add/commit/push（红线遵守）

---

## findings

### [P2] [契约一致性] lib/db.ts:174-181 — `accumulateMergeStats` 把 currentStreak 当作纯整数相加
证据（≤5 行）：
```ts
export function accumulateMergeStats(server, client): GameStats {
  return { totalGames: server.totalGames + client.totalGames,
    currentStreak: server.currentStreak + client.currentStreak, ... };
```
标签：inferred（README 边界注已记录为已知"best-effort signed heuristic"，AGENTS §本项目反模式未单列）。
影响：跨设备合并后连胜计数会丢失时序语义（例如 server=X-streak=5，client=O-streak=-3 →合并=streak=2，UX 上变成"X 连胜 2"与历史不符）。
建议：保留现状（README 已注），但若未来要做排行榜/历史回放，需在 service 层加 `mergeHistory` 时序敏感路径。

### [P2] [可维护性] public/sw.js:35 — `CACHE_NAME`硬编码版本，无 cache-bust 通道
证据：
```ts
const CACHE_NAME = "tic-tac-toe-v1";
```
标签：inferred（注释记录"if we later add a true offline surface we'll reach for Workbox"）。
影响：图标/manifest 内容更新时，旧 SW 会持续命中陈旧资源直到用户手动清缓存；HAR §P3 暗示历史已多次发生56-94 次 manifest round-trip。
建议：将 app 版本号（package.json 同步）作为 cache name 段，或在 `activate` 监听器里 `caches.delete` 上一非 last 版本。

### [P2] [正确性] lib/store.ts:154 — `hasPendingOutcomeWrite` 作为 public导出仅供单一消费者
证据（≤5 行）：
```ts
export function hasPendingOutcomeWrite(): boolean {
  return pendingOutcomeWrite !== null;
}
```
标签：inferred（grep 全仓仅 `components/ResultNavigator.tsx:106` 一处消费）。
影响：API surface 不必要扩大，未来若有第二个误用消费者，seam 的"module-level 单例"契约会被非显式引用稀释。
建议：保持 public 但加 JSDoc 注释明文"only ResultNavigator is sanctioned to read this"；或下沉为内部导出 + 单文件 `import { hasPendingOutcomeWrite } from './store'`。

### [P2] [契约一致性] tests/qa/online-direct-qa.mjs F7 — 已知盲区"localStorage 有名但服务端无 row"
证据：
```
// 服务端无 row 时 outcomes 404 零记录是既有边缘，见报告「偏差与未决」。
```
标签：inferred（探针以 `seed /api/rooms` 预注册规避）。
影响：生产环境若用户在新设备/新浏览器上从首页门输入房间名（localStorage 有名）但服务端因 admin delete / forged reset 等原因行不存在，胜局会撞 404 stats-not-found，UI 上零记账 + 零庆祝 + 0错误反馈。
建议：在 ResetRoomStatsButton 之外增加"resync identity"路径，或在 ResultNavigator 的 anonymous-online guard 上加"服务端无 row 提示重输房间名"分支；本波范围外，可立后续 plan。

### [P3] [可维护性] components/OnlineGateMount.tsx:108 — 同路由 push 是 no-op 保留
证据：
```ts
async function handleConfirm(room): Promise<void> {
  setStoreName(room); startGame('online'); setOpen(false);
  router.push('/online'); // same-route push — harmless no-op, kept for parity
}
```
标签：inferred（注释自述 kept for parity）。
影响：可读性略混淆；`router.push` 在同路由不会触发任何导航，但仍是 fire-and-forget 异步。
建议：若不需要对齐 RoomGateMount.handleConfirm，可删；保留则可加 JSDoc 引用 RoomGateMount 路径。

### [P3] [契约一致性] components/ResetRoomStatsButton.tsx — onCancel 内置 preventDefault 但仅清 error+close
证据：
```ts
const onCancel = (e: Event): void => { e.preventDefault(); setError(null); setOpen(false); };
```
标签：inferred。
影响：与 RoomGateDialog 的 `onCancel → onReject()`模式不一致；本组件把 ESC 视为「取消」而非统一走 host 决议路径。
建议：保持现状（注释解释清楚）即可；若后续接入统一 host 模式，需统一。

### [P3] [性能] components/Board.tsx:34-36 — boardKey 每次渲染重算，依赖它的 effect 全量重建
证据：
```ts
const boardKey = board.join('');
const [override, setOverride] = useState<{...} | null>(null);
useEffect(() => { ... }, [autoFocused, board, boardKey, focused, makeMove, phase]);
```
标签：inferred（实测363 测试通过，无性能实测）。
影响：每次落子后 effect 重建，O(n) 的邻接 focus 重算 + `queueMicrotask` + `document.querySelector`；9 格棋盘无明显瓶颈，但 N=25+ 或频繁落子时有堆积风险。
建议：包 `useMemo` 缓存 `boardKey`；或拆 effect（键盘 handler 与 roving focus 分离）。

### [P3] [契约一致性] lib/room-name.ts:91-93 — `cleanupLegacyPlayerNameKey` 在 `getRoomName` 与 `setRoomName` 双调
证据：
```ts
// getRoomName：每次读都清一次
cleanupLegacyPlayerNameKey();
// setRoomName：每次写也清一次
setRoomNameLocal(room.trim()); cleanupLegacyPlayerNameKey();
```
标签：inferred（注释自述"belt-and-suspenders"）。
影响：每次读/写两次 removeItem（idempotent 但仍 O(1)），无实际成本；可读性双重调用略显冗余。
建议：保持现状或改为「读路径清一次 + 写路径不重复」。

### [P3] [契约一致性] db/schema.ts:36 — `id INTEGER PRIMARY KEY` 无 autoincrement 注解
证据：
```ts
id: integer('id').primaryKey(),
```
标签：inferred（SQLite ROWID-based 自动增，但无显式 `autoincrement()` 注解）。
影响：若未来用 `WITHOUT ROWID` 表或迁出 SQLite，行号行为不一致。
建议：现状下 SQLite 自增 OK；如计划迁移，需提前评估。

### [P3] [正确性] lib/store.ts:248-255 — `startGame('offline')` 内隐式 localStorage 读
证据：
```ts
if (resolvedMode === 'offline') {
  internalStats = loadOfflineStats();
  if (!useGameStore.getState().roomName) {
    const stored = getRoomName();
    if (stored) useGameStore.setState({ roomName: stored });
  }
}
```
标签：inferred（与 AGENTS §本项目反模式"localStorage 只在 mount effect 读"略冲突）。
影响：startGame 是纯 action，被多处调用（RestartButton 链、HomeDialogMount 不触发），store 层越过 mount 边界读 localStorage；当前命名「列表」「战绩显示面板」零影响，但若未来 startGame('offline') 被异步调用方触发，可能命中预期外 SSR / 测试态。
建议：保留但加注释"本 localStorage 读仅在浏览器同步路径触发，SSR 不走 offline 分支"。

### [P3] [契约一致性] components/HomeDialogMount.tsx:108-114 — `handleConfirm` 在已合并后重复 `clearOfflineStats()`
证据：
```ts
async function handleConfirm(name): Promise<void> {
  persistLastMergedLocal(0);
  clearOfflineStats();
  clearDeclinedPending();
  ...
}
```
标签：inferred。
影响：clearOfflineStats 在 SyncConfirmDialog.runMergeSequence 已成功路径外另有此处的重复清；语义幂等，无副作用；但读起来两次清值得追上下文。
建议：保持（防御 + 单点失败可恢复），无功能影响。

---

## 评审覆盖清单

### 1. 四功能提交（重点审）
|提交 | 状态 | 评审内容 |
| --- | --- | --- |
| 9fe08aa (reset family) | 完整审 | diff + service/transport/dialog/test/qa 探针 + 4 routes 与 store/db 一致性；anti-silent-create 404 保留；agenda 文案逐字保留 |
| e15e049 (W-F seam) | 完整审 | diff + store.seam 实现 + ResultNavigator 取消 guard + W-F1~F4 测序断言 + seam 三态 store.test + result-fresh-qa；mount order 在 Next.js 渲染周期内同步无竞态 |
| 1c3899e (ResultCelebration) | 完整审 | diff + 哨兵单一真相位置（消费方文件）+ C1-C6 单测 + F1-F5 探针 + SSR-safety；bookmark 命中无庆祝 |
| 2d8f8d4 (OnlineGateMount) | 完整审 | diff + bootstrap 同源 + onReject no-close + modal 阻断 + G1-G7 单测 + F7/F8 探针 |

### 2. 高危存量面
| 文件 | 评审深度 |
| --- | --- |
| lib/store.ts | 全文 + seam 三态 + 所有 action（startGame/makeMove/restart/resetOfflineStats/setRoomName/awaitOutcomeWrite/__resetInternalForTests/__getInternalForTests）逐行核对 |
| lib/db.ts | 全文 + service/transport 分离契约 + reconcile probe + registerOrLoginRoom race-safety + accumulateMergeStats 语义边界 |
| components/Board.tsx | 全文 + roving focus + 键盘 handler + queueMicrotask 时序 |
| public/sw.js | 全文 + method guard + URL whitelist + cache-first + pass-through |

### 3. 全量扫
| 面 | 评审深度 |
| --- | --- |
| app/api/rooms/* | 五端点全部读完，transport→service 映射一致；problem+json helper 用法对齐 |
| app/{page,result,online,offline}/page.tsx | 全部读完 + /result RSC force-dynamic 注释 + 三个渲染分支 |
| app/layout.tsx | 读完 + JSON-LD escape + themeColor literal 与 globals.css 镜像 |
| components/AGENTS.md + UI 子目录 | 扫完目录，AGENTS.md digest 行入档；UI 子组件（BoardGrid/Card/Button/Cell/StatsCard/StatsGrid/StatusBar）作为基础件已存在引用 |
| lib/{api-problem,confetti,game,game-net,home-jsonld,offline-stats,room-name,sound}.ts | 全部读完 |
| db/schema.ts | 读完；drizzle 与 DDL 同源，getDb reconcile 单点 |
| tests/ | 跑了 `pnpm vitest run`，30 文件 / 363 例全绿；逐项检查了 ResetRoomStatsButton/OnlineGateMount/ResultNavigator/ResultCelebration/SyncConfirmDialog/RoomGate/PlayController 测序 |

### 6. 未见过的面（诚实优先于体面）
1. **真实 Turso HTTP 远端路径** — 本地 sqlite模拟为主，prod 部署未实测；commit 头注释明确"Not-tested: Vercel/Turso 真实远端 HTTP 路径"
2. **真机 reduced-motion 系统偏好** — Playwright context 模拟为准，未在 macOS 系统设置上实测
3. **streak heuristic 跨设备实测** — `accumulateMergeStats` 的 currentStreak 相加语义未在 prod 端到端验证
4. **STW（Stop The World）gc暂停下 TrackOutcomeWrite 的 promise 解析时序** — 理论上 finally 在 gc 期间可能被延迟，未实测
5. **Service Worker 在低权限/隐私模式/旧 Chromium 下的兜底** — 仅看代码注释 + Navigator.serviceWorker 守卫，未浏览器实测降级路径
7. **Drizzle migrate实战** — `drizzle-kit generate` / `push` 未跑过；DDL 是手写在 lib/db.ts:getDb()，未走 Drizzle 工具链
8. **生产 Turso HTTP 30s 默认 fetch 超时** — HAR §P2 实证孤立 DELETE 200 time=30733ms；8s AbortController 拦截，但未在真 Turso 端到端验证
9. **`/result` RSC 在 ISR 模式下的 revalidatePath 行为** — 项目当前 force-dynamic，未涉及 ISR；若未来改 ISR，store 网络写 action 需重审10. **`accumulateMergeStats` 的 streak 在跨设备混合用户（X-streak + O-streak）下的 UX** — 数学正确但语义奇怪，未 UX 实测

---

## 总结

整体健康度良好。四个功能提交（9fe08aa reset / e15e049 W-F seam / 1c3899e ResultCelebration / 2d8f8d4 OnlineGateMount）实现质量高：service/transport 分离严格、AGENTS.md 反模式（首页零 API、防静默建档、anti-silent-create 纵深防御）零回退、CONTEXT.md 术语（"房间" / "记局" / "清空"）用对、DESIGN.md testid 契约守住、SSR-safety / 水合边界 / StrictMode 双调用全部有对应测试覆盖。

未发现 P0 / P1 缺陷（已审面内）。所有 findings 落在 P2/P3，多为代码风格、已知限制的明文化、或潜在的微小改进空间。无契约红线被违反。

**核心收益点**：W-F seam（e15e049）+ ResetRoomStatsButton（9fe08aa）共同把在线完局"战绩延迟一拍需手动刷新"和"无法清空在线战绩"两个主公当场反馈彻底根除，ordering 单测 + 产线 hermetic 探针双重覆盖，可信度高。ResultCelebration（1c3899e）以哨兵门控（不订阅 store 单例）规避了已退役 ResultBanner 的陈旧 won 误重放边界，方案成熟。OnlineGateMount（2d8f8d4）以与 RoomGateMount 同源的 bootstrap 效应补全 hard-load 直达 /online 的身份缺口，与既有"modal 阻断棋盘"契约对齐。

建议优先级：先处理 P2 #5（同路由 push 文档化）、#2（SW cache 版本管理），其它 P3 可延后到下次代码整理窗口。

评审完成，停在 idle。

## 未见过的面（诚实优先于体面）

1. 真实 Turso HTTP 远端路径（本地 sqlite 模拟为主，prod 未实测）
2. 真机 reduced-motion 系统偏好（Playwright 模拟为准）
3. streak heuristic 跨设备 prod 端到端
4. STW gc 暂停下 trackOutcomeWrite promise 时序（理论推断）
5. SW 低权限/隐私模式/旧 Chromium 兜底（代码注释级）
6. drizzle-kit generate/push 实战（DDL 手写在 getDb）
7. 真 Turso 30s fetch 超时与 8s AbortController 端到端
8. /result RSC ISR 模式 revalidatePath（现 force-dynamic 未涉及）
9. accumulateMergeStats streak 跨设备混合 UX 语义

## 总结

整体健康度良好。四个功能提交（9fe08aa reset / e15e049 W-F seam / 1c3899e ResultCelebration / 2d8f8d4 OnlineGateMount）实现质量高：service/transport 分离严格、AGENTS.md 反模式零回退、CONTEXT.md 术语用对、DESIGN.md testid 契约守住、SSR-safety / 水合边界 / StrictMode 双调用全部有测试覆盖。建议优先处理 P2 #2（SW cache 版本管理）与 #3（hasPendingOutcomeWrite API surface 明文化），P2 #4 是已知边缘可立后续 plan，P2 #1 README 已注边界。
