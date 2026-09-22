# DESIGN.md — tic-tac-toe (井字棋)

> Source spec: `.omo/ulw-loop/brief.md` (P3 审美段为输入)
> Stack: Next.js 16 App Router + Tailwind v4 + Zustand + Drizzle/SQLite
> Generated: 2026-09-07
> Updated: 2026-09-20 (W3 ulw-room-migration-home-landing: 房间术语 + 首页引导化)
> Status: contract for implementation

## 0. Research Log

- **Layer B references**: linear.app (克制工程师感、暗色优先) + vercel.com (高端极简、单一强调色)
- **Layer A style**: minimalist-skill (clean / Notion-like / Linear-like)
- **Lazyweb screens skipped**: greenfield tiny app, 3 routes, no need for real-product screens
- **Imagen drafts skipped**: 3 routes, low visual complexity; design is captured directly via this contract
- **Source rationale**: brief P3 explicitly names "Linear + Vercel 官网" — brand references are stable

## 1. Color Tokens

| Token | Value | Use |
| --- | --- | --- |
| `bg-base` | `#0A0A0A` | Page background |
| `bg-elevated` | `#141414` | Card / cell empty |
| `bg-hover` | `#1C1C1C` | Hover surface |
| `bg-pressed` | `#27272A` | Active / pressed |
| `border-subtle` | `#27272A` | Dividers, cell borders |
| `border-strong` | `#3F3F46` | Focus rings, selected |
| `text-primary` | `#FAFAFA` | Headings, primary content |
| `text-secondary` | `#A1A1AA` | Sub-labels, hint text |
| `text-muted` | `#71717A` | Disabled, metadata |
| `accent` | `#34D399` (emerald-400) | Primary CTA, current-player indicator, X marker |
| `accent-hover` | `#6EE7B7` (emerald-300) | Hover on accent |
| `accent-muted` | `rgba(52,211,153,0.12)` | Accent surface tint |
| `danger` | `#F87171` (red-400) | Error text/foreground — dark-bg 对比度 ≥4.5:1 |
| `danger-strong` | `#FCA5A5` (red-300) | Error emphasis (icon stroke) |
| `danger-surface` | `rgba(248,113,113,0.12)` | Error block 背景 |
| `danger-border` | `rgba(248,113,113,0.35)` | Error block 边框 |
| `player-x` | `#34D399` | X marker (emerald) |
| `player-o` | `#FAFAFA` | O marker (white) |

**Mapping to Tailwind v4**: declare these as `@theme` custom properties in `app/globals.css`. Do NOT use stock Tailwind emerald directly — keep the explicit values.

## 2. Typography

| Token | Family | Size / Line | Use |
| --- | --- | --- | --- |
| `text-display` | Geist | 48 / 56 | Page title (one per screen) |
| `text-h1` | Geist | 32 / 40 | Section heading |
| `text-h2` | Geist | 24 / 32 | Sub-heading |
| `text-h3` | Geist | 20 / 28 | Card title |
| `text-body` | Geist | 16 / 24 | Default |
| `text-small` | Geist | 14 / 20 | Hint, secondary |
| `text-mono` | Geist Mono | 14 / 20 | Stats values, debug |
| `text-cell` | Geist | 48 / 1 | Tic-tac-toe X / O marker |

**Loading**: `next/font/google` (Geist, Geist Mono) + `next/font/local` (Geist via `geist/font`).

## 3. Spacing & Layout

- **Grid**: 8px base
- **Page container**: `max-w-[640px] mx-auto w-full px-6 py-12` (desktop) / `py-4 gap-6` (mobile < 40rem, W3 tightening)
- **Card padding**: `p-6` (24px)
- **Card gap**: `gap-4` (16px)
- **Cell size**: `w-24 h-24` (96 × 96)
- **Cell size mobile**: `w-20 h-20` (80 × 80), keeping the board inside the mobile card
- **Cell gap**: `gap-2` (8px)
- **Button padding**: `px-4 py-2` (16 × 8)
- **Section gap**: `gap-8` (32px desktop, `gap-6` 24px mobile < 40rem via `.page-shell @media` — W3)

## 4. Components (Primitives)

| Primitive | Variants | Required props |
| --- | --- | --- |
| `Button` | `primary` / `secondary` / `ghost` | `variant`, `children`, `onClick?`, `disabled?` |
| `Card` | — | `children`, optional `className` |
| `Cell` | — | `value` (`'X' \| 'O' \| null`), `onClick`, `disabled`, `isWinning?` |
| `StatsCard` | — | `label`, `value` |
| `StatusBar` | — | `currentPlayer`, `gameOver?`, `winner?` |

**Header composition contract** (added by ulw-mobile-one-line-ux plan):

| Route | Composition (single flex-row) | h1 slot | testid |
| --- | --- | --- | --- |
| `/` | (no single-line header — home is the guided landing layout) | n/a | n/a |
| `/online` | `[h1 compact | StatusBarClient inline | SoundToggle]` | "游戏中" (`text-h2 font-semibold`) | `status-bar` / `status-text` |
| `/offline` | `[h1 compact | StatusBarClient inline | SoundToggle]` | "单机练习" (`text-h2 font-semibold`) | `status-bar` / `status-text` |
| `/result` | `[result-headline h1 | SoundToggle]` | `result-headline` is the h1 | `result-headline` (aria-live=assertive) |

Each row is a single `flex flex-row items-center justify-between gap-3` line. The h1
slot is `text-h2 font-semibold` (compact) on `/online` and `/offline`; on `/result` the
h1 is `result-headline` itself (`text-h1 font-display font-medium`) because the
redundant `<h1>本局结束</h1>` was dropped during this pass. `StatusBar` is the
inline-flex pill variant (`text-small`, `whitespace-nowrap`) so the row's tallest
slot is the title, not the status text. `SoundToggle` keeps its own padding. Mobile
375×667 header boundingBox: 26px (was 62/62/90). Exactly one h1 per page.

**Implementation rule**: every primitive MUST use the tokens above; no inline hex.

## 4b. RoomGateDialog / SyncConfirmDialog / HomeDialogMount (W3 增补)

