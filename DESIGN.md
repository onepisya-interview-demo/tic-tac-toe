# DESIGN.md — tic-tac-toe (井字棋)

> Source spec: `.omo/ulw-loop/brief.md` (P3 审美段为输入)
> Stack: Next.js 15 App Router + Tailwind v4 + Zustand + Drizzle/SQLite
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
| `text-h3` | Inter | 20 / 28 | Card title |
| `text-body` | Inter | 16 / 24 | Default |
| `text-small` | Inter | 14 / 20 | Hint, secondary |
| `text-mono` | JetBrains Mono | 14 / 20 | Stats values, debug |
| `text-cell` | Geist | 48 / 1 | Tic-tac-toe X / O marker |

**Loading**: `next/font/google` (Inter, JetBrains Mono) + `next/font/local` (Geist via `geist/font`).

## 3. Spacing & Layout

- **Grid**: 8px base
- **Page container**: `max-w-[640px] mx-auto px-6 py-12`
- **Card padding**: `p-6` (24px)
- **Card gap**: `gap-4` (16px)
- **Cell size**: `w-24 h-24` (96 × 96)
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

**Implementation rule**: every primitive MUST use the tokens above; no inline hex.

## 5. Motion

| Interaction | Property | Duration | Easing |
| --- | --- | --- | --- |
| Button hover | `background-color` | 120ms | ease-out |
| Cell hover | `background-color` | 120ms | ease-out |
| Cell press | `transform: scale(0.98)` | 80ms | ease-out |
| Winner reveal | `opacity 0→1`, `scale 0.96→1` | 280ms | ease-out |
| Page transition | `opacity` | 150ms | ease-out |

- **No bounce / no slide-in / no parallax**
- GPU-only (`transform`, `opacity`, `background-color`)
- `prefers-reduced-motion`: collapse all to `0ms`

## 6. Accessibility

- **Focus ring**: `outline: 2px solid var(--accent); outline-offset: 2px`
- **Keyboard**: Tab between focusable, Enter/Space to activate
- **Cell keyboard**: when a cell is focused, Enter / Space makes the move
- **Contrast**: every text-on-bg pair ≥ 4.5:1 (verified for `text-primary`/`text-secondary`/`text-muted` on `bg-base`)
- **No emoji as icons**
- **`<button>` for actions, never `<div onClick>`**

## 7. Routing & Information Architecture

| Route | Purpose | Key elements |
| --- | --- | --- |
| `/` | Home | Title, 战绩卡片（StatsCard×N）, 开始游戏, 重置战绩 |
| `/play` | Game in progress | StatusBar, Board (3×3 Cell grid), 认输 / 重开 |
| `/result` | Game over | Winner / draw message, 庆祝动画, 再来一局, 返回首页, 重置战绩 |

**Transitions**:
- `/` → click 开始游戏 → `/play` (first player randomized in store)
- `/play` → 胜/平 → `/result`
- `/result` → click 再来一局 → `/play` (new randomized first player, stats updated)
- `/result` → click 返回首页 → `/`

## 8. Accepted Debt

- **No dark / light mode toggle** — single dark mode (per brief P2)
- **No mobile-optimized layout** — desktop ≥1280px primary (per brief P2)
- **No i18n** — Chinese only (per brief P2)
- **No sound** — silent game (per brief P2)
- **No animation library** — CSS transitions only (per brief 不能引入)

## 9. Quality Gates

- `npm run lint` — zero errors
- `npm run typecheck` — zero errors
- `npm run build` — succeeds
- `npm test` — all green, coverage ≥ 80% on `lib/`
- Visual QA via `omo:visual-qa` after build: dark `#0A0A0A` bg confirmed, Geist / Inter loaded, no FOUT, no emoji, focus rings visible

---

This contract is the single source of truth for design tokens. Any deviation must update this file first.
