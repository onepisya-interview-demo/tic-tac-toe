import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { WinConfetti } from './WinConfetti';
import { burstConfetti } from '@/lib/confetti';
import { useGameStore } from '@/lib/store';

vi.mock('@/lib/confetti', () => ({
  burstConfetti: vi.fn(),
}));

const burstMock = vi.mocked(burstConfetti);

beforeEach(() => {
  burstMock.mockClear();
});

afterEach(() => {
  cleanup();
  useGameStore.setState({
    phase: 'idle',
    mode: 'online',
    board: [
      null, null, null,
      null, null, null,
      null, null, null,
    ],
    currentPlayer: null,
    winner: null,
    winLine: null,
    roomName: null,
  });
  useGameStore.getState().__resetInternalForTests();
});

describe('components/WinConfetti (offline /offline celebration layer)', () => {
  it('returns null while phase is not "won" (no DOM mount target, no burst)', () => {
    useGameStore.setState({ phase: 'idle' });
    const { container } = render(<WinConfetti />);
    expect(container.firstChild).toBeNull();
    expect(burstMock).not.toHaveBeenCalled();
  });

  it('on phase transition to "won": renders the layer and burstConfetti fires exactly once', () => {
    useGameStore.setState({
      phase: 'won',
      winner: 'X',
      winLine: [0, 1, 2],
      board: [
        'X', 'X', 'X',
        'O', null, null,
        null, null, null,
      ],
    });
    const { container } = render(<WinConfetti />);
    expect(burstMock).toHaveBeenCalledTimes(1);
    const layer = container.querySelector('[data-testid="confetti"]');
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
  });

  it('phase stays "won" but already celebrated: a re-render does NOT re-burst (celebratedRef locks it)', () => {
    useGameStore.setState({ phase: 'won' });
    const { rerender } = render(<WinConfetti />);
    expect(burstMock).toHaveBeenCalledTimes(1);
    // Re-render the same component instance — celebratedRef must stay true.
    rerender(<WinConfetti />);
    expect(burstMock).toHaveBeenCalledTimes(1);
  });

  it('phase transitions won → idle: ref resets so the next win fires a fresh burst', () => {
    useGameStore.setState({ phase: 'won' });
    const { rerender } = render(<WinConfetti />);
    expect(burstMock).toHaveBeenCalledTimes(1);
    // Back to 'idle' (simulating the user pressing Restart after a win) — the
    // ref's reset branch fires (line 53).
    useGameStore.setState({ phase: 'idle' });
    rerender(<WinConfetti />);
    expect(burstMock).toHaveBeenCalledTimes(1); // no burst while idle
    // A new win must fire a fresh burst (ref was reset by the idle branch).
    useGameStore.setState({ phase: 'won' });
    rerender(<WinConfetti />);
    expect(burstMock).toHaveBeenCalledTimes(2);
  });

  it('phase transitions won → playing (e.g. user manually dismisses the win): ref resets', () => {
    useGameStore.setState({ phase: 'won' });
    const { rerender } = render(<WinConfetti />);
    expect(burstMock).toHaveBeenCalledTimes(1);
    useGameStore.setState({ phase: 'playing' });
    rerender(<WinConfetti />);
    expect(burstMock).toHaveBeenCalledTimes(1);
    useGameStore.setState({ phase: 'won' });
    rerender(<WinConfetti />);
    expect(burstMock).toHaveBeenCalledTimes(2);
  });

  it('phase "drawn": no burst, no mount (status-bar announcement is enough)', () => {
    useGameStore.setState({
      phase: 'drawn',
      board: [
        'X', 'O', 'X',
        'X', 'O', 'O',
        'O', 'X', null,
      ],
    });
    const { container } = render(<WinConfetti />);
    expect(container.firstChild).toBeNull();
    expect(burstMock).not.toHaveBeenCalled();
  });
});
