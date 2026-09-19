'use client';

import { useEffect, useRef, type ReactNode } from 'react';
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
 * PlayController (ulw-result-play-again-loop F1 mount-stale reset)
 * ──────────────────────────────────────────────────────────────────
 *
 * W1 mode rename: `'ranked'|'solo'` → `'online'|'offline'`. /play (the
 * online-ranked page) and /solo (the offline-ranked page) still
 * mount via `<PlayController>` — W3 will rename /play → /online and
 * W4 will rename /solo → /offline (per ulw-one-game-two-versions §1).
 *
 * W1 retired the `lastWriteAt` → router.replace('/result') effect:
 * the online ledger (and its lastWriteAt stamp) is gone. /result
 * becomes a per-name RSC reading the server row in W3.
 *
 * F1 mount-stale reset (ulw-result-play-again-loop §1):
 * - The Zustand store is a module-level singleton; soft navigation
 *   preserves `phase='won'|'drawn'` across routes. ResultNavigator
 *   only redirects on the first in-lifecycle transition to terminal,
 *   so `/result` shows the post-game RSC. But `/result` also exposes
 *   a plain `<Link href="/online">` "play again" affordance — clicking
 *   it soft-navigates back to /online with the residual board still
 *   in the store.
 * - The pre-F1 auto-start guard (`mode !== desired || phase === 'idle'`)
 *   skipped both branches on terminal residue, so the residual board
 *   rendered without resetting. Combined with ResultNavigator
 *   lastPushedPhaseRef re-treating the stale `won` as a fresh win,
 *   the user saw a flicker of the residual board followed by an
 *   immediate /result push — a dead loop.
 * - F1 contract: the FIRST effect run after mount treats
 *   `phase ∈ {won, drawn}` as stale regardless of mode match; it
 *   runs `restart()` (which clears the residual board → idle) and
 *   then `startGame(mode)` to seed a fresh game. Subsequent effect
 *   runs preserve the pre-F1 auto-start semantics so the existing
 *   RestartButton chain (`restart() → idle → effect reruns →
 *   startGame(mode)`) keeps working untouched.
 * - P9 (StrictMode double-mount): didMountRef is a useRef; setting
 *   it on the first run means the second mount run sees
 *   `firstMount=false` and falls through to the pre-F1 branch, so
 *   only ONE startGame() actually takes effect (the first run
 *   already flipped phase to `playing`, so the second run's mode/idle
 *   guard short-circuits).
 */
export function PlayController({ children, mode = 'online' }: Props) {
  const phase = useGameStore((s) => s.phase);
  const startGame = useGameStore((s) => s.startGame);
  const didMountRef = useRef(false);

  useEffect(() => {
    const s = useGameStore.getState();
    const terminal = s.phase === 'won' || s.phase === 'drawn';
    const firstMount = !didMountRef.current;
    didMountRef.current = true;
    if (s.mode !== mode || s.phase === 'idle' || (terminal && firstMount)) {
      if (s.phase !== 'idle') useGameStore.getState().restart();
      startGame(mode);
    }
  }, [phase, startGame, mode]);

  return <>{children}</>;
}
