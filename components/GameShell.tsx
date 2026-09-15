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
};

/**
 * Shared shell for the two in-game pages (/play, /solo) and the toggleable
 * solo view. Now a Client Component because the optional view-toggle
 * callback must cross the React boundary; the wrapper markup itself is
 * tiny so the bundle cost is negligible. Single-line header with
 * [h1 compact | status slot | SoundToggle]; the play Card; and a footer
 * action row. The h1 stays `text-h2 font-semibold` so the row's tallest
 * slot is the status text. Status text stays `text-small` (existing
 * token) so the row never breaks to two lines on 375px.
 *
 * Mobile single-row contract (375×667, ulw-mobile-one-line-ux plan):
 * the h1, the live status text, and the SoundToggle all share one
 * `flex flex-row items-center justify-between` row. Status text gets
 * `text-small` (14/20) to match the design tokens — never a new token.
 */
export function GameShell({ title, children, actions, viewToggle }: Props) {
  const statusSlot = viewToggle ? (
    <button
      type="button"
      data-testid="view-toggle"
      aria-pressed={viewToggle.pressed}
      aria-label={viewToggle.pressed ? '切换到棋盘视图' : '切换到战绩视图'}
      onClick={viewToggle.onToggle}
      className="rounded-md transition-colors duration-[120ms] ease-out hover:bg-bg-hover focus-visible:bg-bg-hover"
    >
      <StatusBarClient />
    </button>
  ) : (
    <StatusBarClient />
  );

  return (
    <main className="page-shell page-fade-in">
      <header className="flex flex-row items-center justify-between gap-3">
        <h1 className="text-h2 font-display font-semibold shrink-0">{title}</h1>
        <div className="flex-1 flex justify-center min-w-0">
          {statusSlot}
        </div>
        <SoundToggle />
      </header>

      <Card>{children}</Card>

      <div className="flex flex-row gap-3">{actions}</div>
    </main>
  );
}
