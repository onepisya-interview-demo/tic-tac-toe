# components/ 代理说明

棋盘、庆祝/音效/战绩/合并弹框/房间弹框客户端组件，以及四个游戏页面复用的 UI 基础组件。一局棋两版本（offline 单机 / online 在线）下的组件语义差异在顶 doc 写明。本目录组件代码迁移按 `.omo/plans/ulw-room-migration-home-landing.md` W2 执行；W3 docs 半区更新本文件代码地图与命名对齐。

## 查找入口

| 任务 | 位置 | 说明 |
| --- | --- | --- |
| 棋盘焦点和键盘 | Board.tsx | 负责 roving focus、方向键环绕、Enter/Space |
| 回合和结果文本 | ui/StatusBar.tsx | polite 且 atomic 的 live region |
| 战绩展示 | ui/StatsGrid.tsx、ui/StatsCard.tsx | 五项战绩契约；等宽字体加动效 |
| 胜利庆祝触发器 | WinConfetti.tsx | `/offline` 路由专用，hoisted 出 view-swap 容器，bug B fix 保障胜局仅触发一次；aria-hidden QA 层；canvas 不在 React 树内 |
| 跨设备合并弹框 | SyncConfirmDialog.tsx | 原生 `<dialog>`，mount 在首页；主「合并并清空」/ 次「保留本地」；runMergeSequence 内部跑 `lib/game-net.ts:postRoomSession` + `postMerge`（W3 房间术语） |
| 首页合并弹框触发 | HomeDialogMount.tsx | mount effect 监听 pathname/focus/visibilitychange/storage 事件 + `ttt:offline-stats-changed`（合并后重估 pendingSyncCount），`pendingSyncCount() > declinedSentinel` 打开 SyncConfirmDialog；W3 起不再 refetch 战绩（OnlineStatsCard 已删，A1 红线） |
| 房间弹框宿主 | RoomGateMount.tsx | 首页挂载的 client 宿主；监听 `ttt:room-required` CustomEvent（detail 携带 `{ mode, href }`），打开 RoomGateDialog；同时执行挂载期 identity bootstrap（localStorage `ttt.room.name.v1` → store）+ `cleanupLegacyPlayerNameKey()` 一次性 legacy 清除 |
| 房间弹框 | RoomGateDialog.tsx | 原生 `<dialog>`；单输入 + 主 CTA「创建并进入」/ 次 CTA「取消」 + n/24 计数 + ESC 关 + reduced-motion 无动效 + 初焦落主 CTA（requestAnimationFrame 模式，参照 SyncConfirmDialog F3 修复）；提交即 `postRoomSession(trimmed)` → 200 ok 时写 localStorage + store.roomName + `startGame(mode)` + `router.push(href)` + 关闭；422 / aborted / network-error → 就地错误文案，零持久层写入，零导航 |
| 首页战绩静态入口 | HomeStatsEntry.tsx | `/` 路由；纯 `<Link href="/result?room=...">`，零请求零副作用；store 有 roomName 时渲染「查看 <room> 的战绩 →」链接，无 roomName 时不渲染；testid `home-stats-entry` + `home-stats-link` |
| 单机战绩面板 | OfflineStatsPanel.tsx | `/offline` 路由；纯本地（zero network writes），无名时显 `offline-stats-anonymous` 提示卡；`isAnonymous` 读 `store.roomName`（W3） |
| 入口 CTA + 拦截 | StartGameButton.tsx | `requireName` prop：online CTA 默认 true，无名点击 dispatch `ttt:room-required` Window CustomEvent（不导航，不调 startGame）；offline CTA 传 false 直行 |
| 阶段→导航 | ResultNavigator.tsx | `/online` 路由；phase→'won'/'drawn' 时 push `/result?room=<roomName>`（W3 房间术语） |
| 音效偏好 | SoundToggle.tsx | 保证水合安全的「默认静音」控件 |
| 通用基础组件 | ui/Button.tsx、ui/Card.tsx | 透传额外 props，QA 属性可以传入 |

## 约定

- 用窄的 Zustand selector 读取游戏状态（`roomName` / `phase` / `board` 等），不要订阅整个 store。
- 只有交互组件使用客户端模式；展示型基础组件保持 server-compatible。
- 颜色、间距、字体、圆角和动效都来自全局 Tailwind v4 tokens。
- 保留稳定 test ID：board、cell-N、cell-N-mark、status-bar、stat-value、sound-toggle、confetti、start-offline、start-online、offline-stats、offline-stats-anonymous、offline-stats-grid、sync-confirm-dialog、room-gate-dialog、room-gate-input、room-gate-submit、room-gate-cancel、room-gate-counter、room-gate-feedback、home-stats-entry、home-stats-link。
- 可访问名称使用中文，并通过既有 live region 播报变化。
- 全局 *:focus-visible 规则拥有 focus ring；组件不要重复声明。
- 组件测试与组件同目录；SoundToggle 是现有 RTL/SSR 模式。

## 反模式

- 不用内联 hex、原生色板替代、组件级 focus class、emoji 图标或 div 动作。
- 不在组件里做 I/O 或持久化；调用 store action 并呈现返回状态。唯一例外：`OfflineStatsPanel` pull-only 读 `loadOfflineStats`（localStorage 只读水合），写路径仍在 store——展示层只取数不落数，持久化触发点保持单源。W3 起首页再无任何网络组件（`HomeStatsEntry` 是纯 `<Link>`，零请求）；`RoomGateDialog` 提交成功的写路径是显式 store action + localStorage 双写，仍归 store 层。
- 不在首帧读取持久化偏好；SoundToggle 必须先渲染静音，挂载后再同步。
- 不复制动效触发逻辑；keyed span 和 CSS class 已负责落子/胜利效果。
- 不假设 canvas-confetti 渲染在 React 树内。
- 不引入 `solo` / `ranked` / `singleplayer` / `multiplayer` 词汇（schema.org 词汇表对齐理由见 README「词汇语义说明」节）；不引入 `playerName` / `PlayerNameForm` / `OnlineStatsCard` / `ttt:player-name-required` / `ttt.player.name.v1` 等 W3 已退役标识符。
