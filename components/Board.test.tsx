import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Board } from './Board';
import { useGameStore } from '@/lib/store';
import { createEmptyBoard, emptyStats } from '@/lib/game';

vi.mock('@/lib/sound', () => ({
  playSound: vi.fn(),
}));

function setPlaying() {
  useGameStore.setState({
    phase: 'playing',
    board: createEmptyBoard(),
    winLine: null,
    currentPlayer: 'X',
  });
}

function mockFetchOk() {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(
      async () =>
        new Response(JSON.stringify({ stats: emptyStats() }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useGameStore.setState({
    phase: 'idle',
    board: createEmptyBoard(),
    winLine: null,
    currentPlayer: null,
  });
  useGameStore.getState().__resetInternalForTests();
});

describe('Board keyboard handling during play', () => {
  it('does not hijack Enter on a non-cell control: its native click fires and no piece is placed', async () => {
    const fetchMock = mockFetchOk();
    setPlaying();
    const dummyClick = vi.fn();
    render(
      <>
        <Board />
        <button type="button" data-testid="dummy" onClick={dummyClick}>
          dummy
        </button>
      </>,
    );
    screen.getByTestId('dummy').focus();
    await userEvent.keyboard('{Enter}');
    expect(dummyClick).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().board.every((c) => c === null)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not hijack Space on a non-cell control either', async () => {
    mockFetchOk();
    setPlaying();
    const dummyClick = vi.fn();
    render(
      <>
        <Board />
        <button type="button" data-testid="dummy" onClick={dummyClick}>
          dummy
        </button>
      </>,
    );
    screen.getByTestId('dummy').focus();
    await userEvent.keyboard('{ }');
    expect(dummyClick).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().board.every((c) => c === null)).toBe(true);
  });

  it('still places a mark via Enter on the focused cell (roving focus contract)', async () => {
    mockFetchOk();
    setPlaying();
    render(<Board />);
    screen.getByTestId('cell-0').focus();
    await userEvent.keyboard('{Enter}');
    expect(useGameStore.getState().board[0]).toBe('X');
  });
});

describe('components/Board (W-T blind spots: arrow keys + neighbors)', () => {
  it('ArrowRight moves focus from cell-0 to cell-1', async () => {
    mockFetchOk();
    setPlaying();
    render(<Board />);
    screen.getByTestId('cell-0').focus();
    await userEvent.keyboard('{ArrowRight}');
    // The roving-focus effect uses queueMicrotask to defer .focus() — wait
    // for the next microtask.
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(screen.getByTestId('cell-1'));
  });

  it('ArrowLeft wraps from cell-0 to cell-2 (negative dx + 3 mod 3)', async () => {
    mockFetchOk();
    setPlaying();
    render(<Board />);
    screen.getByTestId('cell-0').focus();
    await userEvent.keyboard('{ArrowLeft}');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(screen.getByTestId('cell-2'));
  });

  it('ArrowDown from cell-0 lands on cell-3 (next row)', async () => {
    mockFetchOk();
    setPlaying();
    render(<Board />);
    screen.getByTestId('cell-0').focus();
    await userEvent.keyboard('{ArrowDown}');
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(screen.getByTestId('cell-3'));
  });

  it('ArrowDown from cell-3 lands on cell-6 (next row) (roving focus contract)', async () => {
    mockFetchOk();
    setPlaying();
    render(<Board />);
    // Start at cell-0 (firstEmpty = autoFocused). Press ArrowRight twice to
    // build the override state to cell-2; press ArrowDown once → cell-5
    // (row 1, col 2). Sanity: cell-5 = ROW_OFFSETS[5] = [1, 2].
    screen.getByTestId('cell-0').focus();
    await userEvent.keyboard('{ArrowRight}');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    await userEvent.keyboard('{ArrowRight}');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(screen.getByTestId('cell-2'));
    await userEvent.keyboard('{ArrowDown}');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(screen.getByTestId('cell-5'));
  });

  it('ArrowUp wraps within the same column (cell-5 → cell-2)', async () => {
    mockFetchOk();
    setPlaying();
    render(<Board />);
    screen.getByTestId('cell-0').focus();
    // cell-0 → ArrowRight → cell-1; ArrowRight → cell-2; ArrowDown → cell-5;
    // ArrowUp should wrap to cell-2 (same column, previous row).
    await userEvent.keyboard('{ArrowRight}');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    await userEvent.keyboard('{ArrowRight}');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    await userEvent.keyboard('{ArrowDown}');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(screen.getByTestId('cell-5'));
    await userEvent.keyboard('{ArrowUp}');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).toBe(screen.getByTestId('cell-2'));
  });

  it('Enter on the focused cell places a mark (covered in base test) but does NOT place on a non-cell control', async () => {
    // Coverage for the "non-board control" branch when the target IS a button
    // outside the board (e.g. a header button). The onOtherControl guard must
    // permit the native click.
    const fetchMock = mockFetchOk();
    setPlaying();
    const dummyClick = vi.fn();
    render(
      <>
        <Board />
        <button type="button" data-testid="outside-btn" onClick={dummyClick}>
          outside
        </button>
      </>,
    );
    screen.getByTestId('outside-btn').focus();
    await userEvent.keyboard('{Enter}');
    expect(dummyClick).toHaveBeenCalledTimes(1);
    expect(useGameStore.getState().board.every((c) => c === null)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('INPUT element as target: keyboard handler returns early (no preventDefault, no hijack)', async () => {
    mockFetchOk();
    setPlaying();
    render(
      <>
        <Board />
        <input type="text" data-testid="dummy-input" />
      </>,
    );
    const input = screen.getByTestId('dummy-input');
    input.focus();
    // Pressing keys while an input is targeted must not be hijacked by the
    // board's roving-focus handler. The "if (target && target.tagName === 'INPUT') return"
    // guard fires.
    await userEvent.keyboard('{ArrowRight}');
    await new Promise((r) => setTimeout(r, 0));
    // focus stays on the input, board didn't move focus.
    expect(document.activeElement).toBe(input);
  });

  it('phase !== "playing": keyboard handler does NOT register', async () => {
    mockFetchOk();
    useGameStore.setState({
      phase: 'idle',
      board: [
        null, null, null,
        null, null, null,
        null, null, null,
      ],
      winLine: null,
      currentPlayer: null,
    });
    render(<Board />);
    // No keyboard handler is bound — arrows must not move focus.
    await userEvent.keyboard('{ArrowRight}');
    await new Promise((r) => setTimeout(r, 0));
    // No cell-* received focus (none of them are focused; focus stays on body).
    expect(document.activeElement?.tagName).not.toBe('BUTTON');
  });
});

describe('components/Board (W-T: filled-board + non-board Enter branch)', () => {
  it('when board is full: autoFocused falls back to 0 (firstEmpty === -1 branch)', () => {
    mockFetchOk();
    const full: ReturnType<typeof createEmptyBoard> = [
      'X', 'O', 'X',
      'X', 'O', 'O',
      'O', 'X', 'X',
    ];
    useGameStore.setState({
      phase: 'playing',
      board: full,
      winLine: null,
      currentPlayer: 'X',
    });
    const { container } = render(<Board />);
    // The 9 cell buttons render (cell-0..cell-3 each get data-testid="cell-N").
    // Other data-testids (cell-N-mark, cell-N-glow) are for filled cells.
    expect(container.querySelectorAll('[data-testid="cell-0"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-testid="cell-8"]')).toHaveLength(1);
    // And every cell button is disabled (filled).
    const cell0 = container.querySelector('[data-testid="cell-0"]') as HTMLButtonElement;
    expect(cell0).toBeDisabled();
  });

});