W3 后首页成为引导页：删除 `OnlineStatsCard` 与 `PlayerNameForm`，新增 `RoomGateDialog` + `RoomGateMount`（房间按需收名）+ `HomeStatsEntry`（战绩静态入口，纯 `<Link>`）；`SyncConfirmDialog` 文案与关键路径改房间术语。写明动效与契约以免后人重发明。

### RoomGateDialog（components/RoomGateDialog.tsx）

| 维度 | 契约 |
| --- | --- |
| 触发 | 首页 `RoomGateMount` 监听 `ttt:room-required` Window CustomEvent（`StartGameButton` 在无名点 online CTA 时 dispatch，detail 携带 `{ mode, href }`） |
| 居中 | 原生 `<dialog>` + Tailwind v4 Preflight 把 UA `dialog:modal { margin: auto }` 清零；项目加 `m-auto` 显形居中（契约：dialog 中心与视口中心偏差 ≤8px，one-identity-qa 验收） |
| 背板 | `::backdrop` 选 `bg-base/70`（显式 CSS：`dialog::backdrop { background-color: color-mix(in oklab, var(--color-bg-base) 70%, transparent) }`，因 Tailwind v4 不生成 `backdrop:bg-X/Y` 变体）+ `backdrop-blur-sm`（Tailwind 类仍生效）；禁纯黑 `#000` 蒙层（与 `bg-base #0A0A0A` 对比不足 10/255） |
| 内容 | 标题「创建房间」+ 副标题「同设备对战 · 战绩云端」+ roomName 输入 + 主「创建并进入」/ 次「取消」+ 24 字符计数 + 错误行；422 / aborted / network-error 三态就地文案，零持久层写入，零导航 |
| 焦点 | showModal 后主 CTA「创建并进入」初焦（`requestAnimationFrame(() => primaryRef.current?.focus())` + cleanup `cancelAnimationFrame`；落到 React re-render settle 之后；F3 fix 模式） |
| 关键路径 | 提交即 `postRoomSession(trimmed)`（`POST /api/rooms`）→ 200 ok 时写 localStorage `ttt.room.name.v1` + `setRoomName` + `startGame(mode)` + `router.push(href)` + close dialog；`existed:false` 文案「房间已创建」，`existed:true` 文案「已进入房间 <room>」 |
| 退路 | ESC / 次 CTA「取消」= 关 dialog，零 POST 零写零导航 |
| reduced-motion | 弹框内无连续动画；ESC/click 关 dialog 即时 |
| testid | `room-gate-dialog` / `room-gate-input` / `room-gate-submit` / `room-gate-cancel` / `room-gate-counter` / `room-gate-feedback` |

why-not: 为什么不做「创建并进入」按钮的 loading spinner 旋转动画
  → 弹框已经 `aria-busy={busy}` + 主按钮文字切换「创建中…」/「进入中…」+ 全输入框 + 次按钮 disabled；spinner 是装饰性，无信息增量为冗余。`prefers-reduced-motion` 路径下 spinner 更不该存在（即使非旋转，CPU 也在画）。

why-not: 为什么主次按钮用 `flex-col-reverse sm:flex-row sm:justify-end` 而非 modal library
  → 库引入违「禁 UI/动画/路由/数据访问库」项目约束；原生 `<dialog>` 自带 focus trap / ESC / inert 背景三件套，足够。

why-not: 为什么 `<dialog>` 加 `m-auto` 而不是改 global UA 样式或换 Tailwind plugin
  → Tailwind v4 Preflight `* { margin: 0 }`（node_modules/tailwindcss/preflight.css:13）覆盖 UA `dialog:modal { margin: auto }`；项目解法是在 dialog 自己 className 上 `m-auto` 把居中找回（最小作用域）。global 加 `dialog { margin: auto }` 会让其它未来 modal 实例共享同一规则，违反「契约先行 / 最小作用域」原则。prefers-reduced-motion 下无差异（m-auto 是 layout 态非动画态）。

why-not: 为什么 `::backdrop` 的 `bg-base/70` 走显式 CSS 而非 `backdrop:bg-base/70` Tailwind 类
  → Tailwind v4 不生成 `backdrop:bg-X/Y`（color-mix + arbitrary variant 组合）规则；.next 静态 CSS 实测只产出 `.backdrop\:backdrop-blur-sm::backdrop { backdrop-filter }`，无 `bg-base/70::backdrop { background-color }`。换成显式 CSS rule 用同一 `--color-bg-base` token，契约不变（DESIGN.md §图底关系 bg-base/70），且与 `backdrop-blur-sm` 类共享变量源。

why-not: 为什么 `::backdrop` 用 `bg-base/70 + backdrop-blur-sm` 而非 `bg-black/60`
  → DESIGN.md §图底关系行已明文禁纯黑 `#000` 蒙层（与 `bg-base #0A0A0A` 对比不足 10/255，破坏暗色背景下的边界感知）；`bg-base/70` 既守住图底关系又维持品牌调性。

why-not: 为什么 focus 调用包进 `requestAnimationFrame`
  → W4 F3 fix：showModal 同 commit phase 内 `setName(initialName)` 触发的 re-render 会重置焦点；`requestAnimationFrame` 把 focus 落到 React re-render settle 之后，cleanup `cancelAnimationFrame` 防泄漏。`reduced-motion` 路径不受影响（`requestAnimationFrame` 在 reduced-motion 下仍触发，仅回调内不读偏好）。

### HomeDialogMount（components/HomeDialogMount.tsx）

W3 起：删除「OnlineStatsCard focus refetch」职责，**仅**负责跨设备合并弹框触发。

| 维度 | 契约 |
| --- | --- |
| 触发 | mount effect 监听 pathname=`/` + `focus` + `visibilitychange` + `storage` + `ttt:offline-stats-changed`（合并后重估 pendingSyncCount）；`pendingSyncCount() > declinedSentinel` 时打开 SyncConfirmDialog |
| 写层 | 合并成功 → `clearOfflineStats()` + `persistLastMergedLocal(0)`；onReject → `writeDeclinedPending(pendingSnapshot)`（sessionStorage 防重弹哨兵） |
| 渲染 | 仅渲染 SyncConfirmDialog；不显示表单；不挂载任何网络组件 |
| 测试 | `home-return-qa` 探针覆盖；不验证 localStorage 快照（旧 A2 红线已随 OnlineStatsCard 删除而并入 A1 首页零 API 红线） |

