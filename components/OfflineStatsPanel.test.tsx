import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { act } from 'react';
import { OfflineStatsPanel } from './OfflineStatsPanel';
import { useGameStore } from '@/lib/store';
import { OFFLINE_STATS_KEY } from '@/lib/offline-stats';

// OfflineStatsPanel embeds ResetStatsButton (local scope), which pulls
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

function seedOfflineStats(row: Record<string, number>): void {
  window.localStorage.setItem(OFFLINE_STATS_KEY, JSON.stringify(row));
}

function panelValues(): (string | null)[] {
  const panel = screen.getByTestId('offline-stats');
  return Array.from(panel.querySelectorAll('[data-testid="stat-value"]')).map((n) =>
    n.getAttribute('data-value'),
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  useGameStore.setState({
    phase: 'idle',
    currentPlayer: null,
    winner: null,
    roomName: null,
  });
  useGameStore.getState().__resetInternalForTests();
  refreshMock.mockClear();
});

function loginAs(name: string): void {
  act(() => {
    useGameStore.setState({ roomName: name });
  });
}

describe('components/OfflineStatsPanel (W2 房间化)', () => {
  it('SSR output does not leak persisted client values (hydration-safe first frame)', () => {
    seedOfflineStats({ totalGames: 4, xWins: 3, oWins: 1, draws: 0, currentStreak: 2 });
    const html = renderToString(<OfflineStatsPanel />);
    expect(html).toContain('data-testid="offline-stats-anonymous"');
    expect(html).not.toContain('data-value="3"');
    expect(html).not.toContain('data-value="4"');
  });

  it('hydrates the persisted baseline after mount (logged-in player)', () => {
    seedOfflineStats({ totalGames: 4, xWins: 3, oWins: 1, draws: 0, currentStreak: 2 });
    loginAs('alice');
    render(<OfflineStatsPanel />);
    expect(panelValues()).toEqual(['4', '3', '1', '0', 'X 连胜 2']);
  });

  it('shows the "未建房间不记" hint instead of stats grid when roomName is empty (W2 房间化)', () => {
    render(<OfflineStatsPanel />);
    expect(screen.getByTestId('offline-stats-anonymous')).toBeInTheDocument();
    expect(screen.queryByTestId('stat-value')).toBeNull();
    // A9 红线：文案零「玩家名/注册/登录」
    const hint = screen.getByTestId('offline-stats-anonymous');
    expect(hint.textContent).not.toMatch(/玩家名|注册|登录/);
    expect(hint.textContent).toContain('未建房间不记');
  });

  it('mount-only hydration: panel does NOT subscribe to phase changes (single hydration point)', () => {
    loginAs('bob');
    render(<OfflineStatsPanel />);
    expect(panelValues()).toEqual(['0', '0', '0', '0', '—']);

    seedOfflineStats({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 });
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(panelValues()).toEqual(['0', '0', '0', '0', '—']);

    cleanup();
    render(<OfflineStatsPanel />);
    expect(panelValues()).toEqual(['1', '1', '0', '0', 'X 连胜 1']);
  });

  it('local clear button empties localStorage and the panel shows zeros without any network write', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    seedOfflineStats({ totalGames: 2, xWins: 2, oWins: 0, draws: 0, currentStreak: 2 });
    loginAs('carol');
    render(<OfflineStatsPanel />);
    expect(panelValues()).toEqual(['2', '2', '0', '0', 'X 连胜 2']);

    act(() => {
      useGameStore.setState({ mode: 'offline' });
    });

    await user.click(screen.getByTestId('reset-offline-stats'));

    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();
    expect(panelValues()).toEqual(['0', '0', '0', '0', '—']);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('components/OfflineStatsPanel — W3 result actions prop', () => {
  it('renders no actions row when the `actions` prop is omitted (legacy / pure-local mount)', () => {
    loginAs('dan');
    render(<OfflineStatsPanel />);
    expect(screen.queryByTestId('offline-result-actions')).toBeNull();
    expect(screen.queryByTestId('play-again-offline')).toBeNull();
    expect(screen.queryByTestId('back-home-offline')).toBeNull();
  });

  it('renders the actions row when `actions` is provided (stats-view result surface)', () => {
    loginAs('eve');
    render(
      <OfflineStatsPanel
        actions={
          <>
            <button type="button" data-testid="play-again-offline">
              再来一局
            </button>
            <span data-testid="back-home-offline">返回首页</span>
          </>
        }
      />,
    );
    expect(screen.getByTestId('offline-result-actions')).toBeInTheDocument();
    expect(screen.getByTestId('play-again-offline')).toBeInTheDocument();
    expect(screen.getByTestId('back-home-offline')).toBeInTheDocument();
  });

  it('still hydrates from localStorage when actions are provided (result surface is not a re-mount trap)', () => {
    seedOfflineStats({ totalGames: 3, xWins: 2, oWins: 0, draws: 1, currentStreak: 1 });
    loginAs('frank');
    render(
      <OfflineStatsPanel
        actions={<button data-testid="play-again-offline">再来一局</button>}
      />,
    );
    expect(panelValues()).toEqual(["3", "2", "0", "1", "X 连胜 1"]);
    expect(screen.getByTestId('play-again-offline')).toBeInTheDocument();
  });
});
