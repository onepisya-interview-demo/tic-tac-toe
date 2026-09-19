'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  SyncConfirmDialog,
  clearDeclinedPending,
  loadDeclinedPending,
  writeDeclinedPending,
} from '@/components/SyncConfirmDialog';
import { useGameStore } from '@/lib/store';
import {
  OFFLINE_LAST_MERGED_LOCAL_KEY,
  OFFLINE_STATS_KEY,
  clearOfflineStats,
  pendingSyncCount,
  persistLastMergedLocal,
} from '@/lib/offline-stats';

/**
 * Home-return sync dialog mount
 * (ulw-name-login-one-truth W3 + ulw-room-migration-home-landing W2).
 *
 * The home page renders this client component once. Its mount effect
 * decides whether to open the SyncConfirmDialog based on:
 *   pending = max(0, local.totalGames - lastMergedLocal)
 *   declined = sessionStorage[ttt.offline.sync-declined.v1]
 *   → open when pending > declined (D3 决策 + A3 验收)
 *
 * W4 F1: the `lastMergedLocal` baseline is 0 right after a successful
 * merge (clearOfflineStats() already ran), so `pending === local`. The
 * dialog text "本机 N 局" therefore always matches the snapshot
 * that postSoloSync will actually send. (Pre-F1 the sentinel stored
 * the server's absolute totalGames, leaving a catch-up window where
 * pending < local and the text under-reported the payload — see
 * V4 MINOR-F1 and lib/offline-stats.ts:OFFLINE_LAST_MERGED_LOCAL_KEY.)
 *
 * Trigger coverage (A3 / B-T4):
 *  - Initial mount after a soft-navigation return to `/` (Next App
 *    Router re-runs the effect when pathname changes back to '/').
 *  - Hard reload on `/` (initial mount fires).
 *  - Tab refocus / bfcache restore via `focus` + `visibilitychange`.
 *  - `ttt:offline-stats-changed` custom event (dispatched after every
 *    offline game settles, so a long-running session that never leaves
 *    home still re-evaluates — defence in depth). W2 (room migration)
 *    preserved this listener because the only OnlineStatsCard
 *    refetch consumer of this event was removed; pendingSyncCount
 *    re-evaluation is the surviving contract (R-3 red line).
 *
 * On confirm success: clear local + write syncedServerTotal to the
 * server-merged row's totalGames + clearDeclinedPending.
 *
 * On reject: writeDeclinedPending(snapshot) so the same-session
 * re-mount doesn't re-open the dialog for the same pending value
 * (sessionStorage lives until the tab is closed).
 *
 * W2 (room migration): the localStorage sentinel swap (playerName →
 * roomName) does NOT affect this component — the offline ledger is
 * keyed on `ttt.offline.*` keys, which never held the name concept.
 * The setStoreName → setRoomName rename is the only call-site touch.
 */
export function HomeDialogMount() {
  const pathname = usePathname();
  const setStoreName = useGameStore((s) => s.setRoomName);
  const [open, setOpen] = useState<boolean>(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<number>(0);
  const [initialName, setInitialName] = useState<string>('');

  useEffect(() => {
    if (pathname !== '/') return;

    function evaluate(): void {
      const pending = pendingSyncCount();
      const declined = loadDeclinedPending();
      if (pending > declined && pending > 0) {
        const roomName = useGameStore.getState().roomName ?? '';
        setPendingSnapshot(pending);
        setInitialName(roomName);
        setOpen(true);
      }
    }
    evaluate();
    window.addEventListener('focus', evaluate);
    document.addEventListener('visibilitychange', evaluate);
    window.addEventListener('ttt:offline-stats-changed', evaluate);
    const onStorage = (e: StorageEvent): void => {
      if (
        e.key === OFFLINE_STATS_KEY ||
        e.key === OFFLINE_LAST_MERGED_LOCAL_KEY
      ) {
        evaluate();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', evaluate);
      document.removeEventListener('visibilitychange', evaluate);
      window.removeEventListener('ttt:offline-stats-changed', evaluate);
      window.removeEventListener('storage', onStorage);
    };
  }, [pathname]);

  function handleReject(): void {
    // Snapshot the pending count the user just declined so the
    // sentinel blocks re-opening for the SAME value, but a fresh
    // game that pushes pending above the snapshot re-triggers the
    // dialog on the next home-return.
    writeDeclinedPending(pendingSnapshot);
    setOpen(false);
  }

  async function handleConfirm(name: string): Promise<void> {
    // SyncConfirmDialog has already completed the postRoomSession +
    // postMerge sequence and forwarded the merged row. The F1
    // baseline model (W4) sets the post-merge local baseline to 0,
    // the canonical value right after clearOfflineStats() runs.
    // pendingSyncCount() now reads this baseline, so the next
    // home-return has pending = local - 0 = local — the dialog
    // text "本机 N 局" always matches the data the next merge
    // would actually send.
    persistLastMergedLocal(0);
    clearOfflineStats();
    clearDeclinedPending();
    setOpen(false);
    // If the user just used the dialog to register a new room
    // (no prior roomName in store), mirror it so subsequent
    // navigation carries the new identity.
    if (name && !useGameStore.getState().roomName) {
      setStoreName(name);
    }
    // W2: re-evaluate pendingSyncCount on a fresh home-return by
    // firing the same custom event the offline game-settle path
    // uses. (Pre-W2 this was OnlineStatsCard's refetch signal; the
    // card is gone — the listener still matters for the sync
    // dialog's own re-evaluation cycle.)
    window.dispatchEvent(
      new CustomEvent('ttt:offline-stats-changed', { detail: { source: 'merge' } }),
    );
  }

  return (
    <SyncConfirmDialog
      open={open}
      pendingGamesCount={pendingSnapshot}
      initialName={initialName}
      onConfirm={handleConfirm}
      onReject={handleReject}
    />
  );
}
