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
  SOLO_STATS_KEY,
  SOLO_SYNCED_SERVER_KEY,
  clearSoloStats,
  loadSyncedServerTotal,
  pendingSyncCount,
  persistSyncedServerTotal,
} from '@/lib/solo-stats';
import type { GameStats } from '@/lib/game';

/**
 * Home-return sync dialog mount
 * (ulw-name-login-one-truth W3 contract).
 *
 * The home page renders this client component once. Its mount effect
 * decides whether to open the SyncConfirmDialog based on:
 *   pending = max(0, local.totalGames - synced_server_total)
 *   declined = sessionStorage[ttt.solo.sync-declined.v1]
 *   → open when pending > declined (D3 决策 + A3 验收)
 *
 * Trigger coverage (A3 / B-T4):
 *  - Initial mount after a soft-navigation return to `/` (Next App
 *    Router re-runs the effect when pathname changes back to '/').
 *  - Hard reload on `/` (initial mount fires).
 *  - Tab refocus / bfcache restore via `focus` + `visibilitychange`.
 *  - `ttt:solo-stats-changed` custom event (dispatched after every
 *    solo game settles, so a long-running session that never leaves
 *    home still re-evaluates — defence in depth).
 *
 * On confirm success: clear local + write syncedServerTotal to the
 * server-merged row's totalGames + clearDeclinedPending.
 *
 * On reject: writeDeclinedPending(snapshot) so the same-session
 * re-mount doesn't re-open the dialog for the same pending value
 * (sessionStorage lives until the tab is closed).
 */
export function HomeDialogMount() {
  const pathname = usePathname();
  const setStoreName = useGameStore((s) => s.setPlayerName);
  const [open, setOpen] = useState<boolean>(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<number>(0);
  const [initialName, setInitialName] = useState<string>('');

  useEffect(() => {
    if (pathname !== '/') return;

    function evaluate(): void {
      const pending = pendingSyncCount();
      const declined = loadDeclinedPending();
      if (pending > declined && pending > 0) {
        const playerName = useGameStore.getState().playerName ?? '';
        setPendingSnapshot(pending);
        setInitialName(playerName);
        setOpen(true);
      }
    }
    evaluate();
    window.addEventListener('focus', evaluate);
    document.addEventListener('visibilitychange', evaluate);
    window.addEventListener('ttt:solo-stats-changed', evaluate);
    const onStorage = (e: StorageEvent): void => {
      if (
        e.key === SOLO_STATS_KEY ||
        e.key === SOLO_SYNCED_SERVER_KEY
      ) {
        evaluate();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('focus', evaluate);
      document.removeEventListener('visibilitychange', evaluate);
      window.removeEventListener('ttt:solo-stats-changed', evaluate);
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

  async function handleConfirm(
    name: string,
    mergedStats: GameStats,
  ): Promise<void> {
    // SyncConfirmDialog has already completed the postPlayerSession +
    // postSoloSync sequence and forwarded the server-merged row.
    // Here we adopt the sentinel so the next home-return has
    // pending = 0 and won't re-open the dialog.
    const previousSynced = loadSyncedServerTotal();
    const expectedSynced = previousSynced + (mergedStats.totalGames - previousSynced);
    // Use the server-merged totalGames directly — the server is
    // authoritative for the post-sync sentinel value.
    void expectedSynced;
    persistSyncedServerTotal(mergedStats.totalGames);
    clearSoloStats();
    clearDeclinedPending();
    setOpen(false);
    // If the user just used the dialog to register a new identity
    // (no prior name in store), mirror it so the online card refreshes.
    if (name && !useGameStore.getState().playerName) {
      setStoreName(name);
    }
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
