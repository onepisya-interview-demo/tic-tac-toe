import { describe, it, expect, vi, afterEach } from 'vitest';
import { NETWORK_TIMEOUT_MS, useGameStore } from '@/lib/store';
import { createEmptyBoard, emptyStats, type Board, type GameStats } from '@/lib/game';
import { SOLO_STATS_KEY, loadSoloStats } from '@/lib/solo-stats';
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
 * 'TimeoutError'). The store's apiRecordOutcome / apiDeleteStats catch
 * that and surface { ok: false, reason: 'aborted' }, so callers like
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
    mode: 'ranked',
    board: createEmptyBoard(),
    currentPlayer: null,
    winner: null,
    winLine: null,
    lastOutcome: null,
    lastWriteAt: null,
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

  it('setInitialStats seeds the cache; the winning move POSTs only the outcome', () => {
    seedInternalStats({
      totalGames: 5,
      xWins: 3,
      oWins: 1,
      draws: 1,
      currentStreak: 2,
    });
    // Internal cache is closure-private and no longer serialized into the
    // request (the server owns the accumulation); the winning move POSTs
    // only the outcome, and the server's { stats } answer would refresh
    // the cache. Seeded values must NOT leak into the payload.
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 6, xWins: 4, oWins: 1, draws: 1, currentStreak: 3 } } },
    ]);
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
        expect(calls[0].url).toBe('/api/stats/outcome');
        expect(calls[0].init?.method).toBe('POST');
        expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'X' });
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

  it('makeMove ending the game sets phase=won and POSTs the outcome', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
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
    });
    seedInternalStats(emptyStats());
    useGameStore.getState().makeMove(8);
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(s.winner).toBe('X');
    expect(s.winLine).toEqual([0, 4, 8]);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/stats/outcome');
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'X' });
    restore();
  });

  it('keeps a finished local result when the outcome POST fails', async () => {
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
    const { restore } = mockFetch([{ status: 200, body: { stats: emptyStats() } }]);
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

  it('makeMove that fills the board sets phase=drawn and POSTs outcome=draw', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 0, oWins: 0, draws: 1, currentStreak: 0 } } },
    ]);
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
    expect(calls[0].url).toBe('/api/stats/outcome');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'draw' });
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
    // Next move reports only the outcome (server owns the accumulation;
    // the post-DELETE baseline lives server-side now).
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: [
        'X', null, null,
        null, 'X', null,
        null, null, null,
      ] as unknown as Board,
    });
    const { calls: calls2, restore: restore2 } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
    ]);
    useGameStore.getState().makeMove(8);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls2).toHaveLength(1);
    expect(calls2[0].url).toBe('/api/stats/outcome');
    expect(calls2[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls2[0].init?.body))).toEqual({ outcome: 'X' });
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
    // resetAll falls back to emptyStats() internally; the next move still
    // only reports the outcome — the fallback is no longer observable in
    // the payload (server-authoritative).
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: [
        'X', null, null,
        null, 'X', null,
        null, null, null,
      ] as unknown as Board,
    });
    const { calls: calls2, restore: restore2 } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
    ]);
    useGameStore.getState().makeMove(8);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls2).toHaveLength(1);
    expect(calls2[0].url).toBe('/api/stats/outcome');
    expect(calls2[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls2[0].init?.body))).toEqual({ outcome: 'X' });
    restore();
    restore2();
  });

  // ── commit 7: AbortController.timeout abort cases ──
  // Each case asserts that the store does NOT throw, the local UI
  // state remains correct, and exactly one outbound PUT/DELETE was
  // attempted (the abort fires AFTER fetch has been invoked).

  it('makeMove win: outcome POST abort keeps local winner + does not throw', async () => {
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
    expect(calls[0].url).toBe('/api/stats/outcome');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'X' });
    restore();
  });

  it('makeMove draw: outcome POST abort keeps local drawn phase + does not throw', async () => {
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
    expect(calls[0].url).toBe('/api/stats/outcome');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'draw' });
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
    // Internal cache should be emptyStats() — same fallback as the
    // "resetAll still updates internal cache to empty on network error"
    // test; the next move still only reports the outcome.
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: [
        'X', null, null,
        null, 'X', null,
        null, null, null,
      ] as unknown as Board,
    });
    const { calls: calls2, restore: restore2 } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
    ]);
    useGameStore.getState().makeMove(8);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls2).toHaveLength(1);
    expect(calls2[0].url).toBe('/api/stats/outcome');
    expect(calls2[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls2[0].init?.body))).toEqual({ outcome: 'X' });
    restore();
    restore2();
  });

  it('makeMove win: non-abort 200 still POSTs and stamps lastWriteAt (regression baseline)', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
    ]);
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
    expect(calls[0].url).toBe('/api/stats/outcome');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'X' });
    restore();
  });

  // ── commit 3: server-authoritative outcome edge cases ──
  // Each case asserts that a failing outcome POST does NOT throw, the
  // local UI state stays correct, the internal cache is NOT bumped
  // (ok:false skips the internalStats write — no public reader exists,
  // so this is enforced by code path, not by a payload assertion),
  // and lastWriteAt still ticks after the request settles.

  it('makeMove win: 500 response does not throw, keeps phase=won, stamps lastWriteAt', async () => {
    const { calls, restore } = mockFetch([{ status: 500, body: {} }]);
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
    await new Promise((r) => setTimeout(r, 10));
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(s.winner).toBe('X');
    expect(s.lastWriteAt).not.toBeNull();
    expect(typeof s.lastWriteAt).toBe('number');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/stats/outcome');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'X' });
    restore();
  });

  it('makeMove win: never-resolving POST aborts via 8s timeout, keeps phase=won, stamps lastWriteAt', async () => {
    vi.useFakeTimers();
    const calls: FetchCall[] = [];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = typeof input === 'string' ? input : (input as URL).toString();
      calls.push({ url, init });
      // Never resolves; rejects only when the store's own 8s
      // AbortController fires — this exercises the REAL withTimeout
      // timer path end to end, not just the catch mapping.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'TimeoutError'));
        });
      });
    });
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
    expect(useGameStore.getState().phase).toBe('won');
    // Fire the store's real AbortController timer; advanceTimersByTimeAsync
    // also flushes the microtask chain so makeMove's promise settles.
    await vi.advanceTimersByTimeAsync(NETWORK_TIMEOUT_MS);
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(s.winner).toBe('X');
    expect(s.lastWriteAt).not.toBeNull();
    expect(typeof s.lastWriteAt).toBe('number');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/stats/outcome');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'X' });
    fetchMock.mockRestore();
    vi.useRealTimers();
  });
});

