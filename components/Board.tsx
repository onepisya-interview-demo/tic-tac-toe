'use client';

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '@/lib/store';
import { BoardGrid } from './ui/BoardGrid';

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
      // Enter/Space must stay native on any control that is not a board cell
      // (back-home link, restart button, ...): hijacking them here would
      // preventDefault the click and place a piece instead of activating the
      // control, breaking keyboard exit from the game. Arrows stay global so
      // they always pull focus back into the board.
      const onBoardCell = !!target?.dataset?.testid?.startsWith('cell-');
      const onOtherControl =
        !onBoardCell &&
        target instanceof HTMLElement &&
        target !== document.body &&
        target.closest('button, a, input, textarea, select, [contenteditable="true"]') !== null;
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
      if ((event.key === 'Enter' || event.key === ' ') && !onOtherControl) {
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

  // Rendering is delegated to the pure BoardGrid; this component keeps
  // only the store wiring, roving focus and keyboard logic (the adapter
  // half of the StatusBar/StatusBarClient split).
  return (
    <BoardGrid
      board={board}
      winLine={winLine}
      disabled={phase !== 'playing'}
      focusedIndex={focused}
      onCellPlay={makeMove}
      className={phase === 'drawn' ? 'draw-shake' : ''}
    />
  );
}
