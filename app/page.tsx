'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useGameStore } from '@/lib/store';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatsCard } from '@/components/ui/StatsCard';
import { SoundToggle } from '@/components/SoundToggle';

export default function HomePage() {
  const stats = useGameStore((s) => s.stats);
  const startGame = useGameStore((s) => s.startGame);
  const resetAll = useGameStore((s) => s.resetAll);
  const hydrateStats = useGameStore((s) => s.hydrateStats);

  useEffect(() => {
    hydrateStats();
  }, [hydrateStats]);

  const streakLabel =
    stats.currentStreak === 0
      ? '—'
      : stats.currentStreak > 0
        ? `X 连胜 ${stats.currentStreak}`
        : `O 连胜 ${Math.abs(stats.currentStreak)}`;

  const isEmpty = stats.totalGames === 0;

  return (
    <main className="mx-auto max-w-[640px] px-6 py-12 flex flex-col gap-8 flex-1 page-fade-in">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatsCard label="总场次" value={stats.totalGames} />
            <StatsCard label="X 胜" value={stats.xWins} emphasis />
            <StatsCard label="O 胜" value={stats.oWins} />
            <StatsCard label="平局" value={stats.draws} />
            <StatsCard label="当前连胜" value={streakLabel} />
          </div>
        </div>
      </Card>

      <div className="flex flex-row gap-3">
        <Link href="/play" className="flex-1" onClick={startGame}>
          <Button variant="primary" className="w-full" data-testid="start-game">
            开始游戏
          </Button>
        </Link>
        <Button
          variant="ghost"
          onClick={resetAll}
          data-testid="reset-stats"
          aria-label="重置战绩"
        >
          重置战绩
        </Button>
      </div>
    </main>
  );
}
