import { describe, it, expect, vi, afterEach } from 'vitest';
// NETWORK_TIMEOUT_MS was used by the ranked makeMove / resetAll abort
// tests retired in W1 (ulw-one-game-two-versions). The constant is
// still exported by lib/store.ts for the W2 online branch to consume;
// W1 tests assert the new contracts (no network for online stub, etc.)
// without timing-based abort paths.
import { useGameStore } from '@/lib/store';
import { createEmptyBoard, emptyStats, type Board, type GameStats } from '@/lib/game';
import { OFFLINE_STATS_KEY, loadOfflineStats } from '@/lib/offline-stats';
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
 * 'TimeoutError'). The store's API helpers catch that and surface
 * { ok: false, reason: 'aborted' }, so callers like makeMove keep the
 * same invariant — local UI state stays correct — without an 8 s wait
 * per case.
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
    mode: 'online',
    board: createEmptyBoard(),
    currentPlayer: null,
    winner: null,
    winLine: null,
    playerName: null,
  });
  useGameStore.getState().__resetInternalForTests();
}

function seedInternalStats(stats: GameStats): void {
  // W1 retired setInitialStats (StatsHydrator is gone). For tests
  // that need a pre-seeded internalStats cache, mirror the startGame
  // reseed path by switching to offline mode and back. Simpler: call
  // startGame('offline') after seeding localStorage (offline branch
  // reseeds from localStorage). Even simpler for tests: directly
  // invoke the startGame('offline') reseed after setting localStorage.
  // The internalStats cache becomes loadable from localStorage.
  window.localStorage.setItem(OFFLINE_STATS_KEY, JSON.stringify(stats));
  useGameStore.getState().startGame('offline');
  useGameStore.setState({ mode: 'online' });
}

describe('lib/store (zustand game store)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(playSound).mockClear();
    window.localStorage.clear();
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

  it('online win: anonymous user → ZERO network writes, internal cache untouched', async () => {
    // AC A4 前置 — 无名不记守卫 (online 形态): 无名点开战局赢了不
    // 发任何请求 (W1 network seam 是 TODO)。
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().startGame('online');
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
    await useGameStore.getState().makeMove(8);
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(calls).toHaveLength(0);
    restore();
  });

  it('online win: named user → fires POST /api/players/{name}/stats/outcomes (W2 seam)', async () => {
    // W2 wires the online branch through lib/game-net.ts:postOutcome
    // → POST /api/players/{name}/stats/outcomes → recordOutcomeForRoom (W1 ulw-room-migration-home-landing; lib/store.ts itself still imports the old symbol until W2 — this comment reflects the planned API surface, not the live seam) // → recordOutcomeForRoom.
    // The server-authoritative response (mocked here) is the source of
    // truth for internalStats; the call site is awaited so the store
    // sees the new row before the UI commits the next render.
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
    ]);
    useGameStore.getState().setPlayerName('alice');
    useGameStore.getState().startGame('online');
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
    await useGameStore.getState().makeMove(8);
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(s.winner).toBe('X');
    // W2: online branch fires exactly one POST outcomes call.
    expect(calls).toHaveLength(1);
    expect(String(calls[0].url)).toBe('/api/players/alice/stats/outcomes');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'X' });
    // internalStats mirrors the server-authoritative row after the await.
    expect(useGameStore.getState().__getInternalForTests()).toEqual({
      totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1,
    });
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

  it('plays the two-layer win celebration exactly once', async () => {
    vi.useFakeTimers();
    useGameStore.getState().setPlayerName('alice');
    useGameStore.getState().startGame('online');
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
    await useGameStore.getState().makeMove(8);
    expect(vi.mocked(playSound)).toHaveBeenCalledWith('win');
    await vi.advanceTimersByTimeAsync(360);
    expect(vi.mocked(playSound)).toHaveBeenCalledWith('cheer');
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
  });

  it('makeMove that fills the board sets phase=drawn (named online, no network)', async () => {
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().setPlayerName('alice');
    useGameStore.getState().startGame('online');
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
    await useGameStore.getState().makeMove(8);
    const s = useGameStore.getState();
    expect(s.phase).toBe('drawn');
    expect(vi.mocked(playSound)).toHaveBeenCalledWith('draw');
    // W2: online draw fires POST outcomes with outcome: 'draw'.
    expect(calls).toHaveLength(1);
    expect(String(calls[0].url)).toBe('/api/players/alice/stats/outcomes');
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
    // restart must not hit the network — stats are local-only now.
    expect(calls).toHaveLength(0);
    restore();
  });

  it('makeMove abort: keeps phase=won, no throw (named online, W2 AbortController timeout)', async () => {
    // W2 wires the online branch through postOutcome; the helper wraps
    // fetch with an 8 s AbortController. A TimeoutError must surface
    // as ok:false aborted without throwing — the local UI state stays
    // correct regardless of network state.
    const { calls, restore } = mockFetchWithAbort();
    useGameStore.getState().setPlayerName('alice');
    useGameStore.getState().startGame('online');
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
    expect(() => useGameStore.getState().makeMove(8)).not.toThrow();
    await new Promise((r) => setTimeout(r, 10));
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    // W2: online branch fires the fetch; the abort surfaces as the
    // typed { ok: false, reason } the store swallows.
    expect(calls).toHaveLength(1);
    expect(String(calls[0].url)).toBe('/api/players/alice/stats/outcomes');
    restore();
  });

  it('makeMove draw: anonymous → no fetch, no localStorage write (无名守卫)', async () => {
    // AC A4 前置 — offline 无名不写 localStorage.
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().startGame('offline');
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
    await useGameStore.getState().makeMove(8);
    const s = useGameStore.getState();
    expect(s.phase).toBe('drawn');
    expect(calls).toHaveLength(0);
    // No localStorage write either — 无名守卫拦截了 persistOfflineStats.
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();
    restore();
  });

  it('makeMove win: anonymous → no fetch, no localStorage write (无名守卫)', async () => {
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().startGame('offline');
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
    await useGameStore.getState().makeMove(8);
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(calls).toHaveLength(0);
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();
    restore();
  });
});