### HomeStatsEntry（components/HomeStatsEntry.tsx）

W3 新增首页战绩静态入口。

| 维度 | 契约 |
| --- | --- |
| 渲染 | store.roomName 非空时渲染 `<Link href="/result?room=${encodeURIComponent(roomName)}">`「查看 <room> 的战绩 →」链接，房间名包在 `<span class="font-mono">`；store.roomName 空时**不渲染**（连骨架都没有，A1 红线零 DOM 干扰） |
| 数据源 | 纯 `useGameStore((s) => s.roomName)` 读，无 fetch、无 useEffect（store 是客户端单例，hard reload 由 RoomGateMount identity bootstrap 恢复） |
| 持久层 | 零写入：禁写 localStorage / 任何 store 字段；A1 红线扩展——首页零网络 + 零持久副作用 |
| testid | `home-stats-entry`（div）+ `home-stats-link`（anchor） |

why-not: 为什么不用 useEffect 读 localStorage 而走 store 单例
  → 重复读 localStorage 会引入第二个水合触发点（AGENTS.md 反模式）；store 已是客户端单例，RoomGateMount 挂载期 useEffect 已负责 localStorage → store 单向同步（identity bootstrap）；HomeStatsEntry 直接读 store 是「唯一真相」正确路径。

why-not: 为什么 store.roomName 空时整个组件 return null 而不是渲染骨架
  → 首屏引导页一屏预算（one-screen-qa 契约）要求 375×667 viewport 装下整个首页；空骨架会占高度且无信息；无名时战绩不存在，渲染入口即误导。

### SyncConfirmDialog（components/SyncConfirmDialog.tsx）

W3 起：内嵌收名流（合并时输入房间名）+ 主「合并并清空」/ 次「保留本地」；房间术语化。

| 维度 | 契约 |
| --- | --- |
| 触发 | `HomeDialogMount` mount effect：`pendingSyncCount() > declinedSentinel` 时开 |
| 居中 | 原生 `<dialog>` + Tailwind v4 Preflight 把 UA `dialog:modal { margin: auto }` 清零；项目加 `m-auto` 显形居中（契约：dialog 中心与视口中心偏差 ≤8px，A1 验收） |
| 背板 | `::backdrop` 选 `bg-base/70`（显式 CSS：`dialog::backdrop { background-color: color-mix(in oklab, var(--color-bg-base) 70%, transparent) }`，因 Tailwind v4 不生成 `backdrop:bg-X/Y` 变体）+ `backdrop-blur-sm`（Tailwind 类仍生效）；禁纯黑 `#000` 蒙层（与 `bg-base #0A0A0A` 对比不足 10/255）；复用 §图底关系行 |
| 内容 | 标题「合并战绩」+ 副标题「将上传本机 N 局到房间 <room>；同步后本机清零以防重复」+ roomName 输入（预填 store.roomName / localStorage）+ 主「合并并清空」/ 次「保留本地」+ 24 字符计数 + 错误行 |
| 焦点 | showModal 后主 CTA「合并并清空」初焦（rAF 延后到 re-render settle 之后；F3 fix） |
| 关键路径 | 内部 `runMergeSequence`: `postRoomSession`（进入房间；200 ok）→ `loadOfflineStats()` 快照 → `postMerge`（合并）→ 200 ok → `clearOfflineStats()` + `persistLastMergedLocal(0)`；任何一环失败 → error 行 + dialog 不关 + 不调 onConfirm；409 `enter-room-required` 翻译为「需要先进入该房间」就地展示 |
| 退路 | ESC / 点击遮罩 / 次 CTA「保留本地」= `onReject`；`HomeDialogMount` 写 sessionStorage `ttt.offline.sync-declined.v1` 避免同会话重弹 |
| reduced-motion | 弹框内无连续动画；ESC/click 关 dialog 即时 |

why-not: 为什么不做「合并并清空」按钮的 loading spinner 旋转动画
  → 弹框已经 `aria-busy={busy}` + 主按钮文字切换「同步中…」+ 全输入框 + 次按钮 disabled；spinner 是装饰性，无信息增量为冗余。`prefers-reduced-motion` 路径下 spinner 更不该存在（即使非旋转，CPU 也在画）。`button-spinner` 样式仍保留给未来其它场景，本 dialog 故意不消费。

why-not: 为什么主次按钮用 `flex-col-reverse sm:flex-row sm:justify-end` 而非 modal library
  → 库引入违「禁 UI/动画/路由/数据访问库」项目约束；原生 `<dialog>` 自带 focus trap / ESC / inert 背景三件套，足够。

why-not: 为什么 `<dialog>` 加 `m-auto` 而不是改 global UA 样式或换 Tailwind plugin
  → Tailwind v4 Preflight `* { margin: 0 }`（node_modules/tailwindcss/preflight.css:13）覆盖 UA `dialog:modal { margin: auto }`；项目解法是在 dialog 自己 className 上 `m-auto` 把居中找回（最小作用域）。global 加 `dialog { margin: auto }` 会让其它未来 modal 实例共享同一规则，违反「契约先行 / 最小作用域」原则。prefers-reduced-motion 下无差异（m-auto 是 layout 态非动画态）。
why-not: 为什么 `::backdrop` 的 `bg-base/70` 走显式 CSS 而非 `backdrop:bg-base/70` Tailwind 类
  → Tailwind v4 不生成 `backdrop:bg-X/Y`（color-mix + arbitrary variant 组合）规则；.next 静态 CSS 实测只产出 `.backdrop\:backdrop-blur-sm::backdrop { backdrop-filter }`，无 `bg-base/70::backdrop { background-color }`。换成显式 CSS rule 用同一 `--color-bg-base` token，契约不变（DESIGN.md §图底关系 bg-base/70），且与 `backdrop-blur-sm` 类共享变量源。
