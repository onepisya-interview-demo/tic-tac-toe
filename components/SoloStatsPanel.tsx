'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyStats, type GameStats } from '@/lib/game';
import { loadSoloStats } from '@/lib/solo-stats';
import { fetchSoloStats } from '@/lib/solo-net';
import { useGameStore } from '@/lib/store';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { ResetStatsButton } from '@/components/ResetStatsButton';
import { Button } from '@/components/ui/Button';

/**
 * Solo-mode stats surface on /solo. Rendering contract:
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
 *      shows the manual 「同步」 button (testid `solo-sync`) when a
 *      sync is pending or inflight. Clicking it calls
 *      `useGameStore.retrySoloSync()`.
 *
 * The two branches never mix: unnamed → localStorage only; named →
 * network first, localStorage only as a fallback. This preserves the
 * A5 "未命名零网络" contract.
 */
export function SoloStatsPanel() {
  const phase = useGameStore((s) => s.phase);
  const playerName = useGameStore((s) => s.playerName);
  const pendingOutcome = useGameStore((s) => s.soloSync.pending);
  const inflight = useGameStore((s) => s.soloSync.inflight);
  const error = useGameStore((s) => s.soloSync.error);
  const retrySync = useGameStore((s) => s.retrySoloSync);
  const [stats, setStats] = useState<GameStats>(emptyStats);

  const phaseRef = useRef<typeof phase>(phase);

  // Re-read localStorage on phase change — solo branch of the store
  // persists synchronously inside makeMove before React observes the
  // phase change, so the fresh row is always in localStorage by the
  // time this runs. Used as the no-network fallback branch when no
  // name is set, and as a synchronous update trigger for named mode
  // (the follow-up GET below is the authoritative one).
  const refreshLocal = useCallback(() => {
    setStats(loadSoloStats());
  }, []);

  // Pull the canonical row from the server. Called on mount + after a
  // reconcile event + after a successful POST (which the store fires
  // via lastWriteAt — we observe lastWriteAt to know when to refresh).
  const refreshFromServer = useCallback(async (name: string) => {
    const r = await fetchSoloStats(name);
    if (r.ok) {
      // Server is authoritative; adopt its answer even when null
      // (fresh player). Never fall back to localStats here — that
      // would re-introduce the cross-device drift bug this whole
      // vertical slice exists to fix.
      setStats(r.value.stats ?? emptyStats());
    }
  }, []);

  // Manual sync button: re-POST the pending outcome (if any) via the
  // store's retrySoloSync action (the store has the playerName).
  // No-op when there is nothing to retry; the button is also rendered
  // as a "刷新" affordance when the user wants to force-pull the
  // canonical row from the server, in which case retrySoloSync is a
  // no-op and refreshFromServer runs immediately.
  const handleSync = useCallback(async () => {
    if (!playerName) return;
    if (pendingOutcome) {
      await retrySync();
    }
    await refreshFromServer(playerName);
  }, [playerName, pendingOutcome, retrySync, refreshFromServer]);

  // Mount: hydrate stats from the appropriate source based on playerName.
  useEffect(() => {
    if (playerName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refreshFromServer(playerName);
    } else {
      // No name → wave-1 behavior: pull from localStorage only.
      refreshLocal();
    }
    // Re-pull when name changes via the same-tab event (defense in
    // depth — zustand subscribers also pick up the change but the
    // CustomEvent path covers cases where this panel mounted before
    // the form, e.g. /solo → / → save name → back to /solo).
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
    // refreshFromServer / refreshLocal are stable (useCallback [] deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase settle: refresh localStorage (always) + named-mode GET refresh.
  // The auto-POST itself runs in the store; we just observe.
  useEffect(() => {
    if (phase !== 'won' && phase !== 'drawn') {
      phaseRef.current = phase;
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshLocal();
    if (playerName && phase !== phaseRef.current) {
      // Refresh from server after the store's auto-POST settles.
      // lastWriteAt drives navigation for ranked mode; for solo we
      // observe it indirectly via the pendingOutcome transition
      // (cleared to null on success). A short timeout lets the store
      // POST + state update flush before we GET.
      setTimeout(() => {
        void refreshFromServer(playerName);
      }, 250);
    }
    phaseRef.current = phase;
    // refreshLocal / refreshFromServer are stable for this effect's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, playerName]);

  const heading = playerName
    ? `单机战绩 — ${playerName}`
    : '单机战绩';

  const showSyncButton = playerName !== null;
  const showError = error !== null && playerName !== null;

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
            {inflight ? '同步中…' : pendingOutcome ? '同步' : '刷新'}
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
      <StatsGrid stats={stats} />
      <ResetStatsButton scope="local" onCleared={refreshLocal} />
    </div>
  );
}
