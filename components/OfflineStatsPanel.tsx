'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { emptyStats, type GameStats } from '@/lib/game';
import { loadOfflineStats } from '@/lib/offline-stats';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { ResetStatsButton } from '@/components/ResetStatsButton';
import { useGameStore } from '@/lib/store';

type Props = {
  /**
   * Optional action row rendered below the local-clear button. /solo
   * passes the result-view actions (再来一局 + 返回首页) so the user
   * sees a coherent "leave or replay" affordance at the bottom of the
   * same card they are reviewing data on. When omitted (legacy test
   * renders, future non-result mounts), the panel renders only
   * heading + StatsGrid + ResetStatsButton — the W2 pure-local contract.
   */
  actions?: ReactNode;
};

/**
 * Solo-mode stats surface on /offline. W2 pure-purification (ulw-name-login-one-truth.md §1 G1):
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
 * clear. testid nodes the QA probes contract on (`offline-stats`,
 * `offline-stats-heading`, `stat-value`, `reset-offline-stats`) stay;
 * everything that gated on the removed network/sync paths is gone.
 *
 * W3 result-paginated (ulw-ux-refresh-pass §3): when the page passes an
 * `actions` prop (only on the stats view after a win/draw), the panel
 * renders the action row below ResetStatsButton so the user can play
 * again or leave the route without scrolling. The actions are
 * page-owned (the page wires restart() + setView('board')) to keep
 * the panel agnostic of view state.
 */
export function OfflineStatsPanel({ actions }: Props = {}) {
  const [stats, setStats] = useState<GameStats>(emptyStats);
  const playerName = useGameStore((s) => s.playerName);
  const isAnonymous = !playerName;

  const refreshLocal = useCallback(() => {
    setStats(loadOfflineStats());
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
    <div className="flex flex-col gap-4" data-testid="offline-stats">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-h2 font-display font-medium"
          data-testid="offline-stats-heading"
        >
          单机战绩
        </h2>
      </div>
      {isAnonymous ? (
        <div
          className="rounded-md border border-border-subtle bg-surface-1 px-4 py-3 text-body text-text-secondary"
          data-testid="offline-stats-anonymous"
        >
          <p className="font-medium text-text-primary">无名不记</p>
          <p className="text-sm">
            未登录玩家在本机的对局不会进入战绩账本。在首页填写名字后再开局，成绩才会从下一局开始累计。
          </p>
        </div>
      ) : (
        <StatsGrid stats={stats} />
      )}
      <ResetStatsButton scope="local" onCleared={refreshLocal} />
      {actions ? (
        <div className="flex flex-col gap-3" data-testid="offline-result-actions">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