why-not: 为什么 `::backdrop` 用 `bg-base/70 + backdrop-blur-sm` 而非 `bg-black/60`
  → DESIGN.md §图底关系行已明文禁纯黑 `#000` 蒙层（与 `bg-base #0A0A0A` 对比不足 10/255，破坏暗色背景下的边界感知）；`bg-base/70` 既守住图底关系又维持品牌调性，`backdrop-blur-sm` 提一点层次（与 sticky header 不用 blur 是因为 `bg-base` 暗色下 12px blur 几乎不可见，徒增合成成本；modal 后景是页面整体而非一行，blur 收益更高）。

## 5. Motion

| Interaction | Property | Duration | Easing |
| --- | --- | --- | --- |
| Button hover | `background-color` | 120ms | ease-out |
| Cell hover | `background-color` | 120ms | ease-out |
| Cell press | `transform: scale(0.98)` | 80ms | ease-out |
| Cell placement | `opacity`, `transform: scale(0.4→1.08→1)` | 260ms | ease-out |
| Winner reveal | overlay `opacity`, `transform`, `filter` | 1.4s loop | ease-in-out |
| Draw feedback | board `transform: translateX()` | 300ms | ease-out |
| Player indicator | dot/text `opacity`, `transform: scale()` | 1.6s loop | ease-in-out |
| Stats update | `opacity`, `transform: scale(0.92→1)` | 220ms | ease-out |
| Result confetti | `opacity`, `transform: translate3d()` | 1.1s once | ease-in |
| Page transition | `opacity` | 150ms | ease-out |
| View Transitions (route) | opacity crossfade 双向 | 150ms | ease-out |
| GameShell header sticky (`sticky top-0`) | position 状态 (非动画) | — | — |
| In-page view switch | `translate` (6px→0) + `opacity` 双向 | 180ms | ease-out |
| /offline Card morph | `view-transition-name: offline-card` 同位 morph（group snapshot）+ 容器 `min-h: 28rem` 锁高 | 180ms（继承 view-swap） | ease-out |
| view-toggle button width | grid-stack 双图层（StatusBar 4 态 `grid-area: 1/1` 同格叠放，visibility 切换可见态）+ button `min-width: max-content` 锁宽 | — (静态) | — |
| RoomGateDialog 打开 | `<dialog>.showModal()` 平台 API（无 enter 动画；原生 `::backdrop` 由浏览器绘制）| — (静态) | — |
| SyncConfirmDialog 打开 | `<dialog>.showModal()` 平台 API（无 enter 动画；原生 `::backdrop` 由浏览器绘制）| — (静态) | — |

- **View Transitions (route)**: 平台 API（React `<ViewTransition>`，Next 16 App Router 内置 canary 导出），非动画库，不违「禁动画库」之约；不支持 VT 的旧浏览器回退既有 `.page-fade-in`，`prefers-reduced-motion` 降级路径既有
- **In-page view switch**: 同上平台 API 的 `update` 路径（React 19 `<ViewTransition update="view-swap">` + `useTransition` 驱动），仅 `/offline` 顶栏切换棋盘↔战绩时启用；CSS 关键帧 `translate` + `opacity`，GPU-only，不动布局属性；`prefers-reduced-motion` 归零；不动 `prefers-reduced-motion` 既有全局 `*` 兜底
- **/offline Card morph（A-T3，ulw-solo-sync-rebuild W-A）**: Card 根加 `view-transition-name: offline-card`，浏览器对 OLD/NEW 各拍一张 group snapshot 做同位 morph；同容器 `min-h: 28rem` 锁高，使两态在同位 crossfade 而非高度 snap。28rem 是 Board (~22rem) 与 OfflineStatsPanel (~24rem) 中取大者再留呼吸空间；hardcode 而非 `clamp` 是因为 Card 内容由 React 控制，不需要响应式伸缩
- **view-toggle button width（A-T2，ulw-solo-sync-rebuild W-A）**: StatusBar 4 态文本（准备开始 / 轮到 X / X 获胜 / 平局）以 `display: inline-grid` + `grid-area: 1/1` 同格叠放，非活动态 `visibility: hidden`；grid 容器宽度 = max(全部子项) = 活动态自带脉冲点的最宽态；button 仅 `min-width: max-content`，不写硬编码像素；`prefers-reduced-motion` 下行为不变（visibility 是布局态而非动画态）
- **No bounce / no slide-in / no parallax**; transitions communicate a move, outcome, or route change only
- GPU-only (`transform`, `opacity`, `background-color`)
- `prefers-reduced-motion`: collapse all to `0ms`
- **Interaction reference**: beui.dev Button / Number / Animated Badge mechanisms; adapted to CSS-only transitions and keyed content swaps
- **Sound**: optional, muted by default, native Web Audio one-shot tones only; no background music

### Why-not-the-other notes for new motion rules

(sanyam 克制原则：每个新动效必须有「为什么不选另一条」注释)

- **W3 弹框 (SyncConfirmDialog) 为什么不加 enter 动画（W4 终校：仍无新增动效）**
  原生 `<dialog>.showModal()` 自带 ::backdrop 渐入 + 焦点 trap，但这是浏览器实现而非项目动画；本项目无 enter transition 自定义 CSS（`dialog` 上无 `animation`/`transition` 属性）。why-not: 加 enter 动画 = 「确认性操作」类装饰（Fitts's Law 已经在遮罩 1.5 click 关 + 主 CTA 大字 + 主操作 8s loading 这三层上做到明确反馈；任何额外淡入/缩放都会让用户在「是否合并」二选一前多读 200ms 视觉噪音，违反 Tesler's Law 复杂度守恒）。W4 F3 修焦点 race 后，showModal → primaryRef.focus() 仍无视觉过渡。`prefers-reduced-motion` 路径下无差异（本就 0ms）。
- **RoomGateDialog 与 SyncConfirmDialog 共享 showModal 平台 API 范式**
  两个 dialog 同源——都用 `<dialog>.showModal()` + ::backdrop 原生渲染 + F3 模式初焦 + 无 enter 动画；why-not 同上不再重复。两个组件的 why-not 各自列在本组件 §4b 行内。
