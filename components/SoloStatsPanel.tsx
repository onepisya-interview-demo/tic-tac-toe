'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyStats, type GameStats } from '@/lib/game';
import {
  clearSoloStats,
  clearSyncedServerTotal,
  loadSoloStats,
  loadSyncedServerTotal,
  pendingSyncCount,
  persistSyncedServerTotal,
} from '@/lib/solo-stats';
import { fetchSoloStats, postSoloSync, putSoloName } from '@/lib/solo-net';
import { useGameStore } from '@/lib/store';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { ResetStatsButton } from '@/components/ResetStatsButton';
import { SyncConfirmDialog } from '@/components/SyncConfirmDialog';
import { Button } from '@/components/ui/Button';

/**
 * Solo-mode stats surface on /solo. Rendering contract (wave-1 + B-T3/
 * B-T4 vertical slice in ulw-solo-sync-rebuild.md):
 *
 *  - **No player name** → original wave-1 behavior: SSR-safe emptyStats
 *    first frame, hydrate from localStorage after mount, re-read on phase
 *    change, never touch the network. ResetStatsButton(scope='local')
 *    clears the localStorage row instantly via onCleared.
 *
 *  - **Player name set** (read from store; store mirrors localStorage
 *    'ttt.player.name.v1'):
 *    - On mount + on the `ttt:player-name-changed` event + on phase
 *      change to won/drawn, GET the canonical row from
 *      `/api/solo-stats?name=…` and adopt it as the panel state. Server
 *      is authoritative; the local row stays as a fallback only.
 *    - The auto-POST on game end lives in the store (lib/store.ts solo
 *      branch) so it fires regardless of which view the user is on;
 *      this panel just observes the result via `soloSync.pending` and
 *      shows the manual 「同步」 button (testid `solo-sync`).
 *    - When the local row holds anything (e.g. a game settled while
 *      the auto-POST was offline, or the user just saved a name with
 *      pre-existing local wins), clicking 同步 opens the
 *      SyncConfirmDialog (testid `sync-confirm-dialog`) so the user
 *      explicitly opts into the merge write. Rejection is a guaranteed
 *      zero-write path (wave-1 §A5 contract). After a successful merge
 *      the panel shows the “线上 a + 本机 b = 共 c” breakdown for
 *      a few seconds before falling back to the normal heading.
 *
 * The two branches never mix: unnamed → localStorage only; named →
 * network first, localStorage only as a fallback.
 */
