'use client';

import { useEffect, useState } from 'react';
import { WinConfetti } from '@/components/WinConfetti';

/**
 * One-shot sessionStorage sentinel marking "the user just navigated here
 * from a won online game" (ulw-result-win-celebration W-A, D-1/D-2).
 *
 * Written by ResultNavigator immediately before it pushes /result on the
 * witnessed phase transition to 'won' (wins only — draws never write,
 * D-2). Consumed exactly once by <ResultCelebration> on /result mount.
 *
 * The key lives here (not in a lib/ module): this component is the
 * contract owner — the "read-then-clear, consume once" semantics are what
 * makes the celebration replay-proof, and the writer (ResultNavigator)
 * imports the write helper from this file. Keeping producer API next to
 * the consumer contract in one whitelisted file prevents the two sides
 * from drifting (same lesson as the W1 four-endpoint normalizeName DRIFT).
 */
export const JUST_WON_SENTINEL_KEY = 'ttt.result.just-won.v1';

/**
 * Mark "arriving at /result from a won game". Client-only by contract:
 * the only caller is ResultNavigator's effect, which never runs on the
 * server. The typeof-window guard + try/catch keep it SSR-safe and
 * resilient to sessionStorage being unavailable (privacy mode) — the
 * celebration is best-effort, never load-bearing.
 */
export function writeJustWonSentinel(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(JUST_WON_SENTINEL_KEY, '1');
  } catch {
    // sessionStorage unavailable — skip the marker; /result renders the
    // plain scorecard (pre-wave behavior).
  }
}

/**
 * Read the sentinel and clear it in one step ("read-then-clear"). Returns
 * whether the marker was present. Clearing inside the same call is the
 * replay guard: a reload / bookmark / home-stats-entry arrival finds no
 * marker and renders nothing.
 */
export function consumeJustWonSentinel(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const had = window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY) !== null;
    if (had) window.sessionStorage.removeItem(JUST_WON_SENTINEL_KEY);
    return had;
  } catch {
    return false;
  }
}

/**
 * Win celebration island for the /result scorecard (ulw-result-win-celebration
 * W-A, D-1 = plan B: celebrate on arrival at /result).
 *
 * Mechanism:
 *  1. ResultNavigator writes the sentinel right before pushing
 *     /result on a witnessed phase transition to 'won'.
 *  2. On mount, this island consumes the sentinel (read + clear in one
 *     step). Hit → render <WinConfetti> (the exact layer /offline uses:
 *     hoisted fixed span, aria-hidden, burstConfetti() exactly once,
 *     reduced-motion no-op path). Miss → render nothing.
 *
 * Zero visible copy is added (plan §1: any banner text is a separate
 * word-by-word review); the RSC page's three render branches are
 * untouched.
 *
 * Why the sentinel instead of subscribing to the store: the store is a
 * module-level singleton whose phase survives soft navigation — a
 * store-subscribe would also replay on stale 'won' residue (the exact
 * false-replay edge the retired ResultBanner had). The sentinel pins the
 * trigger to "navigated here from a win, this page load" — a reload
 * (F2), bookmark (F3), or the home stats entry link (no writer on those
 * paths) finds nothing.
 *
 * Double-invocation safety (StrictMode dev double effect / double
 * render): the consume happens inside the effect together with the
 * state flip, and the state only ever goes false→true. The first effect
 * run consumes the sentinel and sets `celebrate`; a second run of the
 * same mount finds no sentinel and is a no-op — state never regresses.
 * (React's StrictMode remount simulation also preserves useState, so
 * the flag survives it; production builds have no double invocation at
 * all.)
 *
 * SSR safety (AGENTS.md 反模式: no sessionStorage on the server frame):
 * the server renders `null` (celebrate starts false); the sentinel check
 * runs client-side after hydration, so there is no hydration mismatch —
 * the server and the client's first paint agree on "no celebration".
 */
export function ResultCelebration() {
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    // Mount-time one-shot read of an external system (sessionStorage) into
    // component state — the same pattern as OfflineStatsPanel's refreshLocal
    // / RoomGateDialog's initialName. It runs once per mount (empty deps),
    // flips false→true at most once, and a re-run finds no sentinel (it was
    // consumed by the first run) so the state can never regress. Cascading
    // renders are bounded to exactly one extra pass on the celebration path.
    if (consumeJustWonSentinel()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCelebrate(true);
    }
  }, []);

  if (!celebrate) return null;
  return (
    <div data-testid="result-celebration">
      <WinConfetti />
    </div>
  );
}