- **W3 HomeStatsEntry 为什么不加 hover 微动效（颜色/下划线）**
  已经是 `<Link>` + `underline underline-offset-2 hover:text-text-primary`：颜色变化走 Tailwind 默认 `transition-colors`，本就克制；再加 `transform` 或 `opacity` 动画是装饰性冗余，违反 §5「No bounce / no slide-in / no parallax」原则。`prefers-reduced-motion` 路径下 `transition-colors` 仍生效（150ms 颜色差远低于「动画」阈值）。


- **A-T2 StatusBar grid-stack 为什么不选 min-w-[7rem] / min-w-[8ch]**
  像素/字符 token 锁定会让可见文本与按钮内边距产生视觉间隙（短消息「平局」右侧出现明显留白），且 zh 字符度量与 en 字符度量不一致，硬编码 token 在多语言场景会失效。grid-stack 用「内容真实宽度」驱动，token 与字体度量解耦；只有 `.status-pill` 兜底 `min-width: 7ch` 防退化到一字宽（极小字号下中文回退）。
- **A-T3 view-transition-name 为什么不选纯 CSS transition（`transition: opacity 180ms`）**
  CSS transition 只在元素 ID/class 变化时连续插值；本场景 board ↔ stats 是「不同 DOM 子树整体替换」，CSS transition 无法对一组子节点整体做 in-place morph。`view-transition-name` 走浏览器快照层 API，对 OLD/NEW 同一名称的两个快照做 position+size morph，是平台原生支持的「共享元素」正确路径（rvt §1.3）。
- **A-T3 min-h: 28rem 为什么不选 `aspect-ratio` 或 JS 测量**
  `aspect-ratio` 要求父容器有明确宽度才能算出高度，本场景 Card 是 `max-w-[640px]` + `p-6` 但宽度自适应，aspect-ratio 反推高度会随 viewport 抖动；JS 测量需 ResizeObserver + useState，引入额外水合触发点（AGENTS 反模式），与 status text 一样硬码 token 反而最简单稳定。
- **A-T4 按钮条件渲染 为什么不选 CSS `hidden` + `aria-disabled`**
  主公验收 V3 要求「stats 视图 DOM 无 data-testid="restart"」，CSS hidden 只是视觉消失，DOM 节点仍存在，违反契约；React 条件渲染从根上保证 stats 视图 DOM 不出现 restart 节点。

- **W3 sticky vs fixed（GameShell header）**
  sticky 在文档底部时随文档退出，不与底部 actions 重叠；本仓 `/result` 文档高 ≤ 视口，fixed 会与底部 actions 重叠，故选 sticky。sticky 不脱离文档流，浏览器无需 JS 测量位置（与 AGENTS 反模式「不引入新水合触发点」对齐），纯 CSS `position: sticky; top: 0` 即生效。
- **W3 实色 bg-base vs backdrop-blur（sticky header 背板）**
  R3 调研 sanyam.sh/lab 21 文件 grep backdrop 0 命中——克制站点不做 blur。`backdrop-blur-md` (12px) 在 `bg-base #0A0A0A` 暗色下几乎不可见（V3 visual-qa 24 张截图无 blur 命中痕迹），徒增 ~30% 合成层成本；选 `bg-base` 实色 + `border-b border-border-subtle` (1px chrome 分隔) 维持与既有 token 一致。reduced-motion 用户感知不到任何差异（sticky 是 layout 态非动画态）。
- **W3 静态 token 收紧 vs scroll-driven 动画（mobile 一屏）**
  R3 §3.1 一行 `padding: 1rem 0; gap: 1.5rem`（mobile-only `@media (width < 40rem)`）即可省 80px，远超 /solo 19px 溢出需求；引入 scroll-driven animation（`animation-timeline: scroll()`）或 JS IntersectionObserver 触发布局变化会破 DESIGN.md §5「GPU-only（transform / opacity / background-color）」+ AGENTS 反模式「不引入新水合触发点」双约束。scroll-driven caniuse 73%（Safari 18.4+），老 Safari 用户零降级，不达「零运行时成本」目标，故选静态 token 收紧。


### 52 法则对照（ulw-solo-pure-local-closeout W4 增补）

本节把 W1-W4 关键改动映射到「52 设计法则」（信源：`/Users/onepisya/code/UI Propmt/skills/elegant-ui/52-design-principles/`）。每条以「法则 → 对应改动 → 一句注意点」记入契约；证据详见
`.omo/evidence/ulw/ulw-solo-pure-local-closeout/R2-principles-mapping.md` §0-§9。

