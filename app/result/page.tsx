'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatsCard } from '@/components/ui/StatsCard';

export default function ResultPage() {
  const phase = useGameStore((s) => s.phase);
  const winner = useGameStore((s) => s.winner);
  const lastOutcome = useGameStore((s) => s.lastOutcome);
  const stats = useGameStore((s) => s.stats);
  const startGame = useGameStore((s) => s.startGame);
  const restart = useGameStore((s) => s.restart);
  const resetAll = useGameStore((s) => s.resetAll);

  // If someone lands here without finishing a game, send them home.
  useEffect(() => {
    if (phase === 'idle') {
      // soft redirect — they can navigate themselves
    }
  }, [phase]);

  let headline: string;
  if (phase === 'won' && winner) {
    headline = `${winner} 获胜`;
  } else if (phase === 'drawn') {
    headline = '平局';
  } else {
    headline = '—';
  }

  const streakLabel =
    stats.currentStreak === 0
      ? '—'
      : stats.currentStreak > 0
        ? `X 连胜 ${stats.currentStreak}`
        : `O 连胜 ${Math.abs(stats.currentStreak)}`;

  return (
    <main className="mx-auto max-w-[640px] px-6 py-12 flex flex-col gap-8 flex-1">
      <header className="flex flex-col gap-2">
        <h1 className="text-display font-display font-semibold tracking-tight">本局结束</h1>
        <p
          className="text-h1 font-display font-medium text-accent"
          data-testid="result-headline"
        >
          {headline}
        </p>
        {lastOutcome && (
          <p className="text-small text-text-muted">结果：{lastOutcome}</p>
        )}
      </header>

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-h2 font-display font-medium">战绩</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatsCard label="总场次" value={stats.totalGames} />
            <StatsCard label="X 胜" value={stats.xWins} emphasis />
            <StatsCard label="O 胜" value={stats.oWins} />
            <StatsCard label="平局" value={stats.draws} />
            <StatsCard label="当前连胜" value={streakLabel} />
          </div>
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
