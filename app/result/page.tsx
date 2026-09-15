import { ViewTransition } from 'react';
import { Card } from '@/components/ui/Card';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { SoundToggle } from '@/components/SoundToggle';
import { loadStats } from '@/lib/db';
import { ResultBanner } from '@/components/ResultBanner';
import { ResultActions } from '@/components/ResultActions';
import { StatsHydrator } from '@/components/StatsHydrator';

export const dynamic = "force-dynamic";


export default async function ResultPage() {
  const stats = await loadStats();

  return (
    <ViewTransition enter="page" exit="page" default="none">
    <main className="page-shell page-fade-in">
      <StatsHydrator stats={stats} />
      <header className="flex flex-row items-center justify-between gap-3 relative">
        <ResultBanner headingLevel={1} />
        <SoundToggle />
      </header>

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-h2 font-display font-medium">战绩</h2>
          <StatsGrid stats={stats} />
        </div>
      </Card>

      <ResultActions />
    </main>
    </ViewTransition>
  );
}
