'use client';

import { useCallback, useEffect, useState } from 'react';
import { emptyStats, type GameStats } from '@/lib/game';
import { loadSoloStats } from '@/lib/solo-stats';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { ResetStatsButton } from '@/components/ResetStatsButton';

/**
 * Solo-mode stats surface on /solo. W2 pure-purification (ulw-name-login-one-truth.md §1 G1):
 *
 *  - **Zero network**: the panel never issues a fetch on mount, on phase
 *    settle, or on user interaction. The W1 legacy `refreshFromServer` /
 *    `openSyncDialog` / `confirmSync` paths are gone; cross-device merge
 *    is exclusively a StartGameButton affordance on the home page.
 *  - **No player name**: this surface is the unnamed anonymous view.
 *    PlayerNameForm lives on the home page (app/page.tsx) and is W3's
 *    territory.
 *  - **SSR-safe**: emptyStats first frame, hydrate from localStorage
 *    after mount (the project-wide anti-pattern rule). ResetStatsButton
 *    (scope='local') clears localStorage instantly via onCleared.
 *
 * The surface is intentionally minimal: heading + StatsGrid + local
 * clear. testid nodes the QA probes contract on (`solo-stats`,
 * `solo-stats-heading`, `stat-value`, `reset-solo-stats`) stay;
 * everything that gated on the removed network/sync paths is gone.
 */
export function SoloStatsPanel() {
  const [stats, setStats] = useState<GameStats>(emptyStats);

  const refreshLocal = useCallback(() => {
    setStats(loadSoloStats());
  }, []);

  // Mount: hydrate from localStorage only. No network on mount or on
  // phase settle — solo accumulation is already persisted before the
  // phase change renders (lib/store.ts:makeMove's solo branch writes
  // localStorage synchronously inside the action).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshLocal();
  }, [refreshLocal]);

  return (
    <div className="flex flex-col gap-4" data-testid="solo-stats">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-h2 font-display font-medium"
          data-testid="solo-stats-heading"
        >
          单机战绩
        </h2>
      </div>
      <StatsGrid stats={stats} />
      <ResetStatsButton scope="local" onCleared={refreshLocal} />
    </div>
  );
}
