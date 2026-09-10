import { Card } from '@/components/ui/Card';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { SoundToggle } from '@/components/SoundToggle';
import { loadStats } from '@/lib/db';
import { ResultBanner } from '@/components/ResultBanner';
import { ResultActions } from '@/components/ResultActions';
import { StatsHydrator } from '@/components/StatsHydrator';

export default async function ResultPage() {
  const stats = await loadStats();

  return (
    <main className="page-shell page-fade-in">
      <StatsHydrator stats={stats} />
      <header className="flex flex-col gap-2 relative">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-display font-display font-semibold tracking-tight">本局结束</h1>
          <SoundToggle />
        </div>
        <ResultBanner />
      </header>

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-h2 font-display font-medium">战绩</h2>
          <StatsGrid stats={stats} />
        </div>
      </Card>

      <ResultActions />
    </main>
  );
}
