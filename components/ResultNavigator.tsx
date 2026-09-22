'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { hasPendingOutcomeWrite, useGameStore, type GamePhase } from '@/lib/store';
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
 *  - W-F (ulw-online-reset-and-result-fresh D-7): when an online
 *    outcome write is in flight (seam in lib/store.ts), the push
 *    waits for it to settle — success OR failure (`awaitOutcomeWrite`
 *    swallows) — so /result's force-dynamic RSC reads the upserted
 *    row instead of a stale one. The sentinel write moves after the
 *    await (sentinel + push 紧邻原子). The no-pending path stays
 *    fully synchronous. The async continuation is guarded: once this
 *    effect cleans up (unmount / dep change), neither sentinel nor
 *    push may fire.
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
    // W-F 卸载竞态 guard (D-7)：下方 await 的续延可能在 cleanup 之后
    // 才跑（卸载 / dep 变化 / StrictMode 双调用）。cleanup 一旦发生，
    // 本导航作废——卸载后不得写哨兵、不得 push。guard 只拦「卸载」，
    // 不拦 phase 变化：restart 引发的 effect 重跑走 prevPhaseRef 的
    // witnessed 语义（prev 已 terminal → 早退，不二推）。
    let cancelled = false;
    const navigate = () => {
      if (cancelled) return;
      if (phase === 'won') {
        // Wins only (D-2). W-F (D-7)：哨兵写入移到记局写落定之后、
        // push 之前（哨兵 + push 紧邻原子），/result 的
        // ResultCelebration 挂载时哨兵必已就位。
        writeJustWonSentinel();
      }
      router.push(`/result?room=${encodeURIComponent(room)}`);
    };
    if (hasPendingOutcomeWrite()) {
      // W-F (D-7)：有在途记局写——先等它落定（成败皆落定，见
      // awaitOutcomeWrite 的吞错契约）再 push，/result 的
      // force-dynamic RSC 直读 DB 时 UPSERT 必已落。
      void useGameStore.getState().awaitOutcomeWrite().then(navigate);
    } else {
      // 无在途写（offline / anonymous-online / 写已落定）：保持同步
      // push，与旧 fire-and-forget 行为零差异。
      navigate();
    }
    return () => {
      cancelled = true;
    };
  }, [mode, phase, roomName, router]);

  return null;
}
