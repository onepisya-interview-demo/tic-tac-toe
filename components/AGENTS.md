# components/ 代理说明

棋盘、庆祝/音效/战绩/合并弹框客户端组件，以及四个游戏页面复用的 UI 基础组件。一局棋两版本（offline 单机 / online 在线）下的组件语义差异在顶 doc 写明。

## 查找入口

| 任务 | 位置 | 说明 |
| --- | --- | --- |
| 棋盘焦点和键盘 | Board.tsx | 负责 roving focus、方向键环绕、Enter/Space |
| 回合和结果文本 | ui/StatusBar.tsx | polite 且 atomic 的 live region |
| 战绩展示 | ui/StatsGrid.tsx、ui/StatsCard.tsx | 五项战绩契约；等宽字体加动效 |
| 胜利庆祝触发器 | WinConfetti.tsx | `/offline` 路由专用，hoisted 出 view-swap 容器，bug B fix 保障胜局仅触发一次；aria-hidden QA 层；canvas 不在 React 树内 |
| 跨设备合并弹框 | SyncConfirmDialog.tsx | 原生 `<dialog>`，mount 在首页；主「合并并清空」/ 次「保留本地」；runMergeSequence 内部跑 `lib/game-net.ts:postSession` + `postMerge` |
| 首页弹框触发 | HomeDialogMount.tsx | mount effect 监听 pathname/focus/visibilitychange/storage 事件，`pendingSyncCount() > declinedSentinel` 打开 SyncConfirmDialog |
| 在线战绩只读卡 | OnlineStatsCard.tsx | `/` 路由；GET `/api/players/{name}/stats` 响应只入组件 state（A2 红线：禁写 localStorage / 任何 store 字段） |
| 单机战绩面板 | OfflineStatsPanel.tsx | `/offline` 路由；纯本地（zero network writes），无名时显 `offline-stats-anonymous` 提示卡 |
| 身份区 | PlayerNameForm.tsx | `/` 路由；W4 折叠态（已登录只读 + 编辑展开）；submit 后 `postSession` → 写 `ttt.player.name.v1` + store |
| 入口 CTA + 拦截 | StartGameButton.tsx | `requireName` prop：online CTA 默认 true（无名点击 dispatch `ttt:player-name-required`）；offline CTA 传 false 直行 |
| 阶段→导航 | ResultNavigator.tsx | `/online` 路由；phase→'won'/'drawn' 时 push `/result?name=<name>` |
| 音效偏好 | SoundToggle.tsx | 保证水合安全的「默认静音」控件 |
| 通用基础组件 | ui/Button.tsx、ui/Card.tsx | 透传额外 props，QA 属性可以传入 |

## 约定

- 用窄的 Zustand selector 读取游戏状态，不要订阅整个 store。
- 只有交互组件使用客户端模式；展示型基础组件保持 server-compatible。
- 颜色、间距、字体、圆角和动效都来自全局 Tailwind v4 tokens。
- 保留稳定 test ID：board、cell-N、cell-N-mark、status-bar、stat-value、sound-toggle、confetti、start-offline、start-online、online-stats-grid、offline-stats、offline-stats-anonymous、offline-stats-grid、sync-confirm-dialog、player-name-section。
- 可访问名称使用中文，并通过既有 live region 播报变化。
- 全局 *:focus-visible 规则拥有 focus ring；组件不要重复声明。
- 组件测试与组件同目录；SoundToggle 是现有 RTL/SSR 模式。

## 反模式

- 不用内联 hex、原生色板替代、组件级 focus class、emoji 图标或 div 动作。
- 不在组件里做 I/O 或持久化；调用 store action 并呈现返回状态。唯一例外：`OfflineStatsPanel` pull-only 读 `loadOfflineStats`（localStorage 只读水合），写路径仍在 store——展示层只取数不落数，持久化触发点保持单源。`OnlineStatsCard` 更严：连 pull 都不准 localStorage，响应只入组件 state。
- 不在首帧读取持久化偏好；SoundToggle 必须先渲染静音，挂载后再同步。
- 不复制动效触发逻辑；keyed span 和 CSS class 已负责落子/胜利效果。
- 不假设 canvas-confetti 渲染在 React 树内。
- 不引入 `solo` / `ranked` / `singleplayer` / `multiplayer` 词汇（schema.org 词汇表对齐理由见 README「词汇语义说明」节）。
