'use client';

import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

/**
 * Which stats store this button clears (W1):
 *
 * - 'local' (default): the offline contract — `resetOfflineStats()` is a
 *   synchronous, purely local store action (clears the localStorage row
 *   + internal cache). No network, no router.refresh (nothing server-
 *   side changed; the panel re-renders via onCleared). data-testid is
 *   "reset-offline-stats", its own QA contract.
 *
 * W1 retired the `scope='server'` branch along with the /api/stats
 * chain: the ranked public ledger (id=1, name=NULL) no longer exists
 * in the schema, so there is nothing server-side for an online-reset
 * to clear. (W2 时曾预计 W3 围绕 `OnlineStatsCard` + `PlayerNameForm`
 * 重建首页战绩契约；实际 W2 客户端波将两组件整体退役，战绩展示主场
 * 移至 /result RSC + /offline 本地面板，per-name reset 未再引入。)
 *
 * `onCleared` fires after the local clear settles so data owners
 * (e.g. OfflineStatsPanel) can re-read their source.
 */
type Props = {
  scope?: 'local';
  onCleared?: () => void;
  /** Optional className forwarded to the underlying Button. */
  className?: string;
};

export function ResetStatsButton({ scope = 'local', onCleared, className }: Props) {
  const resetOfflineStats = useGameStore((s) => s.resetOfflineStats);
  const isLocal = scope === 'local';

  const handleClick = () => {
    if (!isLocal) return;
    resetOfflineStats();
    onCleared?.();
  };

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      className={className}
      data-testid="reset-offline-stats"
      aria-label="清空单机战绩"
    >
      清空战绩
    </Button>
  );
}