| 法则 | 对应改动 | 一句注意点 |
| --- | --- | --- |
| 形式追随功能（Form Follows Function） | W1 删 `lib/store.ts` 三处 auto-POST；W3 静态 token 收紧（mobile `py-12 → py-4`）；W3 删 `OnlineStatsCard` + `PlayerNameForm` | 「装饰性联网」不属单机；删比抽 helper 更净（V3 MINOR-F4 因此作废） |
| 泰斯勒定律（Tesler's Law / 复杂度守恒） | W1 把「自动同步」复杂度转移到「合并 / 保留」弹框；W3 RoomGateDialog 按需收名 | 弹框文案须显形「将上传 N 局 / 本机清零」（W3 弹框文案决策 3/4 既约） |
| 信噪比（Signal-To-Noise Ratio） | W1 收窄默认路径请求面（零网络写）；W2 sync-qa 唯一名 `syncprobe-<ts>` 复位；W3 首页零 `/api/*` 请求（A1 红线） | 端点本身保留为公开 API 面（D2 决议），不是「删净」而是「挪走」 |
| 渐进呈现（Progressive Disclosure） | W1 `pendingSyncCount > 0` 才弹 SyncConfirmDialog；零态静默直行；W3 online 无名点 CTA 才弹 RoomGateDialog | 禁发明「始终弹一次以教育用户」的常驻噪音（验收 A3 硬约束） |
| 约束性（Constraints / 渐进呈现进阶） | W3 `RoomGateDialog` 内嵌完整收名流（无名即弹、收完即进）；已有 roomName 不弹直接进 | 折叠 = 弹框独占可达面；已有 roomName 不该有裸 input 语义（避免「保存」歧义）；W3 替代 W4 `PlayerNameForm` 折叠态 |
| 留白感知（Horror Vacui） | W3 一屏收紧（19px 溢出 → 80px 节省）；sticky header 紧凑 ≤56px；W3 首页减表单后更多呼吸空间 | 仍守 `bg-elevated` 与 `bg-base` ≥12px 呼吸间隔；战绩非空 /home 允许轻量滚动 |
| 菲茨定律（Fitts's Law） | W1 弹框主/次 CTA 整行宽（移动端单列 1fr/1fr 堆叠）；按钮 padding 8/12/16 | 触区 ≥44px；遮罩外 click 不关弹框（用 ESC + 显式按钮替代） |
| 多尔蒂门槛（Doherty Threshold） | W1 弹框显形 ≤100ms + 主 CTA loading + 8s `AbortController.timeout()` | 400ms 内用户必须看见反馈；HAR §P2 实证 30s 卡死反例 |
| 图底关系（Figure-Ground） | W1 `::backdrop` 选 `bg-base/70` + `backdrop-blur-sm`；W3 sticky `bg-base` 实色 | 禁纯黑 `#000` 蒙层（与 `bg-base #0A0A0A` 对比不足 10/255） |
| 反馈环（Feedback Loop） | W3 win/draw ≤2s 切 stats 视图 + confetti 落位；W3 删除 OnlineStatsCard focus refetch（避免冗余轮询；`/result` RSC 是 single source of truth） | 行为 → 状态变化 → 视觉响应 ≤400ms 闭环；不依赖用户主动刷新 |
| 映射关系（Mapping） | W2 ResetStatsButton caption 显形作用域；aria-pressed ↔ view-toggle 控制-状态同构 | 控件外观 / 文案须与系统状态一一对应；禁「按钮名 ≠ 作用域」歧义（A5） |
| 图层化（Layering） | W1 `::backdrop` 暗背景层；W3 confetti overlay `z-index: 50` 悬浮于战绩视图 | 视觉层级 = 信息层级；z-index 须 token 化阶梯（globals.css 单一源） |
| 宽容性（Forgiveness） | W1 弹框 ESC = reject；W3 RoomGateDialog ESC = cancel（零 POST 零写零导航）；W4 「保留本地」零网络写 | 撤销 / 退出必须可逆且零代价；禁把破坏性操作伪装成中性操作（D1） |

未选入的常用候选（理由）：席克定律——弹框只有 2 CTA，选项数不构成问题；古腾堡图表——本轮无新主视区扫描路径改动；确认性操作——同源渐进呈现，不重复入条。心流 / Zeigarnik 与「紧凑化」无直接对位。


## 6. Accessibility

- **Focus ring**: `outline: 2px solid var(--accent); outline-offset: 2px`
- **Keyboard**: roving `tabIndex` with arrow-key movement across the board; Enter/Space activates the focused empty cell
- **Announcements**: status and result messages use atomic `aria-live` regions; cell labels include position and occupancy
- **Reduced motion**: every decorative animation has a `prefers-reduced-motion: reduce` no-animation path
- **Contrast**: every text-on-bg pair ≥ 4.5:1 (verified for `text-primary`/`text-secondary`/`text-muted` on `bg-base`)
- **No emoji as icons**
- **`<button>` for actions, never `<div onClick>`**

## 7. Routing & Information Architecture

| Route | Purpose | Key elements |
| --- | --- | --- |
| `/` | Guided landing (W3 D-1) | H1 `井字棋`, 副标, 玩法引导区（轮流落子 · 三连即胜 · 同设备传递）, 双入口 CTA（`start-offline` / `start-online`）, `HomeStatsEntry`（战绩静态入口；纯 `<Link>`；无名不渲染）, `HomeDialogMount`（合并弹框宿主）, `RoomGateMount`（房间弹框宿主）, JSON-LD |
| `/online` | Online versus (two players, pass-and-play, server-authoritative) | StatusBar, Board (3×3 Cell grid), 返回首页 / 重开; on game end auto-push `/result?room=<roomName>` |
| `/offline` | Solo practice (pure local, anonymous-not-recorded) | StatusBar, Board ↔ OfflineStatsPanel view-swap (W3 result-paginated), 返回首页 / 重开 |
| `/result?room={trimmed}` | Real-time score sheet (RSC, per-room) | StatsGrid, 再来一局 → /online, 返回首页 → /；旧 `?name=` 走 fallback（portfolio 无保留价值） |

**Transitions**:
- `/` → click start-online（有名）→ `/online`（first player randomized in store）
- `/` → click start-online（无名）→ dispatch `ttt:room-required` → `RoomGateMount` 打开 `RoomGateDialog` → 收名成功 → `/online`
- `/` → click start-offline → `/offline`（first player randomized in store；永久零拦截）
- `/online` → 胜/平 → `/result?room=<roomName>`（ResultNavigator push；real-time RSC score sheet）
- `/offline` → 胜/平 → inline OfflineStatsPanel view-swap（no navigation；confetti fires once）
- `/result` → click 再来一局 → `/online`（new randomized first player, stats updated server-side）
- `/result` / `/offline` → click 返回首页 → `/`

### Modes: online (default) vs offline

One store, one `mode` field (`'online' | 'offline'`); the two modes share the board / win-check / recordOutcome math — the only divergence is the **score path**:

