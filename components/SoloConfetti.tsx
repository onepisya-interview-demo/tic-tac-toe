'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store';
import { burstConfetti } from '@/lib/confetti';

/**
 * Win-state celebration layer for the /solo page. The header status-bar
 * already announces the outcome ("X 获胜" / "平局") inline, so the board
 * area stays uncluttered: this component renders nothing except the
 * burst-confetti canvas mount target when the solo game settles on a
 * win. Drawn games get no extra DOM — the status-bar announcement is
 * enough.
 *
 * Bug B fix (ulw-solo-sync-rebuild W-A): previously nested inside the
 * `view === 'board'` ternary of app/solo/page.tsx, each toggle
 * board→stats→board unmounted and remounted the underlying <Confetti>,
 * retriggering its burstConfetti() useEffect (visible as a second
 * confetti burst). Now hoisted to the Page level (outside the inner
 * <ViewTransition key={view}>), the burst itself is decoupled from
 * mount: a `celebratedRef` fires burstConfetti() exactly once per
 * phase→'won' transition. The mount target stays stable across view
 * toggles.
 *
 * Why a ref instead of (a) leaving <Confetti> mounted on the stats view
 * too (canvas-confetti owns a fixed inset-0 canvas that would overlap
 * the stats panel and steal pointer events), or (b) pushing
 * `celebratedAt` into the Zustand store (B-line territory, off-limits
 * for Wave A): the ref is the smallest correct change and stays in
 * this file's scope.
 *
 * Restart path: when phase returns to 'idle' / 'playing' (via the
 * Restart button on /solo, or after restart() on a draw the user
 * manually dismisses), the ref resets so the next win fires a new
 * burst. The contract matches solo-mode-qa's restart + driveTopRowWin
 * sequence.
 *
 * canvas-confetti attaches its own <canvas> to document.body so this
 * stable layer exposes the mounted celebration to QA / DOM tooling via
 * [data-testid="confetti"] without intercepting input.
 */
export function SoloConfetti() {
  const phase = useGameStore((s) => s.phase);
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (phase === 'won') {
      if (!celebratedRef.current) {
        celebratedRef.current = true;
        burstConfetti();
      }
    } else if (phase === 'idle' || phase === 'playing') {
      celebratedRef.current = false;
    }
  }, [phase]);

  if (phase !== 'won') return null;
  return (
    <span
      aria-hidden="true"
      data-testid="confetti"
      className="pointer-events-none fixed inset-0 z-50"
    />
  );
}
