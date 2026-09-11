import { describe, it, expect, vi, afterEach } from 'vitest';
import { useGameStore } from '@/lib/store';
import { createEmptyBoard, emptyStats, type Board, type GameStats } from '@/lib/game';
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

/**
 * Mock fetch that simulates what AbortController.abort() looks like to
 * the store: the fetch promise rejects with DOMException('aborted',
 * 'TimeoutError'). The store's apiPutStats / apiDeleteStats catch that
 * and surface { ok: false, reason: 'aborted' }, so callers like
 * makeMove / resetAll keep the same invariant — local UI state stays
 * correct — without an 8 s wait per case.
 *
 * This is a real-timer test (per commit 7 lore Directive): no fake
 * timers, no setTimeout gymnastics. We mock the fetch outcome that
 * abort fires after the timer expires, which is what the store
 * actually sees.
 */
function mockFetchWithAbort(): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : (input as URL).toString();
    calls.push({ url, init });
    throw new DOMException('aborted', 'TimeoutError');
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
    lastOutcome: null,
  });
  useGameStore.getState().__resetInternalForTests();
}

function seedInternalStats(stats: GameStats): void {
  useGameStore.getState().setInitialStats(stats);
}

describe('lib/store (zustand game store)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(playSound).mockClear();
    resetStore();
  });

  it('startGame transitions to playing with a random first player', () => {
    useGameStore.getState().startGame();
    const s = useGameStore.getState();
    expect(s.phase).toBe('playing');
    expect(['X', 'O']).toContain(s.currentPlayer);
    expect(s.board).toEqual(createEmptyBoard());
  });

  it('startGame does not hit the network after RSC owns stats', () => {
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().startGame();
    expect(calls).toHaveLength(0);
    restore();
  });

  it('setInitialStats seeds the internal cache used by makeMove', () => {
    seedInternalStats({
      totalGames: 5,
      xWins: 3,
      oWins: 1,
      draws: 1,
      currentStreak: 2,
    });
    // Internal cache is closure-private; verified indirectly via the PUT body
    // on the next winning move.
    const { calls, restore } = mockFetch([{ status: 200, body: {} }]);
    const board: Board = [
      'X', null, null,
      null, 'X', null,
      null, null, null,
    ];
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: board as unknown as Board,
    });
    useGameStore.getState().makeMove(8);
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(calls).toHaveLength(1);
        expect(JSON.parse(String(calls[0].init?.body))).toEqual({
          totalGames: 6,
          xWins: 4,
          oWins: 1,
          draws: 1,
          currentStreak: 3,
        });
        restore();
        resolve();
      }, 10);
    });
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
    const { calls, restore } = mockFetch([{ status: 200, body: emptyStats() }]);
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
    });
    seedInternalStats(emptyStats());
    useGameStore.getState().makeMove(8);
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(s.winner).toBe('X');
    expect(s.winLine).toEqual([0, 4, 8]);
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
    });
    seedInternalStats(emptyStats());
    expect(() => useGameStore.getState().makeMove(8)).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
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
    });
    seedInternalStats(emptyStats());
    useGameStore.getState().makeMove(8);
    expect(vi.mocked(playSound)).toHaveBeenCalledWith('win');
    await vi.advanceTimersByTimeAsync(360);
    expect(vi.mocked(playSound)).toHaveBeenCalledWith('cheer');
    await vi.runOnlyPendingTimersAsync();
    restore();
    vi.useRealTimers();
  });

  it('makeMove that fills the board sets phase=drawn and bumps draws via PUT', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: emptyStats() }]);
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
    });
    seedInternalStats(emptyStats());
    useGameStore.getState().makeMove(8);
    const s = useGameStore.getState();
    expect(s.phase).toBe('drawn');
    expect(s.lastOutcome).toBe('draw');
    expect(vi.mocked(playSound)).toHaveBeenCalledWith('draw');
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(1);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      totalGames: 1,
      xWins: 0,
      oWins: 0,
      draws: 1,
      currentStreak: 0,
    });
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

  it('restart resets the game state (no stats side-effect)', () => {
    useGameStore.setState({
      phase: 'won',
      currentPlayer: null,
      winner: 'X',
      winLine: [0, 1, 2],
      lastOutcome: 'X',
    });
    seedInternalStats({
      totalGames: 1,
      xWins: 1,
      oWins: 0,
      draws: 0,
      currentStreak: 1,
    });
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().restart();
    const s = useGameStore.getState();
    expect(s.phase).toBe('idle');
    expect(s.winner).toBeNull();
    // restart must not hit the network — stats are RSC-owned now
    expect(calls).toHaveLength(0);
    restore();
  });

  it('resetAll calls DELETE and zeroes the internal cache', async () => {
    const zero = emptyStats();
    const { calls, restore } = mockFetch([
      { status: 200, body: zero },
    ]);
    seedInternalStats({
      totalGames: 3,
      xWins: 2,
      oWins: 1,
      draws: 0,
      currentStreak: 1,
    });
    useGameStore.getState().resetAll();
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/stats');
    expect(calls[0].init?.method).toBe('DELETE');
    // Next move uses zero baseline
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: [
        'X', null, null,
        null, 'X', null,
        null, null, null,
      ] as unknown as Board,
    });
    const { calls: calls2, restore: restore2 } = mockFetch([{ status: 200, body: {} }]);
    useGameStore.getState().makeMove(8);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls2).toHaveLength(1);
    expect(JSON.parse(String(calls2[0].init?.body))).toEqual({
      totalGames: 1,
      xWins: 1,
      oWins: 0,
      draws: 0,
      currentStreak: 1,
    });
    restore();
    restore2();
  });

  it('resetAll still updates internal cache to empty on network error', async () => {
    const { calls, restore } = mockFetch([{ status: 500, body: {} }]);
    seedInternalStats({
      totalGames: 3,
      xWins: 2,
      oWins: 1,
      draws: 0,
      currentStreak: 1,
    });
    useGameStore.getState().resetAll();
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(1);
    // Next PUT body should be computed from emptyStats() fallback
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: [
        'X', null, null,
        null, 'X', null,
        null, null, null,
      ] as unknown as Board,
    });
    const { calls: calls2, restore: restore2 } = mockFetch([{ status: 200, body: {} }]);
    useGameStore.getState().makeMove(8);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls2).toHaveLength(1);
    expect(JSON.parse(String(calls2[0].init?.body))).toEqual({
      totalGames: 1,
      xWins: 1,
      oWins: 0,
      draws: 0,
      currentStreak: 1,
    });
    restore();
    restore2();
  });

  // ── commit 7: AbortController.timeout abort cases ──
  // Each case asserts that the store does NOT throw, the local UI
  // state remains correct, and exactly one outbound PUT/DELETE was
  // attempted (the abort fires AFTER fetch has been invoked).

  it('makeMove win: PUT abort keeps local winner + does not throw', async () => {
    const { calls, restore } = mockFetchWithAbort();
    const board: Board = [
      'X', null, null,
      null, 'X', null,
      null, null, null,
    ];
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: board as unknown as Board,
    });
    seedInternalStats({
      totalGames: 5,
      xWins: 3,
      oWins: 1,
      draws: 1,
      currentStreak: 2,
    });
    expect(() => useGameStore.getState().makeMove(8)).not.toThrow();
    // Let the awaited PUT settle; if the catch path leaked a throw
    // it would surface as an unhandled rejection.
    await new Promise((r) => setTimeout(r, 10));
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(s.winner).toBe('X');
    expect(s.winLine).toEqual([0, 4, 8]);
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.method).toBe('PUT');
    restore();
  });

  it('makeMove draw: PUT abort keeps local drawn phase + does not throw', async () => {
    const { calls, restore } = mockFetchWithAbort();
    const board: Board = [
      'X', 'O', 'X',
      'X', 'O', 'O',
      'O', 'X', null,
    ];
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: board as unknown as Board,
    });
    seedInternalStats({
      totalGames: 4,
      xWins: 2,
      oWins: 1,
      draws: 1,
      currentStreak: -1,
    });
    expect(() => useGameStore.getState().makeMove(8)).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    const s = useGameStore.getState();
    expect(s.phase).toBe('drawn');
    expect(s.lastOutcome).toBe('draw');
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.method).toBe('PUT');
    restore();
  });

  it('resetAll: DELETE abort falls back to emptyStats()', async () => {
    const { calls, restore } = mockFetchWithAbort();
    seedInternalStats({
      totalGames: 3,
      xWins: 2,
      oWins: 1,
      draws: 0,
      currentStreak: 1,
    });
    expect(() => useGameStore.getState().resetAll()).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.method).toBe('DELETE');
    // Internal cache should be emptyStats() — verified indirectly by
    // observing the next PUT body, same pattern as the existing
    // "resetAll still updates internal cache to empty on network
    // error" test.
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: [
        'X', null, null,
        null, 'X', null,
        null, null, null,
      ] as unknown as Board,
    });
    const { calls: calls2, restore: restore2 } = mockFetch([{ status: 200, body: {} }]);
    useGameStore.getState().makeMove(8);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls2).toHaveLength(1);
    expect(JSON.parse(String(calls2[0].init?.body))).toEqual({
      totalGames: 1,
      xWins: 1,
      oWins: 0,
      draws: 0,
      currentStreak: 1,
    });
    restore();
    restore2();
  });

  it('makeMove win: non-abort 200 still PUTs and stamps lastWriteAt (regression baseline)', async () => {
    const { calls, restore } = mockFetch([{ status: 200, body: emptyStats() }]);
    const board: Board = [
      'X', null, null,
      null, 'X', null,
      null, null, null,
    ];
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: board as unknown as Board,
    });
    seedInternalStats(emptyStats());
    expect(() => useGameStore.getState().makeMove(8)).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    // lastWriteAt is the timestamp set by the makeMove win branch AFTER
    // the await of apiPutStats resolves — i.e. it confirms the abort-
    // aware store still completes the post-write stamp on the happy
    // path. We don't compare to a `before` value because Date.now() can
    // repeat within the same ms in jsdom, making the comparison brittle.
    expect(s.lastWriteAt).not.toBeNull();
    expect(typeof s.lastWriteAt).toBe('number');
    expect(calls).toHaveLength(1);
    expect(calls[0].init?.method).toBe('PUT');
    restore();
  });
});
