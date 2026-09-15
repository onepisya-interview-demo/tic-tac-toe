import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { act } from 'react';
import { SoloStatsPanel } from './SoloStatsPanel';
import { useGameStore } from '@/lib/store';
import { SOLO_STATS_KEY } from '@/lib/solo-stats';

// SoloStatsPanel embeds ResetStatsButton (local scope), which pulls
// useRouter at module scope — provide a stub router for jsdom.
const refreshMock = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

function seedSoloStats(row: Record<string, number>): void {
  window.localStorage.setItem(SOLO_STATS_KEY, JSON.stringify(row));
}

function panelValues(): (string | null)[] {
  const panel = screen.getByTestId('solo-stats');
  return Array.from(panel.querySelectorAll('[data-testid="stat-value"]')).map((n) =>
    n.getAttribute('data-value'),
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  useGameStore.setState({ phase: 'idle', currentPlayer: null, winner: null });
  useGameStore.getState().__resetInternalForTests();
  refreshMock.mockClear();
});

describe('components/SoloStatsPanel', () => {
  it('SSR output is emptyStats even when localStorage holds a row (hydration-safe first frame)', () => {
    seedSoloStats({ totalGames: 4, xWins: 3, oWins: 1, draws: 0, currentStreak: 2 });
    const html = renderToString(<SoloStatsPanel />);
    // The server frame must not leak persisted client values — the panel
    // hydrates from localStorage only in a post-mount effect.
    expect(html).toContain('data-value="0"');
    expect(html).not.toContain('data-value="3"');
  });

  it('hydrates the persisted baseline after mount', () => {
    seedSoloStats({ totalGames: 4, xWins: 3, oWins: 1, draws: 0, currentStreak: 2 });
    render(<SoloStatsPanel />);
    expect(panelValues()).toEqual(['4', '3', '1', '0', 'X 连胜 2']);
  });

  it('re-reads localStorage when the phase settles on won/drawn (store persists before render)', () => {
    render(<SoloStatsPanel />);
    expect(panelValues()).toEqual(['0', '0', '0', '0', '—']);

    // Solo settle: the store's solo branch writes localStorage inside
    // makeMove before the phase change renders; simulate that settled
    // state and assert the panel picks up the new row.
    seedSoloStats({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 });
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(panelValues()).toEqual(['1', '1', '0', '0', 'X 连胜 1']);
  });

  it('local clear button empties localStorage and the panel shows zeros without any network write', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    seedSoloStats({ totalGames: 2, xWins: 2, oWins: 0, draws: 0, currentStreak: 2 });
    render(<SoloStatsPanel />);
    expect(panelValues()).toEqual(['2', '2', '0', '0', 'X 连胜 2']);

    // resetSoloStats is gated on mode === 'solo' (F-5.1 defensive
    // guard). Production always reaches this button on /solo where
    // PlayController has already set mode='solo'; the isolated test
    // render does not include PlayController, so mirror that state
    // here. Without this setState the guard fires and the click is a
    // no-op — exactly the regression the guard is designed to prevent
    // in real code paths.
    act(() => {
      useGameStore.setState({ mode: 'solo' });
    });

    await user.click(screen.getByTestId('reset-solo-stats'));

    expect(window.localStorage.getItem(SOLO_STATS_KEY)).toBeNull();
    expect(panelValues()).toEqual(['0', '0', '0', '0', '—']);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
