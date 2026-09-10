'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

export function StartGameButton() {
  const startGame = useGameStore((s) => s.startGame);
  return (
    <Link href="/play" className="flex-1" onClick={startGame}>
      <Button variant="primary" className="w-full" data-testid="start-game">
        开始游戏
      </Button>
    </Link>
  );
}
