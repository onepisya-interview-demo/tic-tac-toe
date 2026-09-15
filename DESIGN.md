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
- **Page container**: `max-w-[640px] mx-auto px-6 py-12`
- **Card padding**: `p-6` (24px)
- **Card gap**: `gap-4` (16px)
- **Cell size**: `w-24 h-24` (96 × 96)
- **Cell size mobile**: `w-20 h-20` (80 × 80), keeping the board inside the mobile card
- **Cell gap**: `gap-2` (8px)
- **Button padding**: `px-4 py-2` (16 × 8)
- **Section gap**: `gap-8` (32px)

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
| In-page view switch | `translate` (6px→0) + `opacity` 双向 | 180ms | ease-out |

- **View Transitions (route)**: 平台 API（React `<ViewTransition>`，Next 16 App Router 内置 canary 导出），非动画库，不违「禁动画库」之约；不支持 VT 的旧浏览器回退既有 `.page-fade-in`，`prefers-reduced-motion` 降级路径既有
- **In-page view switch**: 同上平台 API 的 `update` 路径（React 19 `<ViewTransition update="view-swap">` + `useTransition` 驱动），仅 `/solo` 顶栏切换棋盘↔战绩时启用；CSS 关键帧 `translate` + `opacity`，GPU-only，不动布局属性；`prefers-reduced-motion` 归零；不动 `prefers-reduced-motion` 既有全局 `*` 兜底
- **No bounce / no slide-in / no parallax**; transitions communicate a move, outcome, or route change only
- GPU-only (`transform`, `opacity`, `background-color`)
- `prefers-reduced-motion`: collapse all to `0ms`
- **Interaction reference**: beui.dev Button / Number / Animated Badge mechanisms; adapted to CSS-only transitions and keyed content swaps
- **Sound**: optional, muted by default, native Web Audio one-shot tones only; no background music

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

---

This contract is the single source of truth for design tokens. Any deviation must update this file first.