export function SoloStatsPanel() {
  const phase = useGameStore((s) => s.phase);
  const playerName = useGameStore((s) => s.playerName);
  const pendingOutcome = useGameStore((s) => s.soloSync.pending);
  const inflight = useGameStore((s) => s.soloSync.inflight);
  const error = useGameStore((s) => s.soloSync.error);
  const retrySync = useGameStore((s) => s.retrySoloSync);
  const [stats, setStats] = useState<GameStats>(emptyStats);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  // Pending local copy captured at the moment the dialog opens, so the
  // 「本机 N 局」 copy stays stable even if the user plays a game
  // mid-dialog and localStorage bumps.
  const [pendingLocalSnapshot, setPendingLocalSnapshot] = useState<GameStats>(emptyStats);
  const [mergeNote, setMergeNote] = useState<string | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const phaseRef = useRef<typeof phase>(phase);

  const refreshLocal = useCallback(() => {
    setStats(loadSoloStats());
  }, []);

  const refreshFromServer = useCallback(async (name: string) => {
    const r = await fetchSoloStats(name);
    if (r.ok) {
      const serverStats = r.value.stats ?? emptyStats();
      // Server is authoritative; adopt its answer even when null
      // (fresh player). Never fall back to localStats here — that
      // would re-introduce the cross-device drift bug this whole
      // vertical slice exists to fix.
      setStats(serverStats);
      // Mirror the server’s totalGames into the local sentinel so a
      // subsequent manual sync button click can compute the real
      // unsynced-diff instead of assuming a fresh context has zero
      // synced games (the cross-device save-only case).
      persistSyncedServerTotal(serverStats.totalGames);
    }
  }, []);

  /**
   * Open the sync-confirm dialog. The local row at the moment of
   * click is snapshotted so the dialog copy (“本机 N 局”) doesn’t
   * drift if the user plays a game while it’s open. Anything pending
   * from the store's auto-POST path is also retried here as a best-
   * effort before the dialog — if it succeeds, the local row already
   * matches the server and the dialog copy degrades to zero.
   */
  const openSyncDialog = useCallback(async () => {
    if (!playerName) return;
    if (pendingOutcome) {
      await retrySync();
    }
    setPendingLocalSnapshot(loadSoloStats());
    setDialogOpen(true);
  }, [playerName, pendingOutcome, retrySync]);

  /**
   * Pure GET refresh — the wave-2 §A5 degraded path. When nothing
   * is pending (local matches server or local is empty), clicking
   * 同步 just pulls the canonical row from the server without
   * prompting.
   */
  const refreshOnly = useCallback(async () => {
    if (!playerName) return;
    await refreshFromServer(playerName);
  }, [playerName, refreshFromServer]);

  /**
   * Sync-button click: decide dialog vs. pure GET based on the real
   * unsynced diff = local.totalGames - lastSyncedServerTotalGames.
   * The sentinel is updated by every successful auto-POST in the
   * store (lib/store.ts:persistSyncedServerTotal) so a wave-1 named
   * game that auto-POSTed cleanly has diff=0 — the manual button
   * then degrades to a pure GET refresh per wave-2 §A5 contract,
   * not a double-count merge. A real diff > 0 means there are games
   * the server doesn’t yet know about (failed auto-POST or new
   * device); only then does the dialog open.
   */
  const handleSync = useCallback(() => {
    const diff = pendingSyncCount();
    const hasFailedOutcome = pendingOutcome !== null;
    if (diff === 0 && !hasFailedOutcome) {
      void refreshOnly();
      return;
    }
    void openSyncDialog();
  }, [pendingOutcome, refreshOnly, openSyncDialog]);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  /**
   * Dialog 「合并并清空」 handler — runs the B-T4 sequence:
   *   1. PUT (if the chosen name differs from the previously stored
   *      one — idempotent ensureSoloRecord path, see B-T1 commit).
   *   2. POST /sync with the snapshotted local stats (so the dialog
   *      copy 「本机 N 局」 matches what we send).
   *   3. On success: adopt the server's answer, clear localStorage,
   //      show the breakdown, close the dialog.
   *   4. On failure: keep the dialog open with an inline error so the
   *      user can retry or bail (never silent — see note in dialog).
   */
  const confirmSync = useCallback(
    async (chosenName: string): Promise<void> => {
      if (!chosenName) return;
      // Step 1: PUT if the name changed (or there is no prior name).
      if (chosenName !== playerName) {
        const put = await putSoloName(chosenName);
        if (!put.ok) {
          throw new Error(
            put.reason === 'http-error'
              ? `存名失败 (HTTP ${put.status ?? '?'})`
              : `存名失败 (${put.reason})`,
          );
        }
        useGameStore.getState().setPlayerName(chosenName);
      }
      // Step 2: POST /sync with the snapshotted local row.
      const localSnapshot = pendingLocalSnapshot;
      const r = await postSoloSync(chosenName, localSnapshot);
      if (!r.ok) {
        throw new Error(
          r.reason === 'http-error'
            ? `同步失败 (HTTP ${r.status ?? '?'})`
            : `同步失败 (${r.reason})`,
        );
      }
      // Step 3a: server is authoritative; adopt its answer.
      setStats(r.value.stats);
      // Step 3b: clear local solo stats + reset the sync sentinel.
      // The merge result is now the canonical state; persisting the
      // new server totalGames into the sentinel means the next
      // sync-button click diff will be 0 and degrade to a pure GET
      // refresh (wave-2 §A5 contract).
      clearSoloStats();
      clearSyncedServerTotal();
      persistSyncedServerTotal(r.value.stats.totalGames);
      useGameStore.getState().__resetInternalForTests();
      useGameStore.setState({
        soloSync: { pending: null, inflight: false, error: null },
      });
      // Step 3c: disclosure — server_stats - client_stats = what
      // server already had before this sync. Show for ~4s so the
      // user sees the merge result before the heading falls back.
      const serverBefore = Math.max(
        0,
        r.value.stats.totalGames - localSnapshot.totalGames,
      );
      const localBefore = localSnapshot.totalGames;
      const mergedTotal = r.value.stats.totalGames;
      setMergeNote(
        `已合并：线上 ${serverBefore} + 本机 ${localBefore} = 共 ${mergedTotal} 局`,
      );
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setMergeNote(null), 4000);
      // Step 3d: close dialog.
      setDialogOpen(false);
    },
    [playerName, pendingLocalSnapshot],
  );

  // Mount: hydrate stats from the appropriate source based on playerName.
  useEffect(() => {
    if (playerName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refreshFromServer(playerName);
    } else {
      refreshLocal();
    }
    const onNameChanged = (): void => {
      const next = useGameStore.getState().playerName;
      if (next) {
        void refreshFromServer(next);
      } else {
        refreshLocal();
      }
    };
    window.addEventListener('ttt:player-name-changed', onNameChanged);
    return () => {
      window.removeEventListener('ttt:player-name-changed', onNameChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase settle: refresh localStorage (always) + named-mode GET refresh.
  useEffect(() => {
    if (phase !== 'won' && phase !== 'drawn') {
      phaseRef.current = phase;
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshLocal();
    if (playerName && phase !== phaseRef.current) {
      setTimeout(() => {
        void refreshFromServer(playerName);
      }, 250);
    }
    phaseRef.current = phase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, playerName]);

  // Cleanup the merge-note timer on unmount.
  useEffect(() => {
    return () => {
      if (noteTimer.current) clearTimeout(noteTimer.current);
    };
  }, []);

  const heading = playerName
    ? `单机战绩 — ${playerName}`
    : '单机战绩';

  const showSyncButton = playerName !== null;
  const showError = error !== null && playerName !== null;
  const syncButtonLabel = inflight
    ? '同步中…'
    : pendingOutcome
      ? '同步'
      : dialogOpen
        ? '同步'
        : '同步';
  const localSnapshotForDialog = pendingLocalSnapshot;

  return (
    <div className="flex flex-col gap-4" data-testid="solo-stats">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-h2 font-display font-medium"
          data-testid="solo-stats-heading"
        >
          {heading}
        </h2>
        {showSyncButton ? (
          <Button
            variant="ghost"
            onClick={handleSync}
            loading={inflight}
            data-testid="solo-sync"
            aria-label="同步战绩"
          >
            {syncButtonLabel}
          </Button>
        ) : null}
      </div>
      {showError ? (
        <p
          className="text-small text-text-muted"
          data-testid="solo-stats-error"
        >
          同步失败（{error}），可点同步重试
        </p>
      ) : null}
      {mergeNote ? (
        <p
          className="text-small text-text-secondary"
          data-testid="solo-stats-merge-note"
          role="status"
        >
          {mergeNote}
        </p>
      ) : null}
      <StatsGrid stats={stats} />
      <ResetStatsButton scope="local" onCleared={refreshLocal} />
      <SyncConfirmDialog
        open={dialogOpen}
        pendingGamesCount={Math.max(0, localSnapshotForDialog.totalGames - loadSyncedServerTotal())}
        initialName={playerName ?? ''}
        onConfirm={confirmSync}
        onReject={closeDialog}
      />
    </div>
  );
}
