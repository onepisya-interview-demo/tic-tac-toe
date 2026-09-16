'use client';

import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { SoundToggle } from '@/components/SoundToggle';
import { StatusBarClient } from '@/components/StatusBarClient';

type ViewToggle = {
  /** Whether the secondary view is currently active (drives aria-pressed). */
  pressed: boolean;
  /** Click handler — wired to a real <button> so Enter/Space activate
   *  it natively without extra key handling. */
  onToggle: () => void;
};

type Props = {
  /** Page heading rendered in the header row (h1 slot). */
  title: string;
  /** Card content — the play area (e.g. <PlayController><Board /></PlayController>). */
  children: ReactNode;
  /** Footer action row: links/buttons injected by the page (back-home, restart, …). */
  actions: ReactNode;
  /** Optional view toggle for the header center slot. When provided, the
   *  StatusBarClient gets wrapped in a real <button> with aria-pressed and
   *  data-testid="view-toggle" so the central area becomes a clickable
   *  board↔stats switch on /solo. The toggle never carries an h1 (rule:
   *  exactly one h1 per page); status-bar / status-text testids and
   *  aria-live="polite" stay intact inside the button so the announcement
   *  contract is preserved. When omitted, the slot renders the plain
   *  StatusBarClient (legacy /play and /result behavior). */
  viewToggle?: ViewToggle;
  /**
   * Optional `min-height` passed through to the Card. Use when the
   * Card swaps between children of different intrinsic heights and
   * you want the surrounding row to stay put during the crossfade.
   * /solo sets this to the max-of-board-and-stats height so the
   * toggle never reflows the page below the Card.
   */
  cardMinH?: string;
  /**
   * Optional `view-transition-name` passed through to the Card. Pass a
   * stable token (e.g. `'solo-card'`) to make the OLD/NEW snapshots
   * morph in place instead of crossfading separately. /solo passes
   * `'solo-card'`; /play and /result leave it undefined (no morph).
   */
  cardViewTransitionName?: string;
};

/**
 * Shared shell for the two in-game pages (/play, /solo) and the toggleable
 * solo view. Now a Client Component because the optional view-toggle
 * callback must cross the React boundary; the wrapper markup itself is
 * tiny so the bundle cost is negligible.
 *
 * Header layout (Bug C width jitter fix, ulw-solo-sync-rebuild W-A):
 *   The header is a 3-column grid `grid-cols-[1fr_auto_1fr]` instead of
 *   the previous `flex justify-between`. Each column has a fixed slot:
 *     [h1 (left) | status slot (center) | SoundToggle (right)].
 *   The status slot's intrinsic width is locked by the StatusBar's
 *   internal grid-stack (see components/ui/StatusBar.tsx) so phase
 *   transitions (轮到 X → X 获胜 → 平局 → 准备开始) never resize the
 *   surrounding <button>. The h1 and SoundToggle columns therefore
 *   stay at fixed offsets — visually the row never jumps.
 *
 *   Why grid and not (a) min-w-[7rem] on the toggle button (clamps
 *   visible text, looks wrong on the shortest message), or (b) flex
 *   with the button stretched by an explicit max-content min-width
 *   (drifts with font metrics): the grid isolates each column's width
 *   contributions and the StatusBar's internal grid-stack picks the
 *   max only across the four phase messages.
 *
 * Card body uses an optional `view-transition-name` (passed by the
 * /solo page as `'solo-card'`) so the board↔stats swap morphs in
 * place; the Card itself also has a min-h that matches the larger of
 * the two views so the row's vertical position never jumps either.
 *
 * Mobile single-row contract (375×667, ulw-mobile-one-line-ux plan):
 * the h1, the live status text, and the SoundToggle all share one
 * row. Status text gets `text-small` (14/20) to match the design
 * tokens — never a new token.
 */
export function GameShell({
  title,
  children,
  actions,
  viewToggle,
  cardMinH,
  cardViewTransitionName,
}: Props) {
  const statusSlot = viewToggle ? (
    <button
      type="button"
      data-testid="view-toggle"
      aria-pressed={viewToggle.pressed}
      aria-label={viewToggle.pressed ? '切换到棋盘视图' : '切换到战绩视图'}
      onClick={viewToggle.onToggle}
      className="view-toggle rounded-md transition-colors duration-[120ms] ease-out hover:bg-bg-hover focus-visible:bg-bg-hover"
    >
      <StatusBarClient />
    </button>
  ) : (
    <StatusBarClient />
  );

  return (
    <main className="page-shell page-fade-in">
      <header className="game-header grid items-center gap-3">
        <h1 className="text-h2 font-display font-semibold justify-self-start shrink-0">
          {title}
        </h1>
        <div className="game-header-status flex justify-center min-w-0">
          {statusSlot}
        </div>
        <div className="justify-self-end">
          <SoundToggle />
        </div>
      </header>

      <Card minH={cardMinH} viewTransitionName={cardViewTransitionName}>
        {children}
      </Card>

      <div className="flex flex-row gap-3">{actions}</div>
    </main>
  );
}
