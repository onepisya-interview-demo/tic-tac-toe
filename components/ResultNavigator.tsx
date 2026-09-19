'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore, type GamePhase } from '@/lib/store';

type Props = {
  /**
   * W3 (ulw-one-game-two-versions A5) phase-driven navigation:
   * only online mode pushes /result on game end. Offline mode
   * keeps its existing in-page /solo auto-switch flow (W1 contract
   * from 860a4dc, /offline never navigates to /result — see
   * tests/qa/offline-mode-qa.mjs step "URL must NOT change").
   *
   * The navigator renders nothing — it is a pure side-effect
   * component mounted next to the Board on /online so the navigation
   * fires only after the store settles the win/draw.
   */
  mode: 'online' | 'offline';
};

/**
 * ResultNavigator (ulw-result-play-again-loop F2 witnessed-migration guard)
 * ──────────────────────────────────────────────────────────────────────────
 *
 * Mounts on the `/play` page (online mode only). Watches the
 * Zustand store and on phase transition to 'won' / 'drawn' pushes
 * `/result?name=<playerName>`. The actual stats render is done
 * server-side in app/result/page.tsx (RSC, dynamic='force-dynamic')
 * — this component just navigates.
 *
 * Edge cases:
 *  - mode='offline' → no-op (offline experience stays in-page; this
 *    component is not mounted under /solo but the prop documents
 *    intent).
 *  - playerName empty at game-end → no push. Online play without a
 *    name cannot happen via the gate (StartGameButton blocks it),
 *    but a defensive guard here keeps the navigator safe to mount
 *    in tests / future render paths.
 *  - name carries a non-whitelist char → falls through and uses the
 *    trim. The RSC page also re-runs normalizePlayerName, so the
 *    server is the source of truth on the name (404 → fallback
 *    view).
 *  - re-mounts and observed-migration (F2): the navigator records
 *    the previous phase it observed in `prevPhaseRef`. A push only
 *    fires when this mount lifecycle has *witnessed* the
 *    non-terminal → terminal transition — i.e. `prev !== null`,
 *    `prev !== 'won' && prev !== 'drawn'`, and `phase` is terminal.
 *    If the component mounts while the store already holds a
 *    terminal phase (`prev === null` after the first effect run, so
 *    the transition happened BEFORE mount — outside this lifecycle's
 *    observation window), no push fires. This kills the dead-loop
 *    where `/result → play-again → /online` would otherwise re-push
 *    `/result` immediately from the stale `won` residue.
 *  - `restart()` (RestartButton or F1 mount reset) flips phase
 *    back through `idle`/`playing`, which overwrites `prevPhaseRef`
 *    to the non-terminal value so the next genuine in-lifecycle win
 *    can push again.
 *  - StrictMode double mount: refs persist across the intentional
 *    double-invocation, so the second mount run sees the value the
 *    first run wrote. The first mount's `prev === null` early return
 *    leaves the ref populated with the actual phase, and any
 *    transition that happens AFTER mount is observed exactly once.
 */
export function ResultNavigator({ mode }: Props) {
  const router = useRouter();
  const phase = useGameStore((s) => s.phase);
  const playerName = useGameStore((s) => s.playerName);
  const prevPhaseRef = useRef<GamePhase | null>(null);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (mode !== 'online') return;
    if (prev === null) return;
    const terminal = phase === 'won' || phase === 'drawn';
    if (!terminal) return;
    if (prev === 'won' || prev === 'drawn') return;
    const name = (playerName ?? '').trim();
    if (name === '') return;
    router.push(`/result?name=${encodeURIComponent(name)}`);
  }, [mode, phase, playerName, router]);

  return null;
}
