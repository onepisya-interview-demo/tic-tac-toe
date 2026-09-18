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
