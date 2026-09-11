import { Card } from '@/components/ui/Card';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { SoundToggle } from '@/components/SoundToggle';
import { ResetStatsButton } from '@/components/ResetStatsButton';
import { StartGameButton } from '@/components/StartGameButton';
import { StatsHydrator } from '@/components/StatsHydrator';
import { loadStats } from '@/lib/db';

export const dynamic = "force-dynamic";


export default async function HomePage() {
  const stats = await loadStats();

  const isEmpty = stats.totalGames === 0;

  return (
    <main className="page-shell page-fade-in">
      <StatsHydrator stats={stats} />
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-display font-display font-semibold tracking-tight">井字棋</h1>
          <SoundToggle />
        </div>
        <p className="text-body text-text-secondary">
          两人同设备轮流下，自动记录战绩。
        </p>
      </header>

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-h2 font-display font-medium">战绩</h2>
          {isEmpty ? (
            <p
              className="text-small text-text-secondary border border-dashed border-border-strong rounded-md px-3 py-2"
              data-testid="empty-state"
            >
              还没有战绩，下一把开始吧。
            </p>
          ) : null}
          <StatsGrid stats={stats} />
        </div>
      </Card>

      <div className="flex flex-row gap-3">
        <StartGameButton />
        <ResetStatsButton />
      </div>
    </main>
  );
}
