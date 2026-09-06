'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { Cell } from './ui/Cell';

const ROW_OFFSETS = [
  [0, 0],
  [0, 1],
  [0, 2],
  [1, 0],
  [1, 1],
  [1, 2],
  [2, 0],
  [2, 1],
  [2, 2],
];

function neighbors(index: number, dx: number, dy: number): number {
  const [r, c] = ROW_OFFSETS[index];
  const nr = (r + dy + 3) % 3;
  const nc = (c + dx + 3) % 3;
  return nr * 3 + nc;
}

export function Board() {
  const board = useGameStore((s) => s.board);
  const phase = useGameStore((s) => s.phase);
  const winLine = useGameStore((s) => s.winLine);
  const makeMove = useGameStore((s) => s.makeMove);

  const autoFocused = useMemo(() => {
    const firstEmpty = board.findIndex((v) => v === null);
    return firstEmpty === -1 ? 0 : firstEmpty;
  }, [board]);
  const boardKey = board.join('');
  const [override, setOverride] = useState<{ index: number; key: string } | null>(null);
  const focused = override && override.key === boardKey ? override.index : autoFocused;

  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT') return;
      const directions: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      };
      const dir = directions[event.key];
      if (dir) {
        event.preventDefault();
        setOverride((prev) => {
          const base = prev && prev.key === boardKey ? prev.index : autoFocused;
          const next = neighbors(base, dir[1], dir[0]);
          queueMicrotask(() => {
            const node = document.querySelector<HTMLButtonElement>(
              `[data-testid="cell-${next}"]`,
            );
            node?.focus();
          });
          return { index: next, key: boardKey };
        });
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        const cur = focused;
        const cell = board[cur];
        if (cell === null) {
          event.preventDefault();
          makeMove(cur);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [autoFocused, board, boardKey, focused, makeMove, phase]);

  const winningSet = useMemo(() => new Set(winLine ?? []), [winLine]);

  return (
    <div
      className={'grid grid-cols-3 gap-2 w-fit mx-auto relative' + (phase === 'drawn' ? ' draw-shake' : '')}
      role="grid"
      aria-label="井字棋棋盘"
      data-testid="board"
    >
      {board.map((value, i) => (
        <Cell
          key={i}
          index={i}
          value={value}
          onClick={() => makeMove(i)}
          disabled={phase !== 'playing'}
          isWinning={winningSet.has(i)}
          tabIndex={i === focused && phase === 'playing' ? 0 : -1}
        />
      ))}
    </div>
  );
}
