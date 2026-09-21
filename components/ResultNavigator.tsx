'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore, type GamePhase } from '@/lib/store';
import { writeJustWonSentinel } from '@/components/ResultCelebration';

type Props = {
  /**
   * W2 (ulw-room-migration-home-landing): only online mode pushes
   * /result on game end. Offline mode keeps its existing in-page
   * auto-switch flow on /offline.
   *
   * The navigator renders nothing — it is a pure side-effect
   * component mounted next to the Board on /online so the navigation
   * fires only after the store settles the win/draw.
   */
  mode: 'online' | 'offline';
};

/**
 * ResultNavigator (ulw-result-play-again-loop F2 witnessed-migration guard
 * + ulw-room-migration-home-landing W2).
 *
 * Mounts on the `/online` page (online mode only). Watches the
 * Zustand store and on phase transition to 'won' / 'drawn' pushes
 * `/result?room=<roomName>`. The actual stats render is done
 * server-side in app/result/page.tsx (RSC, dynamic='force-dynamic')
 * — this component just navigates.
 *
 * W2 (room migration): query parameter `?name=` → `?room=`.
 *
 * Edge cases:
 *  - mode='offline' → no-op (offline experience stays in-page).
 *  - roomName empty at game-end → no push. Online play without a
 *    room cannot happen via the gate (StartGameButton + RoomGateMount
 *    blocks it), but a defensive guard here keeps the navigator
 *    safe to mount in tests / future render paths.
 *  - name carries a non-whitelist char → falls through and uses the
 *    trim. The RSC page also re-runs normalizeRoom, so the server
 *    is the source of truth on the room (404 → fallback view).
 *  - re-mounts and observed-migration (F2): the navigator records
 *    the previous phase it observed in `prevPhaseRef`. A push only
 *    fires when this mount lifecycle has *witnessed* the
 *    non-terminal → terminal transition. See F2 in
 *    ulw-result-play-again-loop for the full rationale.
 *  - `restart()` (RestartButton or F1 mount reset) flips phase
 *    back through `idle`/`playing`, which overwrites `prevPhaseRef`
 *    to the non-terminal value so the next genuine in-lifecycle win
 *    can push again.
 *  - W-A (ulw-result-win-celebration D-1/D-2): on a witnessed
 *    transition to 'won' (wins only — 'drawn' never writes), the
 *    navigator sets the one-shot sessionStorage sentinel
 *    `ttt.result.just-won.v1` immediately before the push. The
 *    /result island `ResultCelebration` consumes it (read + clear)
 *    to fire the arrival confetti exactly once; a reload, bookmark,
 *    or home stats entry finds no sentinel and stays plain. The
 *    sentinel write sits inside the same guarded block as the push
 *    (online mode + witnessed win + non-empty room), so every path
 *    that navigates to /result without it stays celebration-free.
 *  - StrictMode double mount: refs persist across the intentional
 *    double-invocation, so the second mount run sees the value the
 *    first run wrote.
 */
export function ResultNavigator({ mode }: Props) {
  const router = useRouter();
  const phase = useGameStore((s) => s.phase);
  const roomName = useGameStore((s) => s.roomName);
  const prevPhaseRef = useRef<GamePhase | null>(null);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (mode !== 'online') return;
    if (prev === null) return;
    const terminal = phase === 'won' || phase === 'drawn';
    if (!terminal) return;
    if (prev === 'won' || prev === 'drawn') return;
    const room = (roomName ?? '').trim();
    if (room === '') return;
    if (phase === 'won') {
      // Wins only (D-2). Written before the push so the sentinel is
      // already in place when /result's ResultCelebration mounts.
      writeJustWonSentinel();
    }
    router.push(`/result?room=${encodeURIComponent(room)}`);
  }, [mode, phase, roomName, router]);

  return null;
}
