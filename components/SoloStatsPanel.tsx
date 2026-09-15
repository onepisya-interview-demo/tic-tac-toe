'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyStats, type GameStats } from '@/lib/game';
import { loadSoloStats } from '@/lib/solo-stats';
import { getPlayerName } from '@/lib/player-name';
import { fetchSoloStats, postSoloOutcome } from '@/lib/solo-net';
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
 *  - **Player name set** (key ttt.player.name.v1):
 *    - On mount + on the `ttt:player-name-changed` event, GET the canonical
 *      row from `/api/solo-stats?name=…` and adopt it as the panel state.
 *      Server is authoritative; the local row stays as a fallback only.
 *    - On phase change to won/drawn, auto-POST `{name, outcome}` to
 *      `/api/solo-stats`. Success refreshes the panel via a follow-up
 *      GET (server returns the new full row). Failure keeps the local
 *      row visible and arms the manual sync button (testid `solo-sync`).
 *    - The 「同步」button is the fallback: re-POSTs the most recent
 *      outcome and re-pulls the canonical row. Visible only when a name
 *      is set and a sync is pending (or as a manual refresh).
 *
 * The two branches never mix: unnamed → localStorage only; named →
 * network first, localStorage only as a fallback. This preserves the
 * A5 "未命名零网络" contract.
 */
export function SoloStatsPanel() {
  const phase = useGameStore((s) => s.phase);
  const winner = useGameStore((s) => s.winner);
  const [stats, setStats] = useState<GameStats>(emptyStats);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [pendingOutcome, setPendingOutcome] =
    useState<'X' | 'O' | 'draw' | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const phaseRef = useRef<typeof phase>(phase);

  // Re-read localStorage on phase change — solo branch of the store
  // persists synchronously inside makeMove before React observes the
  // phase change, so the fresh row is always in localStorage by the
  // time this runs. Used as the no-network fallback branch.
  const refreshLocal = useCallback(() => {
    setStats(loadSoloStats());
  }, []);

  // Pull the canonical row from the server. Called on mount + after a
  // reconcile event + after a successful POST.
  const refreshFromServer = useCallback(async (name: string) => {
    const r = await fetchSoloStats(name);
    if (r.ok) {
      // Server is authoritative; adopt its answer even when null
      // (fresh player). Never fall back to localStats here — that
      // would re-introduce the cross-device drift bug this whole
      // vertical slice exists to fix.
      setStats(r.value.stats ?? emptyStats());
      setError(null);
    } else {
      // Server unreachable / errored. Keep the visible row (whatever
      // it was) and surface a one-line error so the sync button has
      // a reason to exist.
      setError('同步失败，可点同步重试');
    }
  }, []);

  // Auto-POST the outcome of a freshly-settled solo game when a player
  // name is set. Best-effort: failure leaves pendingOutcome set so the
  // sync button can re-attempt.
  const postOutcome = useCallback(
    async (name: string, outcome: 'X' | 'O' | 'draw') => {
      setSyncing(true);
      setError(null);
      const r = await postSoloOutcome(name, outcome);
      if (r.ok) {
        setPendingOutcome(null);
        // Adopt the server's authoritative row (it returns the new
        // full row after accumulation, so we don't need a follow-up
        // GET — but a GET keeps the contract symmetric with mount).
        await refreshFromServer(name);
      } else {
        setPendingOutcome(outcome);
        setError('自动提交失败，可点同步重试');
      }
      setSyncing(false);
    },
    [refreshFromServer],
  );

  // Manual sync button: re-POST the pending outcome (if any) then
  // re-pull from server. If nothing is pending, this is a pure
  // refresh — the button stays useful as a "force-pull from server"
  // affordance for the user who suspects their local row is stale.
  const handleSync = useCallback(async () => {
    if (!playerName) return;
    setSyncing(true);
    setError(null);
    try {
      if (pendingOutcome) {
        const r = await postSoloOutcome(playerName, pendingOutcome);
        if (r.ok) {
          setPendingOutcome(null);
        } else {
          setError('同步失败，请稍后重试');
          return;
        }
      }
      await refreshFromServer(playerName);
    } finally {
      setSyncing(false);
    }
  }, [playerName, pendingOutcome, refreshFromServer]);

  // Mount: hydrate player name + (if set) pull from server.
  useEffect(() => {
    const name = getPlayerName();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerName(name);
    phaseRef.current = phase;
    if (name) {
      void refreshFromServer(name);
    } else {
      // No name → wave-1 behavior: pull from localStorage only.
      refreshLocal();
    }
    // Listen for name changes from PlayerNameForm (same tab, custom
    // event — hard navigation isn't required to flip modes).
    const onNameChanged = (): void => {
      const next = getPlayerName();
      setPlayerName(next);
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

  // Phase settle: refresh localStorage (always) + auto-POST when named.
  useEffect(() => {
    if (phase !== 'won' && phase !== 'drawn') {
      phaseRef.current = phase;
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshLocal();
    if (playerName && phase !== phaseRef.current) {
      const outcome = winner ?? 'draw';
      void postOutcome(playerName, outcome);
    }
    phaseRef.current = phase;
    // refreshLocal / postOutcome are stable for this effect's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, playerName, winner]);

  const heading = playerName
    ? `单机战绩 — ${playerName}`
    : '单机战绩';

  const showSyncButton = playerName !== null;

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
            loading={syncing}
            data-testid="solo-sync"
            aria-label="同步战绩"
          >
            {syncing ? '同步中…' : pendingOutcome ? '同步' : '刷新'}
          </Button>
        ) : null}
      </div>
      {error ? (
        <p
          className="text-small text-text-muted"
          data-testid="solo-stats-error"
        >
          {error}
        </p>
      ) : null}
      <StatsGrid stats={stats} />
      <ResetStatsButton scope="local" onCleared={refreshLocal} />
    </div>
  );
}
