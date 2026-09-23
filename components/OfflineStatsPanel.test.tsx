import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { act } from 'react';
import { OfflineStatsPanel } from './OfflineStatsPanel';
import { useGameStore } from '@/lib/store';
import { OFFLINE_STATS_KEY } from '@/lib/offline-stats';

import { resetStore } from '@/tests/helpers/reset-store';
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
  resetStore();
  refreshMock.mockClear();
});

function loginAs(name: string): void {
  act(() => {
    useGameStore.setState({ roomName: name });
  });
}

describe('components/OfflineStatsPanel (W5 账本直显——匿名态退役)', () => {
  it('SSR output does not leak persisted client values (hydration-safe first frame)', () => {
    seedOfflineStats({ totalGames: 4, xWins: 3, oWins: 1, draws: 0, currentStreak: 2 });
    const html = renderToString(<OfflineStatsPanel />);
    // W5（ulw-offline-ledger-direct）：匿名卡退役，SSR 不渲染该卡（行为级：用户可见「本机匿名记账中」字样不在 SSR HTML 里）
    expect(html).not.toContain('本机匿名记账中');
    // hydration-safe：SSR 首帧仍是空账本（未挂载前无 localStorage 读），不泄漏持久化数据
    expect(html).not.toContain('data-value="3"');
    expect(html).not.toContain('data-value="4"');
  });

  it('hydrates the persisted baseline after mount (logged-in player)', () => {
    seedOfflineStats({ totalGames: 4, xWins: 3, oWins: 1, draws: 0, currentStreak: 2 });
    loginAs('alice');
    render(<OfflineStatsPanel />);
    expect(panelValues()).toEqual(['4', '3', '1', '0', 'X 连胜 2']);
  });

  it('renders the ledger directly when roomName is empty — no anonymous card (W5 §3 F1)', () => {
    render(<OfflineStatsPanel />);
    // F1：无名挂载 → StatsGrid 在 + offline-stats-anonymous 0 命中
    expect(screen.queryByTestId('offline-stats-anonymous')).toBeNull();
    // screen 查询 stat-value（在 panel 内）断言 StatsGrid 已渲染
    expect(screen.queryAllByTestId('stat-value').length).toBeGreaterThan(0);
    // 数字 = 本机账本（emptyStats 默认零）
    expect(panelValues()).toEqual(['0', '0', '0', '0', '—']);
  });

  it('renders the ledger identically for unnamed and named mounts (W5 §3 F2)', () => {
    seedOfflineStats({ totalGames: 7, xWins: 4, oWins: 2, draws: 1, currentStreak: 2 });
    // 无名挂载：snapshot 面板 DOM + 值
    render(<OfflineStatsPanel />);
    const unnamedMarkup = screen.getByTestId('offline-stats').innerHTML;
    const unnamedValues = panelValues();
    cleanup();
    // 有名挂载：snapshot 面板 DOM + 值
    loginAs('alice');
    render(<OfflineStatsPanel />);
    const namedMarkup = screen.getByTestId('offline-stats').innerHTML;
    const namedValues = panelValues();
    // F2：与 F1 渲染逐字节一致（仅数据不同；此处同名 localStorage 故值也一致）
    expect(namedMarkup).toBe(unnamedMarkup);
    expect(namedValues).toEqual(unnamedValues);
    expect(screen.queryByTestId('offline-stats-anonymous')).toBeNull();
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

  it('panel copy red line — zero 匿名 / 玩家名 / 注册 / 登录 / 未建房间不记 across the whole panel (W5 §3 F5)', () => {
    seedOfflineStats({ totalGames: 5, xWins: 3, oWins: 1, draws: 1, currentStreak: 1 });
    render(<OfflineStatsPanel />);
    const panel = screen.getByTestId('offline-stats');
    // A9 红线（沿用 W4）：整面板用户可见字符串零「玩家名/注册/登录」
    expect(panel.textContent).not.toMatch(/玩家名|注册|登录/);
    // W5 §3 F5：整面板不再有「匿名」「未建房间不记」字样（匿名卡退役）
    expect(panel.textContent).not.toMatch(/匿名|未建房间不记/);
    expect(panel.textContent).not.toContain('本机匿名记账中');
    // 新面板结构：标题「单机战绩」 + StatsGrid 直显
    expect(screen.getByTestId('offline-stats-heading')).toHaveTextContent('单机战绩');
    expect(screen.queryByTestId('offline-stats-anonymous')).toBeNull();
    expect(screen.queryAllByTestId('stat-value').length).toBeGreaterThan(0);
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