// ── solo mode: local accumulation + localStorage persistence ──
// Solo is the mirror image of the ranked contract: ZERO network writes,
// outcomes accumulate locally via the pure recordOutcome rule, and the
// row persists to localStorage (lib/solo-stats.ts) so accumulation
// survives reloads. lastWriteAt stays null — it means "a network write
// settled", and solo never writes (this also keeps ranked navigation
// subscribers silent on solo games).

describe('lib/store solo mode (local accumulation + localStorage)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(playSound).mockClear();
    window.localStorage.clear();
    resetStore();
  });

  function soloWinBoard(): Board {
    return [
      'X', null, null,
      null, 'X', null,
      null, null, null,
    ] as unknown as Board;
  }

  async function soloWin(): Promise<void> {
    useGameStore.setState({
      phase: 'playing',
      mode: 'solo',
      currentPlayer: 'X',
      board: soloWinBoard(),
    });
    await useGameStore.getState().makeMove(8);
  }

  it('mode starts as ranked; startGame() defaults to ranked; startGame("solo") switches', () => {
    expect(useGameStore.getState().mode).toBe('ranked');
    useGameStore.getState().startGame();
    expect(useGameStore.getState().mode).toBe('ranked');
    useGameStore.getState().startGame('solo');
    expect(useGameStore.getState().mode).toBe('solo');
    expect(useGameStore.getState().phase).toBe('playing');
  });

  it('startGame("solo") seeds the internal cache from the localStorage baseline (reload semantics)', () => {
    window.localStorage.setItem(
      SOLO_STATS_KEY,
      JSON.stringify({ totalGames: 7, xWins: 5, oWins: 1, draws: 1, currentStreak: 3 }),
    );
    useGameStore.getState().startGame('solo');
    expect(useGameStore.getState().__getInternalForTests()).toEqual({
      totalGames: 7,
      xWins: 5,
      oWins: 1,
      draws: 1,
      currentStreak: 3,
    });
  });

  it('solo win: ZERO network writes, no lastWriteAt stamp, local accumulation + persistence', async () => {
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().startGame('solo');
    await soloWin();
    expect(calls).toHaveLength(0);
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(s.winner).toBe('X');
    expect(s.lastWriteAt).toBeNull();
    const expected = { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 };
    expect(s.__getInternalForTests()).toEqual(expected);
    expect(JSON.parse(window.localStorage.getItem(SOLO_STATS_KEY)!)).toEqual(expected);
    restore();
  });

  it('solo two-win streak accumulates xWins=2 streak=2 across a restart (localStorage round-trip)', async () => {
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().startGame('solo');
    await soloWin();
    // Second session: startGame re-seeds from the persisted baseline,
    // then the win accumulates on top of it.
    useGameStore.getState().startGame('solo');
    await soloWin();
    expect(calls).toHaveLength(0);
    const expected = { totalGames: 2, xWins: 2, oWins: 0, draws: 0, currentStreak: 2 };
    expect(useGameStore.getState().__getInternalForTests()).toEqual(expected);
    expect(JSON.parse(window.localStorage.getItem(SOLO_STATS_KEY)!)).toEqual(expected);
    restore();
  });

  it('solo draw: accumulates draws + resets streak locally, zero network', async () => {
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().startGame('solo');
    useGameStore.setState({
      phase: 'playing',
      mode: 'solo',
      currentPlayer: 'X',
      board: [
        'X', 'O', 'X',
        'X', 'O', 'O',
        'O', 'X', null,
      ] as unknown as Board,
    });
    await useGameStore.getState().makeMove(8);
    expect(calls).toHaveLength(0);
    const s = useGameStore.getState();
    expect(s.phase).toBe('drawn');
    expect(s.lastWriteAt).toBeNull();
    expect(s.__getInternalForTests()).toEqual({
      totalGames: 1,
      xWins: 0,
      oWins: 0,
      draws: 1,
      currentStreak: 0,
    });
    restore();
  });

  it('loadSoloStats degrades to emptyStats on invalid JSON, wrong shape, or missing key', () => {
    window.localStorage.setItem(SOLO_STATS_KEY, 'not json');
    expect(loadSoloStats()).toEqual(emptyStats());
    window.localStorage.setItem(
      SOLO_STATS_KEY,
      JSON.stringify({ totalGames: 'x', xWins: 0, oWins: 0, draws: 0, currentStreak: 0 }),
    );
    expect(loadSoloStats()).toEqual(emptyStats());
    window.localStorage.setItem(SOLO_STATS_KEY, JSON.stringify({ totalGames: 1, xWins: 1 }));
    expect(loadSoloStats()).toEqual(emptyStats());
    window.localStorage.removeItem(SOLO_STATS_KEY);
    expect(loadSoloStats()).toEqual(emptyStats());
  });

  it('resetSoloStats clears the key + internal cache and does NOT stamp lastWriteAt', () => {
    useGameStore.setState({ lastWriteAt: 12345 });
    window.localStorage.setItem(
      SOLO_STATS_KEY,
      JSON.stringify({ totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 }),
    );
    useGameStore.getState().startGame('solo');
    expect(useGameStore.getState().__getInternalForTests().totalGames).toBe(3);
    useGameStore.getState().resetSoloStats();
    expect(window.localStorage.getItem(SOLO_STATS_KEY)).toBeNull();
    expect(useGameStore.getState().__getInternalForTests()).toEqual(emptyStats());
    // No stamp: solo reset is local-only; the prior write timestamp stays.
    expect(useGameStore.getState().lastWriteAt).toBe(12345);
  });

  it('ranked path unchanged: wins still POST the outcome and never touch localStorage', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
    ]);
    useGameStore.getState().startGame();
    useGameStore.setState({
      phase: 'playing',
      currentPlayer: 'X',
      board: soloWinBoard(),
    });
    await useGameStore.getState().makeMove(8);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/stats/outcome');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'X' });
    expect(window.localStorage.getItem(SOLO_STATS_KEY)).toBeNull();
    restore();
  });  it('loadSoloStats rejects extra fields (strict whitelist, including __proto__/constructor)', () => {
    // Extra string field: current isGameStats accepts this — must reject.
    window.localStorage.setItem(
      SOLO_STATS_KEY,
      JSON.stringify({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1, extra: 'foo' }),
    );
    expect(loadSoloStats()).toEqual(emptyStats());

    // Extra numeric field
    window.localStorage.setItem(
      SOLO_STATS_KEY,
      JSON.stringify({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1, bonus: 7 }),
    );
    expect(loadSoloStats()).toEqual(emptyStats());

    // __proto__ as own data property (JSON.parse does NOT trigger the
    // prototype setter; it is just an extra key). The strict whitelist
    // must reject it as a contract gap regardless of attack surface.
    window.localStorage.setItem(
      SOLO_STATS_KEY,
      '{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1,"__proto__":{"polluted":true}}',
    );
    expect(loadSoloStats()).toEqual(emptyStats());

    // constructor as own data property
    window.localStorage.setItem(
      SOLO_STATS_KEY,
      '{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1,"constructor":{"polluted":true}}',
    );
    expect(loadSoloStats()).toEqual(emptyStats());

    // Missing key (already covered by the base test, but listed for clarity).
    window.localStorage.removeItem(SOLO_STATS_KEY);
    expect(loadSoloStats()).toEqual(emptyStats());
  });

  it('resetSoloStats is a no-op when mode is not "solo" (defensive guard)', () => {
    // Seed localStorage with non-empty data and the internal cache with
    // a (mock) server row. mode is 'ranked' after resetStore.
    const baseline = { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 };
    window.localStorage.setItem(SOLO_STATS_KEY, JSON.stringify(baseline));
    const serverRow = { totalGames: 7, xWins: 5, oWins: 1, draws: 1, currentStreak: 3 };
    useGameStore.getState().setInitialStats(serverRow);
    expect(useGameStore.getState().mode).toBe('ranked');

    // resetSoloStats called in ranked context must be a no-op — the
    // server-row mirror must NOT be wiped by a stray solo-clear call.
    useGameStore.getState().resetSoloStats();
    expect(window.localStorage.getItem(SOLO_STATS_KEY)).toBe(JSON.stringify(baseline));
    expect(useGameStore.getState().__getInternalForTests()).toEqual(serverRow);
  });

  it('cross-mode (a): solo fall-through then startGame("ranked")+makeMove takes ranked branch without touching localStorage', async () => {
    // Solo fall-through: seed localStorage with a non-empty row.
    useGameStore.getState().startGame('solo');
    useGameStore.setState({
      phase: 'playing',
      mode: 'solo',
      currentPlayer: 'X',
      board: soloWinBoard(),
    });
    await useGameStore.getState().makeMove(8);
    expect(useGameStore.getState().__getInternalForTests().totalGames).toBe(1);
    const persisted = JSON.parse(window.localStorage.getItem(SOLO_STATS_KEY)!);
    expect(persisted.totalGames).toBe(1);

    // Switch to ranked; localStorage must NOT change as a side-effect of
    // the mode switch (startGame('ranked') only reseeds from localStorage
    // for solo mode). The next move must POST the outcome and the local
    // row must remain the solo baseline.
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
    ]);
    useGameStore.getState().startGame('ranked');
    expect(useGameStore.getState().mode).toBe('ranked');
    const persistedBefore = JSON.parse(window.localStorage.getItem(SOLO_STATS_KEY)!);
    useGameStore.setState({
      phase: 'playing',
      mode: 'ranked',
      currentPlayer: 'X',
      board: soloWinBoard(),
    });
    await useGameStore.getState().makeMove(8);
    await new Promise((r) => setTimeout(r, 10));
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/stats/outcome');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'X' });
    expect(JSON.parse(window.localStorage.getItem(SOLO_STATS_KEY)!)).toEqual(persistedBefore);
    restore();
  });

  it('cross-mode (b): ranked fall-through then startGame("solo") reseeds internalStats from localStorage baseline', () => {
    // Seed localStorage with a non-zero baseline; seed internal cache
    // with a (mock) ranked server row that differs.
    const baseline = { totalGames: 7, xWins: 5, oWins: 1, draws: 1, currentStreak: 3 };
    window.localStorage.setItem(SOLO_STATS_KEY, JSON.stringify(baseline));
    const serverRow = { totalGames: 99, xWins: 50, oWins: 30, draws: 19, currentStreak: 10 };
    useGameStore.getState().setInitialStats(serverRow);
    expect(useGameStore.getState().__getInternalForTests()).toEqual(serverRow);

    // Simulate a finished ranked game.
    useGameStore.setState({
      phase: 'won',
      mode: 'ranked',
      currentPlayer: null,
      winner: 'X',
      winLine: [0, 4, 8],
      lastOutcome: 'X',
    });

    // Switch to solo: internalStats must reseed from localStorage baseline,
    // not carry the (stale) ranked server row into a solo game.
    useGameStore.getState().startGame('solo');
    expect(useGameStore.getState().mode).toBe('solo');
    expect(useGameStore.getState().__getInternalForTests()).toEqual(baseline);
  });

  it('privacy mode: setItem throws QuotaExceededError → makeMove succeeds, in-memory accumulates, reload reads emptyStats', async () => {
    // Simulate localStorage.setItem throwing a QuotaExceededError as it
    // does in Safari Private Browsing and quota-exhausted Chrome.
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(window.localStorage.getItem(SOLO_STATS_KEY)).toBeNull();

    useGameStore.getState().startGame('solo');
    useGameStore.setState({
      phase: 'playing',
      mode: 'solo',
      currentPlayer: 'X',
      board: soloWinBoard(),
    });

    // makeMove must NOT propagate the setItem throw — the in-memory
    // accumulation is the source of truth for the live UI; persistence
    // is best-effort.
    await expect(useGameStore.getState().makeMove(8)).resolves.toBeUndefined();
    expect(useGameStore.getState().__getInternalForTests()).toEqual({
      totalGames: 1,
      xWins: 1,
      oWins: 0,
      draws: 0,
      currentStreak: 1,
    });
    expect(setItemSpy).toHaveBeenCalled();
    expect(window.localStorage.getItem(SOLO_STATS_KEY)).toBeNull();

    // Tear down the spy first so the reload read is not mocked-throw.
    setItemSpy.mockRestore();

    // Simulate reload: since setItem never succeeded, the persisted
    // baseline is empty — the next startGame('solo') reseeds from
    // emptyStats, not the in-memory post-throw value.
    expect(loadSoloStats()).toEqual(emptyStats());
  });
});
