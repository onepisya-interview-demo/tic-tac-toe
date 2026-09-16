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
 *   - Card body renders one of two views — Board (with inline
 *     SoloStatsPanel), wrapped in a ViewTransition keyed by the
 *     current view. The `useTransition` wrapper is what activates the
 *     in-page update animation (React 19 <ViewTransition> only fires
 *     for transitions, not raw setState).
 *   - <SoloConfetti /> is hoisted to the Page level (outside both the
 *     outer <ViewTransition enter="page"> and the inner
 *     <ViewTransition key={view}>). It renders the win celebration
 *     testid target ONCE per game; toggling board↔stats does not
 *     remount it, so the burst does not replay (Bug B fix in
 *     components/SoloConfetti.tsx).
 *   - The Card receives `minH="28rem"` and
 *     `viewTransitionName="solo-card"` so the browser takes a single
 *     group snapshot of the OLD and NEW children and morphs them in
 *     place at a fixed height (Bug C height fix + rvt decision 3).
 *     The 28rem token matches the larger of the Board (~22rem) and
 *     SoloStatsPanel (~24rem) heights with comfortable breathing room
 *     so the grid-stack layout doesn't pack against the card edge.
 *   - The Restart button is conditionally rendered for the 'board'
 *     view only — its purpose (restart the current game) is not
 *     relevant on the stats view, where the user is reading data, not
 *     playing. The 返回首页 link stays on both views (no contract
 *     requires it to disappear).
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

  // Restart is a board-view affordance: stats view is read-only and the
  // user is reviewing data, not playing. Tying the button to view keeps
  // the DOM (and the QA contract — board has data-testid="restart",
  // stats does not) honest with intent. The 返回首页 link stays for
  // both views because leaving the route is always meaningful.
  const actions = (
    <>
      <Link href="/" className="flex-1">
        <Button variant="secondary" className="w-full">
          返回首页
        </Button>
      </Link>
      {view === 'board' ? <RestartButton /> : null}
    </>
  );

  return (
    <ViewTransition enter="page" exit="page" default="none">
      <GameShell
        title="单机练习"
        viewToggle={{ pressed: view === 'stats', onToggle: toggleView }}
        actions={actions}
        cardMinH="28rem"
        cardViewTransitionName="solo-card"
      >
        <ViewTransition key={view} update="view-swap" default="none">
          {view === 'board' ? (
            <PlayController mode="solo">
              <Board />
            </PlayController>
          ) : (
            <SoloStatsPanel />
          )}
        </ViewTransition>
      </GameShell>
      {/* SoloConfetti is intentionally outside <GameShell> and outside the
          inner <ViewTransition key={view}>: hoisting keeps the burst
          mount target stable across board↔stats toggles so the
          celebration fires exactly once per win (Bug B). The
          z-index-50 fixed overlay still covers the Card area on either
          view. The aria-hidden / pointer-events-none on the inner span
          keep it decorative — input is not intercepted on either view. */}
      <SoloConfetti />
    </ViewTransition>
  );
}
