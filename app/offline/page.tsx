'use client';

import { useEffect, useState, useTransition } from 'react';
import { ViewTransition } from 'react';
import Link from 'next/link';
import { Board } from '@/components/Board';
import { Button } from '@/components/ui/Button';
import { GameShell } from '@/components/GameShell';
import { PlayController } from '@/components/PlayController';
import { RestartButton } from '@/components/RestartButton';
import { WinConfetti } from '@/components/WinConfetti';
import { OfflineStatsPanel } from '@/components/OfflineStatsPanel';
import { useGameStore } from '@/lib/store';

type OfflineView = 'board' | 'stats';

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
 * <ViewTransition update="view-swap"> crossfade.
 *
 * W2 (ulw-room-migration-home-landing D-3): 标题改「线下房间」（was
 * 「单机练习」）；pass-and-play 语义通过「单机练习」的视图切换保留
 * 不强加文案。/offline 全程零网络，纯本地（one-identity-qa 硬契约）；
 * OfflineStatsPanel 文案已房间化（未建房间不记）。
 */
export default function OfflinePage() {
  const [view, setView] = useState<OfflineView>('board');
  const [, startTransition] = useTransition();
  const phase = useGameStore((s) => s.phase);
  const restart = useGameStore((s) => s.restart);

  const toggleView = () => {
    const next: OfflineView = view === 'board' ? 'stats' : 'board';
    startTransition(() => setView(next));
  };

  useEffect(() => {
    if (phase !== 'won' && phase !== 'drawn') return;
    const delay = phase === 'won' ? WIN_AUTO_SWITCH_MS : DRAW_AUTO_SWITCH_MS;
    const timer = setTimeout(() => {
      startTransition(() => setView('stats'));
    }, delay);
    return () => clearTimeout(timer);
  }, [phase, startTransition]);

  const playAgain = () => {
    restart();
    setView('board');
  };

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

  const statsActions = (
    <>
      <Button
        variant="primary"
        onClick={playAgain}
        data-testid="play-again-offline"
        className="w-full"
      >
        再来一局
      </Button>
      <Link href="/" className="w-full">
        <Button
          variant="secondary"
          className="w-full"
          data-testid="back-home-offline"
        >
          返回首页
        </Button>
      </Link>
    </>
  );

  return (
    <ViewTransition enter="page" exit="page" default="none">
      <GameShell
        title="线下房间"
        viewToggle={{ pressed: view === 'stats', onToggle: toggleView }}
        actions={actions}
        cardMinH="28rem"
        cardViewTransitionName="offline-card"
      >
        <ViewTransition key={view} update="view-swap" default="none">
          {view === 'board' ? (
            <PlayController mode="offline">
              <Board />
            </PlayController>
          ) : (
            <OfflineStatsPanel actions={statsActions} />
          )}
        </ViewTransition>
      </GameShell>
      <WinConfetti />
    </ViewTransition>
  );
}
