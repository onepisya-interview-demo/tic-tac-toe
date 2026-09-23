import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardGrid } from './BoardGrid';
import { createEmptyBoard, type Board, type WinLine } from '@/lib/game';

const TOP_ROW: WinLine = [0, 1, 2];

function makeBoard(entries: Record<number, 'X' | 'O'>): Board {
  const board: Array<'X' | 'O' | null> = [...createEmptyBoard()];
  for (const [i, v] of Object.entries(entries)) board[Number(i)] = v;
  return board as unknown as Board;
}

function renderGrid(overrides: Partial<Parameters<typeof BoardGrid>[0]> = {}) {
  return render(
    <BoardGrid
      board={createEmptyBoard()}
      winLine={null}
      disabled={false}
      focusedIndex={0}
      onCellPlay={() => {}}
      {...overrides}
    />,
  );
}

describe('ui/BoardGrid (pure presentational grid)', () => {
  it('renders the grid container with the QA board testid and all 9 cells', () => {
    renderGrid();
    expect(screen.getByRole('grid', { name: '井字棋棋盘' })).toHaveAttribute('data-testid', 'board');
    for (let i = 0; i < 9; i++) {
      expect(screen.getByTestId(`cell-${i}`)).toBeInTheDocument();
    }
  });

  it('exposes marks under the cell-N-mark testid contract', () => {
    renderGrid({ board: makeBoard({ 0: 'X', 4: 'O' }) });
    expect(screen.getByTestId('cell-0-mark')).toHaveTextContent('X');
    expect(screen.getByTestId('cell-4-mark')).toHaveTextContent('O');
    expect(screen.queryByTestId('cell-1-mark')).not.toBeInTheDocument();
  });

  it('forwards clicks to onCellPlay with the cell index', async () => {
    const onCellPlay = vi.fn();
    renderGrid({ onCellPlay });
    await userEvent.click(screen.getByTestId('cell-4'));
    expect(onCellPlay).toHaveBeenCalledTimes(1);
    expect(onCellPlay).toHaveBeenCalledWith(4);
  });

  it('disables every cell when disabled is true', () => {
    renderGrid({ disabled: true });
    for (let i = 0; i < 9; i++) {
      expect(screen.getByTestId(`cell-${i}`)).toBeDisabled();
    }
  });

  it('flags only the winLine cells as winning', () => {
    renderGrid({ board: makeBoard({ 0: 'X', 1: 'X', 2: 'X' }), winLine: TOP_ROW });
    expect(screen.getByTestId('cell-0-glow')).toBeInTheDocument();
    expect(screen.getByTestId('cell-1-glow')).toBeInTheDocument();
    expect(screen.getByTestId('cell-2-glow')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-3-glow')).not.toBeInTheDocument();
  });

  it('gives roving focus (tabIndex 0) only to focusedIndex while enabled', () => {
    renderGrid({ focusedIndex: 4 });
    expect(screen.getByTestId('cell-4')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('cell-0')).toHaveAttribute('tabindex', '-1');
    expect(screen.getByTestId('cell-8')).toHaveAttribute('tabindex', '-1');
  });

  it('collapses roving focus to tabIndex -1 everywhere when disabled', () => {
    renderGrid({ focusedIndex: 4, disabled: true });
    for (let i = 0; i < 9; i++) {
      expect(screen.getByTestId(`cell-${i}`)).toHaveAttribute('tabindex', '-1');
    }
  });

  it('appends the container className after the base grid classes', () => {
    renderGrid({ className: 'draw-shake' });
    expect(screen.getByTestId('board').className).toContain('grid grid-cols-3');
    expect(screen.getByTestId('board').className).toContain('draw-shake');
  });
});