| | online (`/online`) | offline (`/offline`) |
| --- | --- | --- |
| Entry gate | `StartGameButton` `requireName=true`：无名点 CTA → dispatch `ttt:room-required` → `RoomGateMount` 打开 `RoomGateDialog`；有名直行 `startGame + push` | Always navigable; anonymous path is allowed (无名不记) |
| Outcome write | `POST /api/rooms/{room}/stats/outcomes` — server-authoritative accumulator (`lib/db.ts:recordOutcomeForRoom`) | Zero network writes — local `recordOutcome` accumulation |
| Stats persistence | Server per-room row (`game_stats`, `room TEXT UNIQUE`) | `localStorage['ttt.offline.stats.v1']` (5-number JSON; shape mismatch → `emptyStats`) |
| Game over | `ResultNavigator` pushes `/result?room=<roomName>` (RSC real-time score sheet, force-dynamic) | Inline `OfflineStatsPanel` view-swap (Confetti fires once via W4 Bug B hoisted `WinConfetti`); no navigation by design |
| Stats display | RSC reads `loadRecordByRoom(room)` at request time (force-dynamic) | `OfflineStatsPanel`: SSR renders `emptyStats`, hydrates from localStorage in effect |
| Reset | Server-side row delete (admin op, no frontend UI) | `clearOfflineStats()` — local only, instant (`reset-offline-stats`) |
| Cross-device merge | n/a (server is single source of truth) | `HomeDialogMount` mount effect → `SyncConfirmDialog` → `POST /api/rooms` + `POST /api/rooms/{room}/stats/merge` (per-field sum) + local clear + `ttt.offline.last-merged-local.v1` baseline sentinel (W4 F1) |

The two ledgers never mix: the home page `HomeStatsEntry` reads the store roomName only (no fetch); the `/result` RSC reads the server row only; the offline panel reads localStorage only. All visual, motion, and accessibility contracts (§1–§6) apply identically to both modes. See `.omo/plans/ulw-one-game-two-versions.md` §1 for the version-vocabulary rationale and `.omo/plans/ulw-room-migration-home-landing.md` §0 / §1 for the room-vocabulary rationale.

## 8. Accepted Debt

- **No dark / light mode toggle** — single dark mode (per brief P2)
- **No mobile-optimized layout** — desktop ≥1280px primary (per brief P2)
- **No i18n** — Chinese only (per brief P2)
- **No background music** — optional one-shot sound effects are available through the user-mutable control
- **No animation library** — CSS transitions only (per brief 不能引入)
- **W3 战绩 homepage 卡（OnlineStatsCard）删除**：战绩主场归 `/result?room=` RSC，首页纯引导化

## 9. Quality Gates

门禁清单不在这里重复维护，两处为单一事实源：

- 工具链与阈值（vitest / coverage / mutation / QA 脚本）：README「Gauntlet 工具链」
- 提交前门禁与审计（commit-audit / vitest / typecheck / lint / build / QA）：AGENTS.md「Verification gate」

本文件的验收域是设计契约本身：视觉 QA 断言暗色 `#0A0A0A` 基底、Geist / Inter 加载（无 FOUT）、
无 emoji、focus ring 可见、动效符合第 5 节时长/缓动表。

**截图来源**（W5 重制于 ulw-one-game-two-versions §W5；详见本仓 `.omo/evidence/ulw/ulw-one-game-two-versions/W5-gauntlet.log`）：

- 桌面 1280×900：`docs/screenshots/{home,board,result,solo}.png`（visual-qa 桌面 pass）—— 文件名沿用旧命名以保 PR diff 稳定；`board.png` ↔ `/online`，`solo.png` ↔ `/offline`
- 移动 375×667：`docs/screenshots/mobile/{home,online,offline,offline-stats,result}.png`（visual-qa 移动 pass，
  4 路由 + offline 双视图各一张）

**Mobile one-screen rule**（T3 验收契约，visual-qa 移动 pass `scrollWidth === viewport.width`
断言 + 显式度量）：`/online` / `/result` 路由在 375×667 视口下滚动长度严格等于视口高度（无纵向滚动）；
`/offline` 在 board ↔ stats 两视图下同样满足。`/` 战绩为空时可一屏；战绩非空时 StatsGrid + 战绩卡 + 按钮组纵向铺，仍允许轻量滚动（与桌面同等体验）。

---

### Historical: W-SYNC wave 2 / W4 PlayerNameForm 折叠态（已退役）

W-SYNC wave 2 引入 `SyncConfirmDialog`（合并弹框）与原 `PlayerNameForm`（首页常驻收名表单），由 W3 D-3 房间术语迁移后：**`PlayerNameForm` 整体删除**（W2 改造面完成），由 `RoomGateDialog` 按需收名替代；`OnlineStatsCard` 同步删除，由 `HomeStatsEntry` 战绩静态入口替代。下表是 W-SYNC wave 2 / W4 PlayerNameForm 的旧契约摘要，仅保留作为「历史叙述」；现行契约见 §4b + §7 + README.md「一局棋两版本 → 首页 = 引导页」与「FAQ · online 入口拦截 / 首页身份恢复 / offline 跨设备同步」段。

| 旧 Contract | 旧 Value | 当前状态 |
| --- | --- | --- |
| `PlayerNameForm`（首页常驻收名） | W4 折叠 contract：已登录只读 + 编辑展开；testid `player-name-*` 全族 | **退役（W2 删除）**；由 `RoomGateDialog`（按需弹框收名）替代 |
| `OnlineStatsCard`（首页战绩只读卡） | `GET /api/players/{name}/stats` 响应只入组件 state（A2 红线） | **退役（W2 删除）**；由 `HomeStatsEntry`（纯 `<Link>`）替代；A2 红线并入 A1 首页零 API 红线 |
| Storage key | `ttt.player.name.v1` (localStorage) | **W3 启动期被 `cleanupLegacyPlayerNameKey` 单向清空，不迁移**；新唯一 key `ttt.room.name.v1` |
| Offline stats key | `ttt.solo.stats.v1` | 弃用不迁移 → `ttt.offline.stats.v1` |
| API: read | `GET /api/solo-stats?name={trimmed}` | 退役 → `GET /api/rooms/{room}/stats` (RFC 9457 404 problem+json) |
| API: write | `POST /api/solo-stats` body `{ name, outcome }` | 退役（405）→ `POST /api/rooms/{room}/stats/outcomes` (RFC 9457) |
| API: register | `POST /api/sessions` body `{ name }` | **退役（W3 D-3 删除）** → `POST /api/rooms` body `{ room }` |
| API: merge | `POST /api/players/{name}/stats/merge` | **退役（W3 D-3 删除）** → `POST /api/rooms/{room}/stats/merge` |
| DB | `solo_records` (name TEXT PRIMARY KEY + 5 ints + updated_at) | 退役 → 单表 `game_stats` (room TEXT UNIQUE，W1 列名 `name` → `room`)，per-room 行族 |
| Client UI | `PlayerNameForm` + `SoloStatsPanel` | 改 `RoomGateDialog`（按需弹框）+ `OfflineStatsPanel`（W4 重命名）+ `HomeStatsEntry`（W3 战绩静态入口） |
| Test ids | `solo-sync` / `solo-stats-heading` / `solo-stats-error` / `reset-solo-stats` / `player-name-*` 全族 / `online-stats-*` 全族 | 重命名 → `offline-stats-heading` / `offline-stats-error` / `reset-offline-stats` / `offline-stats`；`room-gate-*`（新）/ `home-stats-entry` / `home-stats-link`（新）；旧 `player-name-*` / `online-stats-*` testid 整体退役（one-identity-qa A4 step 断言：`/offline` 路由下零命中） |
| Concurrency model | Last-write-wins per name | 保留；README 「FAQ · offline 跨设备同步」注明边界 |
| Unnamed-path network | Zero `/api/solo-stats` calls; `loadSoloStats()` only | W3 强化：「`/offline` 路由零网络写；`loadOfflineStats()` only；首页任何状态任何 focus 行为下 `/api/*` 请求数 = 0」（`one-identity-qa` Q1 + A4 step 硬断言） |

