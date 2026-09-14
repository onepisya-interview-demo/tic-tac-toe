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
 * Shared shell for the two in-game pages (/play, /solo): page header with
 * the h1 + SoundToggle, the live StatusBar, the play Card, and a footer
 * action row. Server-compatible on purpose (no 'use client', no hooks) —
 * SoundToggle / StatusBarClient carry their own client boundaries, and
 * children keep whatever client wrapper the page passes in. This is the
 * same pure-presentation move as ui/BoardGrid: pages compose, the shell
 * only owns structure, so the QA testid contract stays in one place.
 */
export function GameShell({ title, children, actions }: Props) {
  return (
    <main className="page-shell page-fade-in">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-h1 font-display font-semibold">{title}</h1>
          <SoundToggle />
        </div>
        <StatusBarClient />
      </header>

      <Card>{children}</Card>

      <div className="flex flex-row gap-3">{actions}</div>
    </main>
  );
}
