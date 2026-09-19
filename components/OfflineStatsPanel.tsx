'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { emptyStats, type GameStats } from '@/lib/game';
import { loadOfflineStats } from '@/lib/offline-stats';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { ResetStatsButton } from '@/components/ResetStatsButton';
import { useGameStore } from '@/lib/store';

type Props = {
  /**
   * Optional action row rendered below the local-clear button. /offline
   * passes the result-view actions (再来一局 + 返回首页) so the user
   * sees a coherent "leave or replay" affordance at the bottom of the
   * same card they are reviewing data on.
   */
  actions?: ReactNode;
};

/**
 * Offline-mode stats surface on /offline.
 *
 * W2 (ulw-room-migration-home-landing):
 *  - isAnonymous reads `roomName` (was `playerName`).
 *  - The anonymous hint copy now says "未创建房间的玩家在本机的对局
 *    不会进入战绩账本。在首页创建房间后再开局，成绩才会从下一局开
 *    始累计。" (A9 文案红线：零「玩家名/注册/登录」)。
 *  - Testid contract is unchanged (`offline-stats*`); only the copy
 *    surface moves.
 *
 * Pure-purification (ulw-name-login-one-truth.md §1 G1):
 *  - **Zero network**: the panel never issues a fetch on mount, on phase
 *    settle, or on user interaction.
 *  - SSR-safe: emptyStats first frame, hydrate from localStorage after
 *    mount.
 *
 * The surface is intentionally minimal: heading + StatsGrid + local
 * clear. testid nodes the QA probes contract on (`offline-stats`,
 * `offline-stats-heading`, `stat-value`, `reset-offline-stats`) stay.
 */
export function OfflineStatsPanel({ actions }: Props = {}) {
  const [stats, setStats] = useState<GameStats>(emptyStats);
  const roomName = useGameStore((s) => s.roomName);
  const isAnonymous = !roomName;

  const refreshLocal = useCallback(() => {
    setStats(loadOfflineStats());
  }, []);

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
          <p className="font-medium text-text-primary">未建房间不记</p>
          <p className="text-sm">
            未创建房间的玩家在本机的对局不会进入战绩账本。在首页创建房间后再开局，成绩才会从下一局开始累计。
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
