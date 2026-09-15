'use client';

import { useState, useTransition } from 'react';
import { ViewTransition } from 'react';
import Link from 'next/link';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/Button';
import { GameShell } from '@/components/GameShell';
import { PlayController } from '@/components/PlayController';
import { RestartButton } from '@/components/RestartButton';
import { SoloConfetti } from '@/components/SoloConfetti';
import { SoloStatsPanel } from '@/components/SoloStatsPanel';

type SoloView = 'board' | 'stats';

/**
 * Solo practice route. Client Component so the central header slot can
 * be wired to a board↔stats view toggle (see GameShell.viewToggle) and
 * the Card body can swap between the two views inside a React
 * <ViewTransition update="view-swap"> crossfade. The composition:
 *
 *   - GameShell header status-slot doubles as the toggle (real <button>,
 *     aria-pressed, testid=view-toggle, native Enter/Space); the status
 *     text inside it is still role=status + aria-live=polite so the
 *     announcement contract is preserved.
 *   - Card body renders one of two views — Board (with inline SoloConfetti
 *     celebration on win) OR SoloStatsPanel — wrapped in a ViewTransition
 *     keyed by the current view. The `useTransition` wrapper is what
 *     activates the in-page update animation (React 19 <ViewTransition>
 *     only fires for transitions, not raw setState).
 *   - prefers-reduced-motion collapses the swap to 0ms via the global
 *     ::view-transition-* rule in globals.css.
 *   - Mobile one-screen rule: 375×667 viewport fits both views inside
 *     the same Card without scrolling — confirmed by visual-qa.mjs.
 *
 * Solo never navigates to /result (no lastWriteAt by contract).
 */
export default function SoloPage() {
  const [view, setView] = useState<SoloView>('board');
  const [, startTransition] = useTransition();

  const toggleView = () => {
    const next: SoloView = view === 'board' ? 'stats' : 'board';
    startTransition(() => setView(next));
  };

  return (
    <ViewTransition enter="page" exit="page" default="none">
      <GameShell
        title="单机练习"
        viewToggle={{ pressed: view === 'stats', onToggle: toggleView }}
        actions={
          <>
            <Link href="/" className="flex-1">
              <Button variant="secondary" className="w-full">
                返回首页
              </Button>
            </Link>
            <RestartButton />
          </>
        }
      >
        <ViewTransition key={view} update="view-swap" default="none">
          {view === 'board' ? (
            <PlayController mode="solo">
              <Board />
              <SoloConfetti />
            </PlayController>
          ) : (
            <SoloStatsPanel />
          )}
        </ViewTransition>
      </GameShell>
    </ViewTransition>
  );
}