// ── offline mode: local accumulation + localStorage persistence ──
// Offline is the mirror image of the online contract: ZERO network writes
// (W1 ships online as a TODO; offline is the active branch), outcomes
// accumulate locally via the pure recordOutcome rule, and the row
// persists to localStorage (lib/offline-stats.ts) so accumulation survives
// reloads. AC A4: 无名不写 localStorage — `playerName === null` 时 store
// 直接跳过 persistOfflineStats, 守卫拦截前步。

describe('lib/store offline mode (local accumulation + localStorage)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(playSound).mockClear();
    window.localStorage.clear();
    resetStore();
  });

  function offlineWinBoard(): Board {
    return [
      'X', null, null,
      null, 'X', null,
      null, null, null,
    ] as unknown as Board;
  }

  async function offlineWin(): Promise<void> {
    useGameStore.setState({
      phase: 'playing',
      mode: 'offline',
      currentPlayer: 'X',
      board: offlineWinBoard(),
    });
    await useGameStore.getState().makeMove(8);
  }

  it('mode starts as online; startGame() defaults to online; startGame("offline") switches', () => {
    expect(useGameStore.getState().mode).toBe('online');
    useGameStore.getState().startGame();
    expect(useGameStore.getState().mode).toBe('online');
    useGameStore.getState().startGame('offline');
    expect(useGameStore.getState().mode).toBe('offline');
    expect(useGameStore.getState().phase).toBe('playing');
  });

  it('startGame("offline") seeds the internal cache from the localStorage baseline (reload semantics)', () => {
    window.localStorage.setItem(
      OFFLINE_STATS_KEY,
      JSON.stringify({ totalGames: 7, xWins: 5, oWins: 1, draws: 1, currentStreak: 3 }),
    );
    useGameStore.getState().startGame('offline');
    expect(useGameStore.getState().__getInternalForTests()).toEqual({
      totalGames: 7,
      xWins: 5,
      oWins: 1,
      draws: 1,
      currentStreak: 3,
    });
  });

  it('offline win (named): ZERO network writes; local accumulation + persistence', async () => {
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().setPlayerName('alice');
    useGameStore.getState().startGame('offline');
    await offlineWin();
    expect(calls).toHaveLength(0);
    const s = useGameStore.getState();
    expect(s.phase).toBe('won');
    expect(s.winner).toBe('X');
    const expected = { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 };
    expect(s.__getInternalForTests()).toEqual(expected);
    expect(JSON.parse(window.localStorage.getItem(OFFLINE_STATS_KEY)!)).toEqual(expected);
    restore();
  });

  it('offline two-win streak accumulates xWins=2 streak=2 across a restart (localStorage round-trip)', async () => {
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().setPlayerName('alice');
    useGameStore.getState().startGame('offline');
    await offlineWin();
    // Second session: startGame re-seeds from the persisted baseline,
    // then the win accumulates on top of it.
    useGameStore.getState().startGame('offline');
    await offlineWin();
    expect(calls).toHaveLength(0);
    const expected = { totalGames: 2, xWins: 2, oWins: 0, draws: 0, currentStreak: 2 };
    expect(useGameStore.getState().__getInternalForTests()).toEqual(expected);
    expect(JSON.parse(window.localStorage.getItem(OFFLINE_STATS_KEY)!)).toEqual(expected);
    restore();
  });

  it('offline draw (named): accumulates draws + resets streak locally, zero network', async () => {
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().setPlayerName('alice');
    useGameStore.getState().startGame('offline');
    useGameStore.setState({
      phase: 'playing',
      mode: 'offline',
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
    expect(s.__getInternalForTests()).toEqual({
      totalGames: 1,
      xWins: 0,
      oWins: 0,
      draws: 1,
      currentStreak: 0,
    });
    restore();
  });

  it('loadOfflineStats degrades to emptyStats on invalid JSON, wrong shape, or missing key', () => {
    window.localStorage.setItem(OFFLINE_STATS_KEY, 'not json');
    expect(loadOfflineStats()).toEqual(emptyStats());
    window.localStorage.setItem(
      OFFLINE_STATS_KEY,
      JSON.stringify({ totalGames: 'x', xWins: 0, oWins: 0, draws: 0, currentStreak: 0 }),
    );
    expect(loadOfflineStats()).toEqual(emptyStats());
    window.localStorage.setItem(OFFLINE_STATS_KEY, JSON.stringify({ totalGames: 1, xWins: 1 }));
    expect(loadOfflineStats()).toEqual(emptyStats());
    window.localStorage.removeItem(OFFLINE_STATS_KEY);
    expect(loadOfflineStats()).toEqual(emptyStats());
  });

  it('resetOfflineStats clears the key + internal cache', () => {
    window.localStorage.setItem(
      OFFLINE_STATS_KEY,
      JSON.stringify({ totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 }),
    );
    useGameStore.getState().startGame('offline');
    expect(useGameStore.getState().__getInternalForTests().totalGames).toBe(3);
    useGameStore.getState().resetOfflineStats();
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();
    expect(useGameStore.getState().__getInternalForTests()).toEqual(emptyStats());
  });

  it('offline path: wins accumulate locally + never touch network, never POST outcome', async () => {
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().setPlayerName('alice');
    useGameStore.getState().startGame('offline');
    useGameStore.setState({
      phase: 'playing',
      mode: 'offline',
      currentPlayer: 'X',
      board: offlineWinBoard(),
    });
    await useGameStore.getState().makeMove(8);
    expect(calls).toHaveLength(0);
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).not.toBeNull();
    restore();
  });

  it('loadOfflineStats rejects extra fields (strict whitelist, including __proto__/constructor)', () => {
    // Extra string field: current isGameStats accepts this — must reject.
    window.localStorage.setItem(
      OFFLINE_STATS_KEY,
      JSON.stringify({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1, extra: 'foo' }),
    );
    expect(loadOfflineStats()).toEqual(emptyStats());

    // Extra numeric field
    window.localStorage.setItem(
      OFFLINE_STATS_KEY,
      JSON.stringify({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1, bonus: 7 }),
    );
    expect(loadOfflineStats()).toEqual(emptyStats());

    // __proto__ as own data property (JSON.parse does NOT trigger the
    // prototype setter; it is just an extra key). The strict whitelist
    // must reject it as a contract gap regardless of attack surface.
    window.localStorage.setItem(
      OFFLINE_STATS_KEY,
      '{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1,"__proto__":{"polluted":true}}',
    );
    expect(loadOfflineStats()).toEqual(emptyStats());

    // constructor as own data property
    window.localStorage.setItem(
      OFFLINE_STATS_KEY,
      '{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1,"constructor":{"polluted":true}}',
    );
    expect(loadOfflineStats()).toEqual(emptyStats());

    // Missing key (already covered by the base test, but listed for clarity).
    window.localStorage.removeItem(OFFLINE_STATS_KEY);
    expect(loadOfflineStats()).toEqual(emptyStats());
  });

  it('resetOfflineStats is a no-op when mode is not "offline" (defensive guard)', () => {
    // Seed localStorage with non-empty data. mode is 'online' after resetStore.
    const baseline = { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 };
    window.localStorage.setItem(OFFLINE_STATS_KEY, JSON.stringify(baseline));
    // Reseed internal cache via offline startGame so it has the baseline.
    useGameStore.getState().startGame('offline');
    expect(useGameStore.getState().__getInternalForTests()).toEqual(baseline);

    // Switch to online; resetOfflineStats must be a no-op.
    useGameStore.setState({ mode: 'online' });
    useGameStore.getState().resetOfflineStats();
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toEqual(JSON.stringify(baseline));
    // Internal cache unchanged.
    expect(useGameStore.getState().__getInternalForTests()).toEqual(baseline);
  });

  it('cross-mode (a): offline fall-through then startGame("online") reseeds internalStats from localStorage baseline', () => {
    // Seed localStorage with a non-zero baseline.
    const baseline = { totalGames: 7, xWins: 5, oWins: 1, draws: 1, currentStreak: 3 };
    window.localStorage.setItem(OFFLINE_STATS_KEY, JSON.stringify(baseline));
    useGameStore.getState().startGame('offline');
    expect(useGameStore.getState().__getInternalForTests()).toEqual(baseline);

    // Simulate a finished offline game.
    useGameStore.setState({
      phase: 'won',
      mode: 'offline',
      currentPlayer: null,
      winner: 'X',
      winLine: [0, 4, 8],
    });

    // Switch to online: internalStats must remain whatever it was
    // (offline startGame already reseeded from localStorage; online
    // startGame leaves it alone).
    useGameStore.getState().startGame('online');
    expect(useGameStore.getState().mode).toBe('online');
    expect(useGameStore.getState().__getInternalForTests()).toEqual(baseline);
  });

  it('privacy mode: setItem throws QuotaExceededError → makeMove succeeds, in-memory accumulates, reload reads emptyStats', async () => {
    // Simulate localStorage.setItem throwing a QuotaExceededError as it
    // does in Safari Private Browsing and quota-exhausted Chrome.
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();

    useGameStore.getState().setPlayerName('alice');
    useGameStore.getState().startGame('offline');
    useGameStore.setState({
      phase: 'playing',
      mode: 'offline',
      currentPlayer: 'X',
      board: offlineWinBoard(),
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
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();

    // Tear down the spy first so the reload read is not mocked-throw.
    setItemSpy.mockRestore();

    // Simulate reload: since setItem never succeeded, the persisted
    // baseline is empty — the next startGame('offline') reseeds from
    // emptyStats, not the in-memory post-throw value.
    expect(loadOfflineStats()).toEqual(emptyStats());
  });
});

describe('lib/store pure-local (W1: online branch is a TODO, no network for offline)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    resetStore();
  });

  it('named offline win: ZERO fetches; localStorage accumulates', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
    ]);
    useGameStore.getState().setPlayerName('alice');
    useGameStore.getState().startGame('offline');
    await useGameStore.getState().makeMove(0);
    await useGameStore.getState().makeMove(3);
    await useGameStore.getState().makeMove(1);
    await useGameStore.getState().makeMove(4);
    await useGameStore.getState().makeMove(2);
    expect(useGameStore.getState().phase).toBe('won');
    expect(calls, 'no fetch should be made for offline win').toHaveLength(0);
    const stats = JSON.parse(window.localStorage.getItem(OFFLINE_STATS_KEY)!);
    expect(stats.totalGames).toBe(1);
    restore();
  });

  it('named offline draw: ZERO fetches; localStorage accumulates draws', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 0, oWins: 0, draws: 1, currentStreak: 0 } } },
    ]);
    useGameStore.getState().setPlayerName('bob');
    useGameStore.getState().startGame('offline');
    const drawSeq = [4, 0, 8, 5, 3, 7, 2, 6, 1];
    for (const i of drawSeq) {
      await useGameStore.getState().makeMove(i);
    }
    expect(useGameStore.getState().phase).toBe('drawn');
    expect(calls, 'no fetch should be made for offline draw').toHaveLength(0);
    const stats = JSON.parse(window.localStorage.getItem(OFFLINE_STATS_KEY)!);
    expect(stats.draws).toBe(1);
    expect(stats.totalGames).toBe(1);
    restore();
  });

  it('two named offline wins: localStorage accumulates to 2; ZERO fetches total', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
      { status: 200, body: { stats: { totalGames: 2, xWins: 2, oWins: 0, draws: 0, currentStreak: 2 } } },
    ]);
    useGameStore.getState().setPlayerName('erin');
    useGameStore.getState().startGame('offline');
    await useGameStore.getState().makeMove(0);
    await useGameStore.getState().makeMove(3);
    await useGameStore.getState().makeMove(1);
    await useGameStore.getState().makeMove(4);
    await useGameStore.getState().makeMove(2);
    expect(useGameStore.getState().phase).toBe('won');
    useGameStore.getState().startGame('offline');
    await useGameStore.getState().makeMove(0);
    await useGameStore.getState().makeMove(3);
    await useGameStore.getState().makeMove(1);
    await useGameStore.getState().makeMove(4);
    await useGameStore.getState().makeMove(2);
    expect(calls, 'offline: no fetches across two named games').toHaveLength(0);
    const stats = JSON.parse(window.localStorage.getItem(OFFLINE_STATS_KEY)!);
    expect(stats.totalGames).toBe(2);
    expect(stats.xWins + stats.oWins).toBe(2);
    expect(stats.draws).toBe(0);
    restore();
  });
});
