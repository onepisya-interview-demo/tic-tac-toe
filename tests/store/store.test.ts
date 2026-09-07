import { describe, it, expect, vi, afterEach } from 'vitest';
import { useGameStore } from '@/lib/store';
import { createEmptyBoard, emptyStats, type Board } from '@/lib/game';
import { playSound } from '@/lib/sound';

vi.mock('@/lib/sound', () => ({
  playSound: vi.fn(),
}));

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function mockFetch(responses: Array<{
  status?: number;
  body?: unknown;
  ok?: boolean;
}>): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  let i = 0;
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    calls.push({ url, init });
    const r = responses[i] ?? responses[responses.length - 1] ?? { status: 200, body: {} };
    i++;
    return new Response(JSON.stringify(r.body ?? {}), {
      status: r.status ?? (r.ok === false ? 500 : 200),
      headers: { 'content-type': 'application/json' },
    });
  });
  return { calls, restore: () => fetchMock.mockRestore() };
}

function resetStore(): void {
  useGameStore.setState({
    phase: 'idle',
    board: createEmptyBoard(),
    currentPlayer: null,
    winner: null,
    winLine: null,
    stats: emptyStats(),
    lastOutcome: null,
  });
}

describe('lib/store (zustand game store)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(playSound).mockClear();
    resetStore();
  });

  it('startGame transitions to playing with a random first player', async () => {
    const { restore } = mockFetch([
      { status: 200, body: emptyStats() },
    ]);
    useGameStore.getState().startGame();
    // startGame triggers an async GET; wait one tick.
    await new Promise((r) => setTimeout(r, 10));
    const s = useGameStore.getState();
    expect(s.phase).toBe('playing');
    expect(['X', 'O']).toContain(s.currentPlayer);
    expect(s.board).toEqual(createEmptyBoard());
    restore();
  });

  it('startGame still starts with zero stats when stats GET fails', async () => {
    const { calls, restore } = mockFetch([{ status: 500, body: {} }]);
    useGameStore.setState({
      stats: { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 },
    });
    useGameStore.getState().startGame();
    await new Promise((r) => setTimeout(r, 10));
    const s = useGameStore.getState();
    expect(s.phase).toBe('playing');
    expect(['X', 'O']).toContain(s.currentPlayer);
    expect(s.stats).toEqual(emptyStats());
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/stats');
    restore();
  });

  it('hydrateStats fetches and stores remote stats', async () => {
    const remote = {
      totalGames: 4,
      xWins: 2,
      oWins: 1,
      draws: 1,
      currentStreak: 2,
    };
    const { calls, restore } = mockFetch([{ status: 200, body: remote }]);
    useGameStore.getState().hydrateStats();
    await new Promise((r) => setTimeout(r, 10));
    expect(useGameStore.getState().stats).toEqual(remote);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/stats');
    expect(calls[0].init).toEqual({ cache: 'no-store' });
    restore();
  });

  it('hydrateStats falls back to zero stats on network error', async () => {
    const { restore } = mockFetch([{ status: 500 }]);
    useGameStore.setState({
      stats: { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 },
    });
    useGameStore.getState().hydrateStats();
    await new Promise((r) => setTimeout(r, 10));
    expect(useGameStore.getState().stats).toEqual(emptyStats());
    restore();
  });

  it('makeMove applies a move and toggles currentPlayer', () => {
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: createEmptyBoard(),
    });
    useGameStore.getState().makeMove(4);
    const s = useGameStore.getState();
    expect(s.board[4]).toBe('X');
    expect(s.currentPlayer).toBe('O');
    expect(s.phase).toBe('playing');
  });

  it('makeMove on occupied cell is a no-op', () => {
    const board: Board = [
      'X', null, null,
      null, null, null,
      null, null, null,
    ];
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'O',
      board: board as unknown as Board,
    });
    useGameStore.getState().makeMove(0);
    const s = useGameStore.getState();
    expect(s.board).toEqual(board as unknown as Board);
    expect(s.currentPlayer).toBe('O');
  });

  it('makeMove on non-playing phase is a no-op', () => {
    useGameStore.setState({
      phase: 'idle',
      currentPlayer: null,
      board: createEmptyBoard(),
    });
    useGameStore.getState().makeMove(0);
    expect(useGameStore.getState().board[0]).toBeNull();
  });

  it('makeMove ignores a move while the game is idle', () => {
    useGameStore.setState({
      phase: 'idle',
      currentPlayer: 'X',
      board: createEmptyBoard(),
    });
    useGameStore.getState().makeMove(0);
    const s = useGameStore.getState();
    expect(s.board[0]).toBeNull();
    expect(s.currentPlayer).toBe('X');
  });

  it('makeMove ignores a move when no player is active', () => {
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: null,
      board: createEmptyBoard(),
    });
    useGameStore.getState().makeMove(0);
    expect(useGameStore.getState().board[0]).toBeNull();
  });

  it('makeMove ending the game sets phase=won and PUTs new stats', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: emptyStats() }, // not used directly here
    ]);
    // X at 0,4,8 wins diagonal.
    const board: Board = [
      'X', null, null,
      null, 'X', null,
      null, null, null,
    ];
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: board as unknown as Board,
      stats: emptyStats(),
    });
    useGameStore.getState().makeMove(8);
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(s.winner).toBe('X');
    expect(s.winLine).toEqual([0, 4, 8]);
    expect(s.stats.xWins).toBe(1);
    expect(s.stats.totalGames).toBe(1);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/stats');
    expect(calls[0].init?.method).toBe('PUT');
    expect(calls[0].init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      totalGames: 1,
      xWins: 1,
      oWins: 0,
      draws: 0,
      currentStreak: 1,
    });
    restore();
  });

  it('keeps a finished local result when stats PUT fails', async () => {
    const { restore } = mockFetch([{ status: 500, body: {} }]);
    const board: Board = [
      'X', null, null,
      null, 'X', null,
      null, null, null,
    ];
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: board as unknown as Board,
      stats: emptyStats(),
    });
    expect(() => useGameStore.getState().makeMove(8)).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(s.stats.xWins).toBe(1);
    restore();
  });

  it('plays the two-layer win celebration exactly once', async () => {
    vi.useFakeTimers();
    const { restore } = mockFetch([{ status: 200, body: emptyStats() }]);
    const board: Board = [
      'O', null, null,
      null, 'O', null,
      null, null, null,
    ];
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'O',
      board: board as unknown as Board,
      stats: emptyStats(),
    });
    useGameStore.getState().makeMove(8);
    expect(vi.mocked(playSound)).toHaveBeenCalledWith('win');
    await vi.advanceTimersByTimeAsync(360);
    expect(vi.mocked(playSound)).toHaveBeenCalledWith('cheer');
    await vi.runOnlyPendingTimersAsync();
    restore();
    vi.useRealTimers();
  });

  it('makeMove that fills the board sets phase=drawn and bumps draws', async () => {
    const { restore } = mockFetch([{ status: 200, body: emptyStats() }]);
    // Board with 8 filled; X to play 8 to draw. (Every win line has at least one O.)
    const board: Board = [
      'X', 'O', 'X',
      'X', 'O', 'O',
      'O', 'X', null,
    ];
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: board as unknown as Board,
      stats: emptyStats(),
    });
    useGameStore.getState().makeMove(8);
    const s = useGameStore.getState();
    expect(s.phase).toBe('drawn');
    expect(s.lastOutcome).toBe('draw');
    expect(s.stats.draws).toBe(1);
    expect(s.stats.totalGames).toBe(1);
    expect(vi.mocked(playSound)).toHaveBeenCalledWith('draw');
    restore();
  });

  it('plays a sound for an ordinary move', () => {
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: createEmptyBoard(),
    });
    useGameStore.getState().makeMove(0);
    expect(vi.mocked(playSound)).toHaveBeenCalledWith('move');
  });

  it('restart resets the game but keeps stats', () => {
    useGameStore.setState({
      phase: 'won',
      currentPlayer: null,
      winner: 'X',
      winLine: [0, 1, 2],
      lastOutcome: 'X',
      stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 },
    });
    useGameStore.getState().restart();
    const s = useGameStore.getState();
    expect(s.phase).toBe('idle');
    expect(s.winner).toBeNull();
    expect(s.stats.totalGames).toBe(1);
  });

  it('resetAll calls DELETE and replaces stats with zeros', async () => {
    const zero = emptyStats();
    const { calls, restore } = mockFetch([
      { status: 200, body: zero },
    ]);
    useGameStore.setState({
      stats: { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 },
    });
    useGameStore.getState().resetAll();
    await new Promise((r) => setTimeout(r, 10));
    expect(useGameStore.getState().stats).toEqual(zero);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/stats');
    expect(calls[0].init?.method).toBe('DELETE');
    restore();
  });

  it('resetAll falls back to empty stats on network error', async () => {
    const { restore } = mockFetch([{ status: 500, body: {} }]);
    useGameStore.setState({
      stats: { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 },
    });
    useGameStore.getState().resetAll();
    await new Promise((r) => setTimeout(r, 10));
    expect(useGameStore.getState().stats).toEqual(emptyStats());
    restore();
  });

});
