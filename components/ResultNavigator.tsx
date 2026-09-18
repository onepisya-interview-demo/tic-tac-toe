'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';

type Props = {
  /**
   * W3 (ulw-one-game-two-versions A5) phase-driven navigation:
   * only online mode pushes /result on game end. Offline mode
   * keeps its existing in-page /solo auto-switch flow (W1 contract
   * from 860a4dc, /solo never navigates to /result — see
   * tests/qa/solo-mode-qa.mjs step "URL must NOT change").
   *
   * The navigator renders nothing — it is a pure side-effect
   * component mounted next to the Board on /play so the navigation
   * fires only after the store settles the win/draw.
   */
  mode: 'online' | 'offline';
};

/**
 * ResultNavigator
 * ───────────────
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
 *  - re-mounts: the navigator records the last phase it acted on in
 *    a ref so the same win does not double-push on React strict
 *    mode double-render. Combined with phase transitions being a
 *    strict equality check, this is sufficient.
 */
export function ResultNavigator({ mode }: Props) {
  const router = useRouter();
  const phase = useGameStore((s) => s.phase);
  const playerName = useGameStore((s) => s.playerName);
  const lastPushedPhaseRef = useRef<typeof phase>(null);

  useEffect(() => {
    if (mode !== 'online') return;
    if (phase !== 'won' && phase !== 'drawn') {
      // Phase rolled back to idle (restart) — clear the ref so the
      // next game can push again.
      lastPushedPhaseRef.current = null;
      return;
    }
    if (lastPushedPhaseRef.current === phase) return;
    const name = (playerName ?? '').trim();
    if (name === '') return;
    lastPushedPhaseRef.current = phase;
    router.push(`/result?name=${encodeURIComponent(name)}`);
  }, [mode, phase, playerName, router]);

  return null;
}