新契约的完整描述在「一局棋两版本 → 首页 = 引导页」与「localStorage key 表」两节；本表只保留「为什么是这样」的轨迹。

#### 玩家名输入对照（历史叙述 · W4 增补，已退役）

W4 时曾以 `components/PlayerNameForm.tsx` 的玩家名 / 字符计数 / 校验策略对照行业最佳实践
（NN/g / GOV.UK / Material / OWASP / MDN / Roblox Wiki）做差距审计。证据详见
`.omo/evidence/ulw/ulw-solo-pure-local-closeout/R1-name-input-best-practices.md` §1-§2。
**W3 D-3 后 PlayerNameForm 整体删除，本节仅作为「历史叙述」保留其决策记录；现行契约是 §4b RoomGateDialog 与 `lib/room-name.ts:isRoomName` / `normalizeRoom`（同源单点）。**

**已符合**（历史决策；与现行 RoomGateDialog 契约自洽）：

- 可见 label 在字段上方 + counter 同行右侧；placeholder 不当 label（NN/g BP-A1/A2 / GOV.UK BP-B1）
- `n/24` 实时计数 + `aria-live="polite"`（NN/g BP-B2 / Material BP-B3）
- 服务端权威白名单 + 422 拒绝；`lib/room-name.ts:isRoomName`（迁移自 `isPlayerName`）与 route handler
  `normalizeRoom`（迁移自 `normalizePlayerName`）字符范围同源（OWASP BP-F1 / BP-A5；AGENTS.md 反模式行显式约束）
- 控制字符过滤 C0/C1/DEL（OWASP BP-F2）
- 允许 CJK 与 emoji（字符接受侧；计数侧见已知差距）
- SSR-safe + `aria-invalid` + `aria-describedby` + `role="alert"`（a11y 最佳实践）
- 「先玩后填」路径：offline 模式账本无条件直显（W5 §1，无「匿名态」UI），
  首页 HomeStatsEntry 仅在 named 时渲染「查看 <room> 战绩 →」链接，
  跨设备同步通过 HomeDialogMount 弹框（用户主动确认）

**P0 采纳**（历史决策；W4 文档化即兑现）：

- **「字符计数按 UTF-16」明示**：单 emoji 视作 2 字符；12 emoji 即可达到 24/24 计数上限
  （Edward Ken Fox BP-C2）。R1 建议 W4 文档化即兑现，不引入 `Intl.Segmenter`
  （grapheme 改造风险面大于收益）。
- **「未命名 = 本机账本直显」兜底是合理选择**（W5 直显语义；旧述「匿名玩家」
  随匿名卡退役）：BP-E1 的 Roblox `Guest NNNN` 模式适用于「无服务端身份」场景；
  本仓 offline 无条件直显本机账本、online 由 RoomGateDialog 收名，引入随机昵称
  会让用户每次刷新看到不同名字，造成「为什么之前的战绩没了」的认知摩擦，
  故不采纳。

**已知差距，未采纳原因**（R1 §3 P1/P2；本轮不动，记入未来 wave）：

- **P1-4 `autoComplete="off"` + iOS `autoCapitalize="off" autoCorrect="off" spellCheck={false}`**：
  避免浏览器把用户真名 autofill 到房间名。**未采纳**：组件级 4 个 prop 改动属 UI 行为变更，
  需独立 `fix(ui)` commit；本轮 W4 是 docs-only，不混入代码改动。
- **P1-5 Enter 提交 IME composition 守卫**：现代 Chrome/Safari 已正确处理受控 input 的 IME
  composition；当前实现不阻塞用户。**未采纳**：影响面极小（仅 CJK 用户 + Enter），
  未来「本地化深改」wave 再处理。
- **P1-6 onBlur 后首次触摸显示错误**：当前 `onSubmit` 单点反馈等价 NN/g BP-A3 的
  「field-commit」分支；移动端体验已可接受。**未采纳**：需引入 `touched` 状态 +
  onBlur 守卫，UX 行为变更不在 W4 scope。
- **P2-7 接近上限视觉提示（≤5 字符剩余切换红色）**：影响 design tokens 与主题色；高对比度
  需先核 WCAG AA。**未采纳**：色彩改动属 design-token wave，本轮不在 scope。
- **P2-8 跨设备恢复暗示文案**：当前 sync 弹框已显式处理 merge UX；input 下加「同名玩家在
  其他设备有战绩时会自动合并」可能让 99% 用户反而困惑。**未采纳**：弹框即单一真相，
  input 不承担跨设备教学。
- **P2-9 grapheme 计数改造**：影响 char counter 与 maxLength；W4 scope 不动。
  **未采纳**：列入「本地化深改」wave。
- **P2-10 IME composition maxLength 软化**：现代浏览器已正确处理，受影响用户极少。
  **未采纳**：保留浏览器原生行为。

This contract is the single source of truth for design tokens. Any deviation must update this file first.
