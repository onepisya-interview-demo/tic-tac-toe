'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { Board } from '@/components/Board';
import { StatusBar } from '@/components/ui/StatusBar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

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
      router.replace('/result');
    }
  }, [phase, router]);

  return (
    <main className="mx-auto max-w-[640px] px-6 py-12 flex flex-col gap-8 flex-1">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 font-display font-semibold">游戏中</h1>
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
