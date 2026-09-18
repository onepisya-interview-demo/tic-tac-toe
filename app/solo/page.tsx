'use client';

import { useEffect, useState, useTransition } from 'react';
import { ViewTransition } from 'react';
import Link from 'next/link';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/Button';
import { GameShell } from '@/components/GameShell';
import { PlayController } from '@/components/PlayController';
import { RestartButton } from '@/components/RestartButton';
import { SoloConfetti } from '@/components/SoloConfetti';
import { SoloStatsPanel } from '@/components/SoloStatsPanel';
import { useGameStore } from '@/lib/store';

type SoloView = 'board' | 'stats';

/**
 * Auto-switch delay (ms) from `phase→'won'` to view swap. Tuned so the
 * win-glow animation (1.4s ease-in-out infinite in globals.css) gets at
 * least one full highlight pulse on the winning cells before the page
 * swaps to the stats view. 1200ms keeps the celebration legible while
 * the user is still on the board; if they manually toggle to stats
 * before the timer fires, the resulting setView('stats') is a no-op.
 */
const WIN_AUTO_SWITCH_MS = 1200;
/**
 * Auto-switch delay (ms) from `phase→'drawn'` to view swap. The
 * draw-shake animation is 300ms ease-out (globals.css:243-245) — 600ms
 * gives the shake room to settle and lets the user register the
 * outcome before the crossfade fires.
 */
const DRAW_AUTO_SWITCH_MS = 600;

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
 *   - Restart button is conditionally rendered for the 'board' view
 *     only — on the 'stats' view, the dedicated 「再来一局」 button
 *     inside SoloStatsPanel (rendered via the `actions` prop) is the
 *     equivalent restart affordance (Ulw W3 result-paginated
 *     experience; see plan .omo/plans/ulw-ux-refresh-pass.md §3 W3
 *     and §5 A6/A7).
 *   - The page-level actions slot (below the Card) is board-view only;
 *     the stats view renders its own result actions inside the panel
 *     so the user sees a coherent "leave or replay" affordance row on
 *     the same surface they are reviewing data on, and the Card row
 *     below stays clean (no duplicate 返回首页).
 *   - prefers-reduced-motion collapses the swap to 0ms via the global
 *     ::view-transition-* rule in globals.css.
 *   - Mobile one-screen rule: 375×667 viewport fits both views inside
 *     the same Card without scrolling — confirmed by one-screen-qa.mjs.
 *
 * Auto-switch on win/draw (Ulw W3): when phase transitions to 'won'
 * or 'drawn', a useEffect schedules `startTransition(setView('stats'))`
 * after WIN_AUTO_SWITCH_MS / DRAW_AUTO_SWITCH_MS so the user sees the
 * win-glow / draw-shake animation play out before the crossfade. The
 * effect cleanup cancels the pending timer if the phase changes again
 * (e.g. user clicks 重新开局 → phase becomes 'idle') so a stale
 * switch never fires after a manual restart. Solo never navigates to
 * /result (no lastWriteAt by contract).
 */
export default function SoloPage() {
  const [view, setView] = useState<SoloView>('board');
  const [, startTransition] = useTransition();
  const phase = useGameStore((s) => s.phase);
  const restart = useGameStore((s) => s.restart);

  const toggleView = () => {
    const next: SoloView = view === 'board' ? 'stats' : 'board';
    startTransition(() => setView(next));
  };

  // Auto-switch to the stats view after a win (1.2s — at least one
  // full win-glow pulse) or draw (0.6s — let draw-shake settle). The
  // effect re-runs on every phase change; cleanup cancels any pending
  // timer so a manual restart (phase→'idle') cannot be followed by a
  // stale auto-switch. If the user manually toggles to stats while the
  // timer is still scheduled, the timer's setView('stats') is a no-op
  // since the view is already 'stats' (React bails out of identical
  // state updates). startTransition is omitted from deps — it is
  // stable across renders per React 19 docs.
  useEffect(() => {
    if (phase !== 'won' && phase !== 'drawn') return;
    const delay = phase === 'won' ? WIN_AUTO_SWITCH_MS : DRAW_AUTO_SWITCH_MS;
    const timer = setTimeout(() => {
      startTransition(() => setView('stats'));
    }, delay);
    return () => clearTimeout(timer);
  }, [phase, startTransition]);

  const playAgain = () => {
    // restart() resets phase→'idle' which cancels any pending
    // auto-switch timer (effect cleanup) before we navigate back to
    // the board view, so the next move does not race a stale switch.
    restart();
    setView('board');
  };

  // Board-view footer actions: 返回首页 + 重新开局. The stats view
  // renders its own action row inside SoloStatsPanel (below the
  // StatsGrid / ResetStatsButton) so we never duplicate the 返回首页
  // link on the same page surface.
  const actions = view === 'board' ? (
    <>
      <Link href="/" className="flex-1">
        <Button variant="secondary" className="w-full">
          返回首页
        </Button>
      </Link>
      <RestartButton />
    </>
  ) : null;

  // Stats-view actions row: passed into SoloStatsPanel so the
  // "再来一局" + "返回首页" buttons sit at the bottom of the same card
  // the user is reviewing data on. playAgain calls store.restart()
  // then setView('board'); the effect cleanup for phase→'idle' then
  // cancels any in-flight auto-switch timer (defensive — the user
  // already triggered the switch themselves).
  const statsActions = (
    <>
      <Button
        variant="primary"
        onClick={playAgain}
        data-testid="play-again-solo"
        className="w-full"
      >
        再来一局
      </Button>
      <Link href="/" className="w-full">
        <Button
          variant="secondary"
          className="w-full"
          data-testid="back-home-solo"
        >
          返回首页
        </Button>
      </Link>
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
            <SoloStatsPanel actions={statsActions} />
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
