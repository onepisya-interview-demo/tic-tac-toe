# DESIGN.md — tic-tac-toe (井字棋)

> Source spec: `.omo/ulw-loop/brief.md` (P3 审美段为输入)
> Stack: Next.js 16 App Router + Tailwind v4 + Zustand + Drizzle/SQLite
> Generated: 2026-09-07
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
| `/` | (no single-line header — home is the score-cards layout) | n/a | n/a |
| `/play` | `[h1 compact | StatusBarClient inline | SoundToggle]` | "游戏中" (`text-h2 font-semibold`) | `status-bar` / `status-text` |
| `/solo` | `[h1 compact | StatusBarClient inline | SoundToggle]` | "单机练习" (`text-h2 font-semibold`) | `status-bar` / `status-text` |
| `/result` | `[ResultBanner h1 | SoundToggle]` | `result-headline` is the h1 | `result-headline` (aria-live=assertive) |

Each row is a single `flex flex-row items-center justify-between gap-3` line. The h1
slot is `text-h2 font-semibold` (compact) on `/play` and `/solo`; on `/result` the
h1 is `result-headline` itself (`text-h1 font-display font-medium`) because the
redundant `<h1>本局结束</h1>` was dropped during this pass. `StatusBar` is the
inline-flex pill variant (`text-small`, `whitespace-nowrap`) so the row's tallest
slot is the title, not the status text. `SoundToggle` keeps its own padding. Mobile
375×667 header boundingBox: 26px (was 62/62/90). Exactly one h1 per page.

**Implementation rule**: every primitive MUST use the tokens above; no inline hex.

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
| /solo Card morph | `view-transition-name: solo-card` 同位 morph（group snapshot）+ 容器 `min-h: 28rem` 锁高 | 180ms（继承 view-swap） | ease-out |
| view-toggle button width | grid-stack 双图层（StatusBar 4 态 `grid-area: 1/1` 同格叠放，visibility 切换可见态）+ button `min-width: max-content` 锁宽 | — (静态) | — |

- **View Transitions (route)**: 平台 API（React `<ViewTransition>`，Next 16 App Router 内置 canary 导出），非动画库，不违「禁动画库」之约；不支持 VT 的旧浏览器回退既有 `.page-fade-in`，`prefers-reduced-motion` 降级路径既有
- **In-page view switch**: 同上平台 API 的 `update` 路径（React 19 `<ViewTransition update="view-swap">` + `useTransition` 驱动），仅 `/solo` 顶栏切换棋盘↔战绩时启用；CSS 关键帧 `translate` + `opacity`，GPU-only，不动布局属性；`prefers-reduced-motion` 归零；不动 `prefers-reduced-motion` 既有全局 `*` 兜底
- **/solo Card morph（A-T3，ulw-solo-sync-rebuild W-A）**: Card 根加 `view-transition-name: solo-card`，浏览器对 OLD/NEW 各拍一张 group snapshot 做同位 morph；同容器 `min-h: 28rem` 锁高，使两态在同位 crossfade 而非高度 snap。28rem 是 Board (~22rem) 与 SoloStatsPanel (~24rem) 中取大者再留呼吸空间；hardcode 而非 `clamp` 是因为 Card 内容由 React 控制，不需要响应式伸缩
- **view-toggle button width（A-T2，ulw-solo-sync-rebuild W-A）**: StatusBar 4 态文本（准备开始 / 轮到 X / X 获胜 / 平局）以 `display: inline-grid` + `grid-area: 1/1` 同格叠放，非活动态 `visibility: hidden`；grid 容器宽度 = max(全部子项) = 活动态自带脉冲点的最宽态；button 仅 `min-width: max-content`，不写硬编码像素；`prefers-reduced-motion` 下行为不变（visibility 是布局态而非动画态）
- **No bounce / no slide-in / no parallax**; transitions communicate a move, outcome, or route change only
- GPU-only (`transform`, `opacity`, `background-color`)
- `prefers-reduced-motion`: collapse all to `0ms`
- **Interaction reference**: beui.dev Button / Number / Animated Badge mechanisms; adapted to CSS-only transitions and keyed content swaps
- **Sound**: optional, muted by default, native Web Audio one-shot tones only; no background music

### Why-not-the-other notes for new motion rules

(sanyam 克制原则：每个新动效必须有「为什么不选另一条」注释)

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
| `/` | Home | Title, 战绩卡片（StatsCard×N）, 开始对战, 单机练习, 重置战绩 |
| `/play` | Ranked game (two players, pass-and-play) | StatusBar, Board (3×3 Cell grid), 返回首页 / 重开 |
| `/solo` | Solo practice (local stats only) | StatusBar, Board, inline ResultBanner, SoloStatsPanel, 返回首页 / 重开 |
| `/result` | Game over (ranked only) | Winner / draw message, 庆祝动画, 再来一局, 返回首页, 重置战绩 |

