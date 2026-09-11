'use client';

import { useEffect, useRef, type ReactNode } from 'react';
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
  // lastWriteAt 在 makeMove / resetAll 的 try/catch 后设置（commit 4 落地），
  // 订阅它的变化 = 订阅 "PUT 已落库" 事件。
  //
  // 关键时序坑（这个 commit 8 才暴露）：依赖数组如果含 `phase`，则 phase 变
  // 'won' 时 effect 立即跑——此时 lastWriteAt 还是 *上一局* 的值（非 null），
  // 条件 phase==='won' && lastWriteAt!==null 为 true，router.replace 在 await
  // apiPutStats *之前* 就发出，PUT 和 GET /result RSC 并发飞行。GET 经常先
  // 返回，DOM 读到旧 stats（stats-race-qa step 3/4 FAIL 实证）。
  //
  // 修法：用 ref 记录 "上次导航消费的 lastWriteAt"，effect 只在 lastWriteAt
  // *变化到新值* 时才触发导航。mount 时首次跑（lastWriteAt 已是上局值），
  // ref=lastWriteAt 不再触发；makeMove 中 set(lastWriteAt=new) 才让 ref 失配
  // → 触发一次导航。restart/startGame 不重置 lastWriteAt（commit 4 设计），
  // ref 自然隔离上一局。
  const navigatedFor = useRef<number | null>(null);
  useEffect(() => {
    if (lastWriteAt === null) return;
    if (lastWriteAt === navigatedFor.current) return;
    const s = useGameStore.getState();
    if (s.phase !== 'won' && s.phase !== 'drawn') return;
    navigatedFor.current = lastWriteAt;
    router.replace('/result');
  }, [lastWriteAt, router]);

  return <>{children}</>;
}
