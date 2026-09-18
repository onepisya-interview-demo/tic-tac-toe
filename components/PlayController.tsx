'use client';

import { useEffect, type ReactNode } from 'react';
import { useGameStore, type GameMode } from '@/lib/store';

type Props = {
  children: ReactNode;
  /**
   * Game mode this controller drives. Defaults to 'online'. /solo
   * (renamed /offline in W4) mounts with mode='offline' so the
   * store's auto-start calls startGame('offline') which seeds the
   * internal cache from localStorage.
   */
  mode?: GameMode;
};

/**
 * W1 changes:
 *
 * - Mode rename: `'ranked'|'solo'` → `'online'|'offline'`. /play (the
 *   online-ranked page) and /solo (the offline-ranked page) still
 *   mount via `<PlayController>` — W3 will rename /play → /online and
 *   W4 will rename /solo → /offline (per ulw-one-game-two-versions §1).
 * - Removed the `lastWriteAt` → router.replace('/result') effect: the
 *   online ledger (and its lastWriteAt stamp) is gone. /result becomes
 *   a per-name RSC reading the server row in W3.
 * - Auto-start contract preserved: idle OR mode-mismatch → restart() +
 *   startGame(mode). /offline still reseeds from localStorage via
 *   startGame('offline')'s internal branch.
 */
export function PlayController({ children, mode = 'online' }: Props) {
  const phase = useGameStore((s) => s.phase);
  const startGame = useGameStore((s) => s.startGame);

  useEffect(() => {
    const s = useGameStore.getState();
    if (s.mode !== mode || s.phase === 'idle') {
      if (s.phase !== 'idle') useGameStore.getState().restart();
      startGame(mode);
    }
  }, [phase, startGame, mode]);

  return <>{children}</>;
}
