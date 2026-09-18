import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetStatsButton } from './ResetStatsButton';
import { useGameStore } from '@/lib/store';
import { SOLO_STATS_KEY } from '@/lib/solo-stats';
import { act } from 'react';

const refreshMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  refreshMock.mockClear();
  vi.restoreAllMocks();
});

describe('components/ResetStatsButton (W1: only local scope remains)', () => {
  it('scope=local: clears the localStorage row + internal cache, no fetch, onCleared fires', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('{}', { status: 200 }));
    const onCleared = vi.fn();
    window.localStorage.setItem(
      SOLO_STATS_KEY,
      JSON.stringify({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 }),
    );

    // resetOfflineStats is gated on mode === 'offline' (defensive
    // guard). In production the local-scope button only renders on
    // /solo where PlayController has set mode='offline'; the isolated
    // test render does not include PlayController, so mirror that
    // state here.
    act(() => {
      useGameStore.setState({ mode: 'offline' });
    });

    render(<ResetStatsButton scope="local" onCleared={onCleared} />);
    const btn = screen.getByTestId('reset-solo-stats');
    expect(btn).toHaveTextContent('清空战绩');
    expect(btn).toHaveAttribute('aria-label', '清空单机战绩');

    await user.click(btn);

    expect(window.localStorage.getItem(SOLO_STATS_KEY)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    expect(onCleared).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('resetOfflineStats is a no-op when mode is not "offline" (defensive guard)', () => {
    // mode is 'online' after resetStore; resetOfflineStats must be a no-op.
    window.localStorage.setItem(
      SOLO_STATS_KEY,
      JSON.stringify({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 }),
    );
    act(() => {
      useGameStore.setState({ mode: 'online' });
    });
    useGameStore.getState().resetOfflineStats();
    // localStorage unchanged.
    expect(
      window.localStorage.getItem(SOLO_STATS_KEY),
    ).not.toBeNull();
  });
});
