import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetStatsButton } from './ResetStatsButton';
import { useGameStore } from '@/lib/store';
import { emptyStats } from '@/lib/game';
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

describe('components/ResetStatsButton scope=local', () => {
  it('clears only the solo localStorage row: no fetch, no router.refresh, onCleared fires', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => new Response('{}', { status: 200 }));
    const onCleared = vi.fn();
    window.localStorage.setItem(
      SOLO_STATS_KEY,
      JSON.stringify({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 }),
    );

    // resetSoloStats is gated on mode === 'solo' (F-5.1 defensive
    // guard). In production the local-scope button only renders on
    // /solo where PlayController has set mode='solo'; the isolated
    // test render does not include PlayController, so mirror that
    // state here. Without this setState the guard fires and the
    // click is a no-op — exactly the regression the guard is designed
    // to prevent in real code paths.
    act(() => {
      useGameStore.setState({ mode: 'solo' });
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
});

describe('components/ResetStatsButton scope=server (default, home contract unchanged)', () => {
  it('keeps testid reset-stats and awaits resetAll before router.refresh + onCleared', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () =>
          new Response(JSON.stringify(emptyStats()), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      );
    const onCleared = vi.fn();

    render(<ResetStatsButton onCleared={onCleared} />);
    const btn = screen.getByTestId('reset-stats');
    expect(btn).toHaveTextContent('重置战绩');

    await user.click(btn);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/stats');
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(onCleared).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });
});
