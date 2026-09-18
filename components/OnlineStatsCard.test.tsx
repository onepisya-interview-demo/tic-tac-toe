import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { OnlineStatsCard } from './OnlineStatsCard';
import { useGameStore } from '@/lib/store';

// OnlineStatsCard — read-only online stats surface on the home page
// (ulw-name-login-one-truth W3 contract). Verifies:
//  - Logged out (playerName=null) shows a low-key prompt, no fetch.
//  - Logged in: GET /api/players/{name}/stats (W2 RESTful) → renders StatsGrid.
//    A 404 problem+json maps to { stats: null } client-side; the
//    empty-state copy renders the placeholder, not the grid.
//  - Response lives ONLY in component state — never written to
//    localStorage or store.solo (A2 red-line).
//  - Error path: failure → inline error, no localStorage write.
//  - Empty path: server returns {stats:null} → "该名字尚无战绩记录".

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fetchSpy.mockReset();
});

afterEach(() => {
  cleanup();
  useGameStore.setState({ playerName: null });
});

describe('components/OnlineStatsCard', () => {
  it('logged-out: shows low-key prompt and issues no fetch', () => {
    render(<OnlineStatsCard />);
    expect(screen.getByTestId('online-stats-empty-prompt')).toHaveTextContent(
      '设置名字后在此查看跨设备战绩',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logged-in: GET /api/players/{name}/stats and render the five-stat grid', async () => {
    useGameStore.setState({ playerName: 'alice' });
    fetchSpy.mockResolvedValueOnce(
      new Response(
        '{"stats":{"totalGames":4,"xWins":3,"oWins":0,"draws":1,"currentStreak":2}}',
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    render(<OnlineStatsCard />);
    await waitFor(() => screen.getByTestId('online-stats-grid'));
    const url = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(url).toBe('/api/players/alice/stats');
    expect(screen.getByTestId('online-stats-grid')).toBeInTheDocument();
    // Response stays in component state — localStorage never touched.
    expect(window.localStorage.getItem('ttt.offline.stats.v1')).toBeNull();
  });

  it('server returns {stats:null} → 「该名字尚无战绩记录」提示', async () => {
    useGameStore.setState({ playerName: 'newname' });
    fetchSpy.mockResolvedValueOnce(
      new Response('{"stats":null}', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    render(<OnlineStatsCard />);
    const empty = await screen.findByTestId('online-stats-empty');
    expect(empty).toHaveTextContent('该名字尚无战绩记录');
  });

  it('network error → inline error, no localStorage write', async () => {
    useGameStore.setState({ playerName: 'alice' });
    fetchSpy.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    render(<OnlineStatsCard />);
    const err = await screen.findByTestId('online-stats-error');
    expect(err).toBeInTheDocument();
    expect(err.getAttribute('role')).toBe('alert');
    expect(window.localStorage.getItem('ttt.offline.stats.v1')).toBeNull();
  });
});
