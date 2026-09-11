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
  const lastWriteAt = useGameStore((s) => s.lastWriteAt);
  const startGame = useGameStore((s) => s.startGame);

  // 副作用 1: auto-start on idle
  useEffect(() => {
    if (phase === 'idle') startGame();
  }, [phase, startGame]);

  // 副作用 2: 写事件落库后跳 /result（事件驱动而非 setTimeout 时间假设）。
  // lastWriteAt 在 makeMove / resetAll 的 try/catch 后设置（commit 4），
  // 这里订阅它的变化：phase 进入终态 + 写完 = 跳 /result。
  // mount 后首次 setInitialStats 也会 stamp lastWriteAt，所以新开一局
  // 不会误触发跳转。
  useEffect(() => {
    if (
      (phase === 'won' || phase === 'drawn') &&
      lastWriteAt !== null
    ) {
      router.replace('/result');
    }
  }, [phase, lastWriteAt, router]);

  return <>{children}</>;
}
