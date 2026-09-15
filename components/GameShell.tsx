import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { SoundToggle } from '@/components/SoundToggle';
import { StatusBarClient } from '@/components/StatusBarClient';

type Props = {
  /** Page heading rendered in the header row (h1 slot). */
  title: string;
  /** Card content — the play area (e.g. <PlayController><Board /></PlayController>). */
  children: ReactNode;
  /** Footer action row: links/buttons injected by the page (back-home, restart, …). */
  actions: ReactNode;
};

/**
 * Shared shell for the two in-game pages (/play, /solo): single-line
 * header with [h1 compact | status text inline | SoundToggle], the play
 * Card, and a footer action row. Server-compatible on purpose (no
 * 'use client', no hooks) — SoundToggle / StatusBarClient carry their
 * own client boundaries, and children keep whatever client wrapper the
 * page passes in.
 *
 * Mobile single-row contract (375×667, ulw-mobile-one-line-ux plan):
 * the h1, the live status text, and the SoundToggle all share one
 * `flex flex-row items-center justify-between` row so the play card
 * never gets pushed below the fold by a stacked header. The h1 uses
 * `text-h2 font-semibold` so the row's tallest slot is the status text
 * (which can grow when a player name is appended); the SoundToggle's
 * own padding decides its own width. Status text gets `text-small`
 * (14/20) to match the design tokens — never a new token.
 */
export function GameShell({ title, children, actions }: Props) {
  return (
    <main className="page-shell page-fade-in">
      <header className="flex flex-row items-center justify-between gap-3">
        <h1 className="text-h2 font-display font-semibold shrink-0">{title}</h1>
        <div className="flex-1 flex justify-center min-w-0">
          <StatusBarClient />
        </div>
        <SoundToggle />
      </header>

      <Card>{children}</Card>

      <div className="flex flex-row gap-3">{actions}</div>
    </main>
  );
}
