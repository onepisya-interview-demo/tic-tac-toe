'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

export function ResultActions() {
  const router = useRouter();
  const startGame = useGameStore((s) => s.startGame);
  const restart = useGameStore((s) => s.restart);
  const resetAll = useGameStore((s) => s.resetAll);

  return (
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
          // After DELETE, RSC needs to re-fetch stats so <StatsGrid> shows zeros.
          router.refresh();
        }}
        data-testid="reset-stats-result"
      >
        重置战绩
      </Button>
    </div>
  );
}
