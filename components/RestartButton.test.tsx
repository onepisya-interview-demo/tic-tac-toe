import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RestartButton } from './RestartButton';
import { useGameStore } from '@/lib/store';

beforeEach(() => {
  // Pretend the player is mid-game so restart() actually mutates state.
  useGameStore.setState({
    phase: 'playing',
    board: [
      'X', null, null,
      null, null, null,
      null, null, null,
    ] as unknown as ReturnType<typeof useGameStore.getState>['board'],
    currentPlayer: 'X',
    winner: null,
    winLine: null,
  });
});

afterEach(() => {
  cleanup();
  useGameStore.getState().__resetInternalForTests();
  useGameStore.setState({
    phase: 'idle',
    board: [
      null, null, null,
      null, null, null,
      null, null, null,
    ] as unknown as ReturnType<typeof useGameStore.getState>['board'],
    currentPlayer: null,
    winner: null,
    winLine: null,
  });
});

describe('components/RestartButton', () => {
  it('renders a 重新开局 button with data-testid="restart"', () => {
    render(<RestartButton />);
    const btn = screen.getByTestId('restart');
    expect(btn).toHaveTextContent('重新开局');
  });

  it('clicking the button calls store.restart() — phase resets to idle, board cleared', async () => {
    const user = userEvent.setup();
    expect(useGameStore.getState().phase).toBe('playing');
    render(<RestartButton />);
    await user.click(screen.getByTestId('restart'));
    const s = useGameStore.getState();
    expect(s.phase).toBe('idle');
    expect(s.board.every((c) => c === null)).toBe(true);
    expect(s.currentPlayer).toBeNull();
    expect(s.winner).toBeNull();
    expect(s.winLine).toBeNull();
  });

  it('restart does not mutate roomName (per-architecture: mode switch is roomName-only, not via restart)', async () => {
    const user = userEvent.setup();
    useGameStore.getState().setRoomName('alice');
    render(<RestartButton />);
    await user.click(screen.getByTestId('restart'));
    // restart must NOT clear the room name — only reset() / setRoomName(null) does.
    expect(useGameStore.getState().roomName).toBe('alice');
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBe('alice');
  });
});
