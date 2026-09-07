'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatsGrid } from '@/components/ui/StatsGrid';
import { SoundToggle } from '@/components/SoundToggle';
import { Confetti } from '@/components/Confetti';

export default function ResultPage() {
  const phase = useGameStore((s) => s.phase);
  const winner = useGameStore((s) => s.winner);
  const lastOutcome = useGameStore((s) => s.lastOutcome);
  const stats = useGameStore((s) => s.stats);
  const startGame = useGameStore((s) => s.startGame);
  const restart = useGameStore((s) => s.restart);
  const resetAll = useGameStore((s) => s.resetAll);

  let headline: string;
  let headlineClass = 'text-text-primary';
  if (phase === 'won' && winner) {
    headline = `${winner} 获胜`;
    headlineClass = winner === 'X' ? 'text-player-x' : 'text-player-o';
  } else if (phase === 'drawn') {
    headline = '平局';
    headlineClass = 'text-text-secondary';
  } else {
    headline = '—';
    headlineClass = 'text-text-muted';
  }

  return (
    <main className="page-shell page-fade-in">
      <header className="flex flex-col gap-2 relative">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-display font-display font-semibold tracking-tight">本局结束</h1>
          <SoundToggle />
        </div>
        <div className="relative">
          <p
            className={'text-h1 font-display font-medium ' + headlineClass}
            data-testid="result-headline"
            aria-live="assertive"
            aria-atomic="true"
          >
            {headline}
          </p>
          {phase === 'won' ? <Confetti /> : null}
        </div>
        {lastOutcome ? (
          <p className="text-small text-text-muted">结果：{lastOutcome === 'draw' ? '平局' : `${lastOutcome} 胜`}</p>
        ) : null}
      </header>

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-h2 font-display font-medium">战绩</h2>
          <StatsGrid stats={stats} />
        </div>
      </Card>

      <div className="flex flex-col gap-3">
        <Link href="/play" className="w-full" onClick={startGame}>
          <Button variant="primary" className="w-full" data-testid="play-again">
            再来一局
          </Button>
        </Link>
        <Link href="/" className="w-full">
          <Button variant="secondary" className="w-full">
            返回首页
          </Button>
        </Link>
        <Button
          variant="ghost"
          onClick={() => {
            resetAll();
            restart();
          }}
          data-testid="reset-stats-result"
        >
          重置战绩
        </Button>
      </div>
    </main>
  );
}
