import type { GameStats } from '@/lib/game';
import { streakLabel } from '@/lib/game';
import { StatsCard } from '@/components/ui/StatsCard';

type Props = {
  stats: GameStats;
};

/** The five-stat战绩 grid shared by the home and result pages. */
export function StatsGrid({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      <StatsCard label="总场次" value={stats.totalGames} />
      <StatsCard label="X 胜" value={stats.xWins} emphasis />
      <StatsCard label="O 胜" value={stats.oWins} />
      <StatsCard label="平局" value={stats.draws} />
      <StatsCard label="当前连胜" value={streakLabel(stats.currentStreak)} />
    </div>
  );
}
