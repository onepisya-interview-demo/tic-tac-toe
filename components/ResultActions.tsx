'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

/**
 * Action stack on the /result page. The reset-stats CTA mirrors the home
 * page's ResetStatsButton (commit 5) — same useState pending pattern,
 * same loading prop, same try/finally cleanup. Awaiting resetAll() before
 * restart() + router.refresh() preserves the B-3b invariant: the RSC
 * force-dynamic re-fetch sees zeros (DELETE has landed) before the user
 * can navigate back to /play.
 */
export function ResultActions() {
  const router = useRouter();
  const startGame = useGameStore((s) => s.startGame);
  const restart = useGameStore((s) => s.restart);
  const resetAll = useGameStore((s) => s.resetAll);
  const [pending, setPending] = useState(false);

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
        onClick={async () => {
          setPending(true);
          try {
            await resetAll();
            restart();
            router.refresh();
          } finally {
            setPending(false);
          }
        }}
        loading={pending}
        data-testid="reset-stats-result"
      >
        {pending ? '重置中…' : '重置战绩'}
      </Button>
    </div>
  );
}
