import type { Board, WinLine } from '@/lib/game';
import { Cell } from './Cell';

type Props = {
  board: Board;
  winLine: WinLine | null;
  disabled: boolean;
  focusedIndex: number;
  onCellPlay: (index: number) => void;
  /**
   * Extra classes for the grid container. The draw-shake visual contract
   * (app/globals.css, phase === 'drawn') is owned by the client adapter
   * (Board), which knows the phase; the grid itself stays phase-agnostic.
   */
  className?: string;
};

/**
 * Pure presentational 3x3 grid — no hooks, no store, no browser APIs, so
 * it renders identically on the server and in tests. Owns the QA testid
 * contract (board / cell-N / cell-N-mark) and derives everything visual
 * from props alone. Store wiring, roving focus and keyboard handling live
 * in the client adapter (components/Board.tsx), mirroring the
 * StatusBar / StatusBarClient split.
 */
export function BoardGrid({
  board,
  winLine,
  disabled,
  focusedIndex,
  onCellPlay,
  className = '',
}: Props) {
  // Recomputed per render instead of useMemo: a 9-element Set is free and
  // keeping this hook-free is what makes the component server-compatible.
  const winningSet = new Set(winLine ?? []);

  return (
    <div
      className={'grid grid-cols-3 gap-2 w-fit mx-auto relative' + (className ? ` ${className}` : '')}
      role="grid"
      aria-label="井字棋棋盘"
      data-testid="board"
    >
      {board.map((value, i) => (
        <Cell
          key={i}
          index={i}
          value={value}
          onClick={() => onCellPlay(i)}
          disabled={disabled}
          isWinning={winningSet.has(i)}
          tabIndex={i === focusedIndex && !disabled ? 0 : -1}
        />
      ))}
    </div>
  );
}
