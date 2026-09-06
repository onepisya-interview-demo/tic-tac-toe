'use client';

import { useGameStore } from '@/lib/store';
import { Cell } from './ui/Cell';

export function Board() {
  const board = useGameStore((s) => s.board);
  const phase = useGameStore((s) => s.phase);
  const winLine = useGameStore((s) => s.winLine);
  const makeMove = useGameStore((s) => s.makeMove);

  const winningSet = new Set(winLine ?? []);

  return (
    <div
      className="grid grid-cols-3 gap-2 w-fit mx-auto"
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
        />
      ))}
    </div>
  );
}
