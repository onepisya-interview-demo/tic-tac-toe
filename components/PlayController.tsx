'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore, type GameMode } from '@/lib/store';

type Props = {
  children: ReactNode;
  /**
   * Game mode this controller drives. Defaults to 'ranked' — exactly the
   * pre-mode /play behavior (auto-start calls startGame(), which resolves
   * undefined → 'ranked'). 'solo' auto-starts a solo game and hard-disables
   * the /result navigation (see the nav effect below).
   */
  mode?: GameMode;
};

export function PlayController({ children, mode = 'ranked' }: Props) {
  const router = useRouter();
  const phase = useGameStore((s) => s.phase);
  const lastWriteAt = useGameStore((s) => s.lastWriteAt);
  const startGame = useGameStore((s) => s.startGame);

  // 副作用 1: auto-start on idle + mode mismatch restart。mode 显式入
  // deps：/solo 挂载时以 startGame('solo') 开局（store 会从 localStorage
  // 基线灌入战绩缓存），/play 的缺省 'ranked' 行为与 startGame() 完全
  // 一致。
  //
  // 契约缺口（mode mismatch 路径）：原实现只在 phase==='idle' 时调
  // startGame(mode)。若用户从 /play 中途软导航到 /solo（phase 残留
  // 'playing'、store.mode='ranked'），本 effect 不动 store，mode 字段
  // 仍为 'ranked'——下一次 makeMove 走 ranked 分支发起网络写，破
  // "solo 全程零网络写" 合同。修法：当 store.mode 与本 controller 的
  // mode prop 不一致（典型场景：soft nav /play → /solo 中途），先
  // restart() 把 phase 拉回 idle、再 startGame(mode) 让其内部的 solo
  // 分支（loadSoloStats 重灌战绩缓存）正确触发；同名 phase==='idle'
  // 走原路径（直接 startGame，restart 是 no-op 因为 phase 已是 idle）。
  // store.mode===mode && phase==='playing' 路径跳过（用户在当前会话
  // 中对局中，不应被无意义重启）。
  useEffect(() => {
    const s = useGameStore.getState();
    if (s.mode !== mode || s.phase === 'idle') {
      if (s.phase !== 'idle') useGameStore.getState().restart();
      startGame(mode);
    }
  }, [phase, startGame, mode]);

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
    // 显式 solo 防御（纵深防御第二层）：solo 对局从不 stamp lastWriteAt
    //（store 契约），但软导航不卸载文档——上一局 ranked 写下的 lastWriteAt
    // 或 StatsHydrator 挂载时的水合 stamp 都可能在 solo 会话存活期间残留。
    // solo 没有 /result 契约，mode==='solo' 时绝不导航。
    if (s.mode === 'solo') return;
    if (s.phase !== 'won' && s.phase !== 'drawn') return;
    navigatedFor.current = lastWriteAt;
    router.replace('/result');
  }, [lastWriteAt, router]);

  return <>{children}</>;
}