**Transitions**:
- `/` → click 开始对战 → `/play` (first player randomized in store)
- `/` → click 单机练习 → `/solo` (first player randomized in store)
- `/play` → 胜/平 → `/result`
- `/solo` → 胜/平 → inline ResultBanner (no navigation)
- `/result` → click 再来一局 → `/play` (new randomized first player, stats updated)
- `/result` / `/solo` → click 返回首页 → `/`

### Modes: ranked (default) vs solo

One store, one `mode` field; the two modes are mirror contracts:

| | ranked (`/play`) | solo (`/solo`) |
| --- | --- | --- |
| Outcome write | `POST /api/stats/outcome` — server-authoritative accumulation | Zero network writes — local `recordOutcome` accumulation |
| Stats persistence | Server single row (`/api/stats`) | `localStorage['ttt.solo.stats.v1']` (5-number JSON; shape mismatch → `emptyStats`)
| Game over | Event-driven nav to `/result` (subscribes `lastWriteAt`) | Inline `ResultBanner` (Confetti included); no navigation by design |
| Stats display | Server snapshot via force-dynamic RSC | `SoloStatsPanel`: SSR renders `emptyStats`, hydrates in effect, re-reads on settle |
| Reset | `DELETE /api/stats` + `router.refresh()` (`reset-stats`) | `resetSoloStats()` — local only, instant (`reset-solo-stats`)

The two ledgers never mix: the home card reads the server row only; the solo panel reads localStorage only. All visual, motion, and accessibility contracts (§1–§6) apply identically to both modes.

## 8. Accepted Debt

- **No dark / light mode toggle** — single dark mode (per brief P2)
- **No mobile-optimized layout** — desktop ≥1280px primary (per brief P2)
- **No i18n** — Chinese only (per brief P2)
- **No background music** — optional one-shot sound effects are available through the user-mutable control
- **No animation library** — CSS transitions only (per brief 不能引入)

## 9. Quality Gates

门禁清单不在这里重复维护，两处为单一事实源：

- 工具链与阈值（vitest / coverage / mutation / QA 脚本）：README「Gauntlet 工具链」
- 提交前门禁与审计（commit-audit / vitest / typecheck / lint / build / QA）：AGENTS.md「Verification gate」

本文件的验收域是设计契约本身：视觉 QA 断言暗色 `#0A0A0A` 基底、Geist / Inter 加载（无 FOUT）、
无 emoji、focus ring 可见、动效符合第 5 节时长/缓动表。

**截图来源**（重制于 W-UI 波 1，commit 3）：

- 桌面 1280×900：`docs/screenshots/{home,board,result,solo}.png`（visual-qa 桌面 pass）
- 移动 375×667：`docs/screenshots/mobile/{home,board,solo,solo-stats,result}.png`（visual-qa 移动 pass，
  4 路由 + solo 双视图各一张）

**Mobile one-screen rule**（T3 验收契约，visual-qa 移动 pass `scrollWidth === viewport.width`
断言 + 显式度量）：`/play` / `/result` 路由在 375×667 视口下滚动长度严格等于视口高度（无纵向滚动）；
`/solo` 在 board ↔ stats 两视图下同样满足。`/home` 战绩为空时可一屏；战绩非空时 StatsGrid + 战绩卡
+ 按钮组纵向铺，仍允许轻量滚动（与桌面同等体验）。

---

### Solo by-name sync (W-SYNC wave 2)

| Contract | Value | Notes |
| --- | --- | --- |
| Storage key | `ttt.player.name.v1` (localStorage) | Versioned for future shape changes. SSR-safe + fail-soft, mirrors `ttt.solo.stats.v1`. |
| API: read | `GET /api/solo-stats?name={trimmed}` → `{ stats: GameStats \| null }` | 422 on invalid name (whitelist mirror of client-side `isPlayerName`) |
| API: write | `POST /api/solo-stats` body `{ name, outcome }` → `{ stats: GameStats }` | Server-authoritative — read → recordOutcome → upsert, last-write-wins |
| DB | `solo_records` (name TEXT PRIMARY KEY + 5 ints + updated_at) | One row per name; same shape as `game_stats` |
| Client UI | `components/PlayerNameForm.tsx` (input + save + clear) mounted in home 战绩 Card; `components/SoloStatsPanel.tsx` shows the name in heading when set | No new Tailwind tokens |
| Test ids | `player-name-input` / `player-name-save` / `player-name-clear` / `player-name-current` / `player-name-section` / `solo-stats-heading` / `solo-sync` / `solo-stats-error` | Stable QA contract; added on top of wave 1's `view-toggle` / `solo-stats` / `reset-solo-stats` |
| Concurrency model | Last-write-wins per name (intentional simplicity) | README documents the boundary; no CRDT / no timestamp merging |
| Unnamed-path network | Zero `/api/solo-stats` calls; `loadSoloStats()` only | A5 acceptance — verified by sync-qa step 01 |

This contract is the single source of truth for design tokens. Any deviation must update this file first.
