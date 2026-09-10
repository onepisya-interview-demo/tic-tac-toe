'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';

type Props = {
  children: ReactNode;
};

export function PlayController({ children }: Props) {
  const router = useRouter();
  const phase = useGameStore((s) => s.phase);
  const startGame = useGameStore((s) => s.startGame);

  // 副作用 1: auto-start on idle
  useEffect(() => {
    if (phase === 'idle') startGame();
  }, [phase, startGame]);

  // 副作用 2: 700ms 后跳 /result
  useEffect(() => {
    if (phase === 'won' || phase === 'drawn') {
      const t = setTimeout(() => router.replace('/result'), 700);
      return () => clearTimeout(t);
    }
    return;
  }, [phase, router]);

  return <>{children}</>;
}
