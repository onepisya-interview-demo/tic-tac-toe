'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { emptyStats, type GameStats } from '@/lib/game';
import { loadOfflineStats } from '@/lib/offline-stats';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { ResetStatsButton } from '@/components/ResetStatsButton';

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
 * W5（ulw-offline-ledger-direct）：账本无条件直显（无名有名渲染一致）；无「匿名态」UI
 * 概念——`offline-stats-anonymous` 卡片与 isAnonymous 分支随卡片整体退役。无
 * 论 `store.roomName` 为空还是已设，本组件渲染同一棵树（StatsGrid 直显账本），
 * 仅数据可能不同。零网络契约不变。
 *
 * Pure-purification（ulw-name-login-one-truth.md §1 G1，沿用）：
 *  - **零网络**：挂载 / 阶段结算 / 用户交互均不发任何 fetch。
 *  - **SSR 安全**：emptyStats 首帧，挂载后从 localStorage 水合。
 *
 * 刻意保持极简：标题 + StatsGrid + 清空按钮 + 可选操作行。QA 探针契约的
 * testid（`offline-stats` / `offline-stats-heading` / `stat-value` /
 * `reset-offline-stats` / `offline-result-actions` / `play-again-offline`
 * / `back-home-offline`）保持不变。
 */
export function OfflineStatsPanel({ actions }: Props = {}) {
  const [stats, setStats] = useState<GameStats>(emptyStats);

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
      <StatsGrid stats={stats} />
      <ResetStatsButton scope="local" onCleared={refreshLocal} />
      {actions ? (
        <div className="flex flex-col gap-3" data-testid="offline-result-actions">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
