'use client';

import Link from 'next/link';
import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

/**
 * Action stack on the /result page. W1 retired the `resetAll`/DELETE
 * server branch along with the /api/stats chain — the ranked public
 * ledger (id=1, name=NULL) is gone. W3 will rebuild /result as an
 * RSC reading the per-name row; until then, the page only needs the
 * play-again + back-home CTAs.
 */
export function ResultActions() {
  const startGame = useGameStore((s) => s.startGame);

  return (
    <div className="flex flex-col gap-3">
      <Link href="/play" className="w-full" onClick={() => startGame()}>
        <Button variant="primary" className="w-full" data-testid="play-again">
          再来一局
        </Button>
      </Link>
      <Link href="/" className="w-full">
        <Button variant="secondary" className="w-full">
          返回首页
        </Button>
      </Link>
    </div>
  );
}
