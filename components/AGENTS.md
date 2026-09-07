# components/ 代理说明

棋盘、庆祝/音效客户端组件，以及三个游戏页面复用的 UI 基础组件。

## 查找入口

| 任务 | 位置 | 说明 |
| --- | --- | --- |
| 棋盘焦点和键盘 | Board.tsx | 负责 roving focus、方向键环绕、Enter/Space |
| 回合和结果文本 | ui/StatusBar.tsx | polite 且 atomic 的 live region |
| 战绩展示 | ui/StatsGrid.tsx、ui/StatsCard.tsx | 五项战绩契约；等宽字体加动效 |
| 胜利庆祝触发器 | Confetti.tsx | 稳定的 aria-hidden QA 层；canvas 不在 React 树内 |
| 音效偏好 | SoundToggle.tsx | 保证水合安全的“默认静音”控件 |
| 通用基础组件 | ui/Button.tsx、ui/Card.tsx | 透传额外 props，QA 属性可以传入 |

## 约定

- 用窄的 Zustand selector 读取游戏状态，不要订阅整个 store。
- 只有交互组件使用客户端模式；展示型基础组件保持 server-compatible。
- 颜色、间距、字体、圆角和动效都来自全局 Tailwind v4 tokens。
- 保留稳定 test ID：board、cell-N、cell-N-mark、status-bar、stat-value、sound-toggle、confetti。
- 可访问名称使用中文，并通过既有 live region 播报变化。
- 全局 *:focus-visible 规则拥有 focus ring；组件不要重复声明。
- 组件测试与组件同目录；SoundToggle 是现有 RTL/SSR 模式。

## 反模式

- 不用内联 hex、原生色板替代、组件级 focus class、emoji 图标或 div 动作。
- 不在组件里做 I/O 或持久化；调用 store action 并呈现返回状态。
- 不在首帧读取持久化偏好；SoundToggle 必须先渲染静音，挂载后再同步。
- 不复制动效触发逻辑；keyed span 和 CSS class 已负责落子/胜利效果。
- 不假设 canvas-confetti 渲染在 React 树内。
