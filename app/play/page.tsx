'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { Board } from '@/components/Board';
import { StatusBar } from '@/components/ui/StatusBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SoundToggle } from '@/components/SoundToggle';

export default function PlayPage() {
  const router = useRouter();
  const phase = useGameStore((s) => s.phase);
  const currentPlayer = useGameStore((s) => s.currentPlayer);
  const winner = useGameStore((s) => s.winner);
  const startGame = useGameStore((s) => s.startGame);
  const restart = useGameStore((s) => s.restart);

  // Auto-start a game if none in progress
  useEffect(() => {
    if (phase === 'idle') startGame();
  }, [phase, startGame]);

  // Navigate to result when game ends
  useEffect(() => {
    if (phase === 'won' || phase === 'drawn') {
      const t = setTimeout(() => router.replace('/result'), 700);
      return () => clearTimeout(t);
    }
    return;
  }, [phase, router]);

  return (
    <main className="page-shell page-fade-in">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-h1 font-display font-semibold">游戏中</h1>
          <SoundToggle />
        </div>
        <StatusBar phase={phase} currentPlayer={currentPlayer} winner={winner} />
      </header>

      <Card>
        <Board />
      </Card>

      <div className="flex flex-row gap-3">
        <Link href="/" className="flex-1">
          <Button variant="secondary" className="w-full">
            返回首页
          </Button>
        </Link>
        <Button variant="ghost" onClick={restart} data-testid="restart">
          重新开局
        </Button>
      </div>
    </main>
  );
}
