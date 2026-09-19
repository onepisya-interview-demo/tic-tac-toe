import { describe, it, expect, vi, afterEach } from 'vitest';
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
    roomName: null,
  });
  useGameStore.getState().__resetInternalForTests();
}

function seedInternalStats(stats: GameStats): void {
  window.localStorage.setItem(OFFLINE_STATS_KEY, JSON.stringify(stats));
  useGameStore.getState().startGame('offline');
  useGameStore.setState({ mode: 'online' });
}

describe('lib/store (zustand game store) — W2 ulw-room-migration-home-landing', () => {
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

  it('startGame does not hit the network (RSC owns stats, W2 zero home fetches)', () => {
    const { calls, restore } = mockFetch([]);
    useGameStore.getState().startGame();
    expect(calls).toHaveLength(0);
    restore();
  });

  it('online win: anonymous user → ZERO network writes, internal cache untouched', async () => {
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

  it('online win: named user → fires POST /api/rooms/{room}/stats/outcomes (W2 seam)', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
    ]);
    useGameStore.getState().setRoomName('alice');
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
    expect(calls).toHaveLength(1);
    expect(String(calls[0].url)).toBe('/api/rooms/alice/stats/outcomes');
    expect(calls[0].init?.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ outcome: 'X' });
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
    useGameStore.getState().setRoomName('alice');
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
    useGameStore.getState().setRoomName('alice');
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
    expect(calls).toHaveLength(1);
    expect(String(calls[0].url)).toBe('/api/rooms/alice/stats/outcomes');
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
    expect(calls).toHaveLength(0);
    restore();
  });

  it('makeMove abort: keeps phase=won, no throw (named online, W2 AbortController timeout)', async () => {
    const { calls, restore } = mockFetchWithAbort();
    useGameStore.getState().setRoomName('alice');
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
    expect(calls).toHaveLength(1);
    expect(String(calls[0].url)).toBe('/api/rooms/alice/stats/outcomes');
    restore();
  });

  it('makeMove draw: anonymous OFFLINE → no fetch; writes localStorage draw (D-1 语义)', async () => {
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
    expect(calls, 'no network on offline path').toHaveLength(0);
    expect(JSON.parse(window.localStorage.getItem(OFFLINE_STATS_KEY)!)).toEqual({
      totalGames: 1, xWins: 0, oWins: 0, draws: 1, currentStreak: 0,
    });
    restore();
  });

  it('makeMove win: anonymous OFFLINE → no fetch; writes localStorage win (D-1 语义)', async () => {
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
    expect(calls, 'no network on offline path').toHaveLength(0);
    expect(JSON.parse(window.localStorage.getItem(OFFLINE_STATS_KEY)!)).toEqual({
      totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1,
    });
    restore();
  });

  // F4 red line: anonymous ONLINE branch keeps the no-fetch / no-write guard
  // (anti-silent-create 纵深防御). The D-1 semantic flip only loosens the
  // offline branch; an anonymous click on /online must still skip bookkeeping
  // instead of POSTing an outcome against a name the server has no row for.
  it('makeMove win: anonymous ONLINE → no fetch, no localStorage write (F4 guard retained)', async () => {
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
    expect(calls, 'no network: anonymous online never POSTs outcome').toHaveLength(0);
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();
    restore();
  });

  it('makeMove draw: anonymous ONLINE → no fetch, no localStorage write (F4 guard retained)', async () => {
    const { calls, restore } = mockFetch([]);
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
    expect(calls, 'no network: anonymous online never POSTs outcome').toHaveLength(0);
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();
    restore();
  });

  // W2 (ulw-room-migration-home-landing): setRoomName mirror
  // localStorage; null clears. SSR-safe via lib/room-name guards.
  it('setRoomName: mirrors localStorage ttt.room.name.v1 + clears legacy ttt.player.name.v1', () => {
    window.localStorage.setItem('ttt.player.name.v1', 'pre-migration');
    expect(useGameStore.getState().setRoomName('alice')).toBeUndefined();
    expect(useGameStore.getState().roomName).toBe('alice');
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBe('alice');
    expect(window.localStorage.getItem('ttt.player.name.v1')).toBeNull();
  });

  it('setRoomName(null): clears localStorage; store mirror = null', () => {
    useGameStore.getState().setRoomName('alice');
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBe('alice');
    useGameStore.getState().setRoomName(null);
    expect(useGameStore.getState().roomName).toBeNull();
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBeNull();
  });
});

// ── offline mode: local accumulation + localStorage persistence ──

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
    useGameStore.getState().setRoomName('alice');
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
    useGameStore.getState().setRoomName('alice');
    useGameStore.getState().startGame('offline');
    await offlineWin();
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
    useGameStore.getState().setRoomName('alice');
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
    useGameStore.getState().setRoomName('alice');
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
    window.localStorage.setItem(
      OFFLINE_STATS_KEY,
      JSON.stringify({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1, extra: 'foo' }),
    );
    expect(loadOfflineStats()).toEqual(emptyStats());

    window.localStorage.setItem(
      OFFLINE_STATS_KEY,
      JSON.stringify({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1, bonus: 7 }),
    );
    expect(loadOfflineStats()).toEqual(emptyStats());

    window.localStorage.setItem(
      OFFLINE_STATS_KEY,
      '{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1,"__proto__":{"polluted":true}}',
    );
    expect(loadOfflineStats()).toEqual(emptyStats());

    window.localStorage.setItem(
      OFFLINE_STATS_KEY,
      '{"totalGames":1,"xWins":1,"oWins":0,"draws":0,"currentStreak":1,"constructor":{"polluted":true}}',
    );
    expect(loadOfflineStats()).toEqual(emptyStats());

    window.localStorage.removeItem(OFFLINE_STATS_KEY);
    expect(loadOfflineStats()).toEqual(emptyStats());
  });

  it('resetOfflineStats is a no-op when mode is not "offline" (defensive guard)', () => {
    const baseline = { totalGames: 3, xWins: 2, oWins: 1, draws: 0, currentStreak: 1 };
    window.localStorage.setItem(OFFLINE_STATS_KEY, JSON.stringify(baseline));
    useGameStore.getState().startGame('offline');
    expect(useGameStore.getState().__getInternalForTests()).toEqual(baseline);

    useGameStore.setState({ mode: 'online' });
    useGameStore.getState().resetOfflineStats();
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toEqual(JSON.stringify(baseline));
    expect(useGameStore.getState().__getInternalForTests()).toEqual(baseline);
  });

  it('cross-mode (a): offline fall-through then startGame("online") reseeds internalStats from localStorage baseline', () => {
    const baseline = { totalGames: 7, xWins: 5, oWins: 1, draws: 1, currentStreak: 3 };
    window.localStorage.setItem(OFFLINE_STATS_KEY, JSON.stringify(baseline));
    useGameStore.getState().startGame('offline');
    expect(useGameStore.getState().__getInternalForTests()).toEqual(baseline);

    useGameStore.setState({
      phase: 'won',
      mode: 'offline',
      currentPlayer: null,
      winner: 'X',
      winLine: [0, 4, 8],
    });

    useGameStore.getState().startGame('online');
    expect(useGameStore.getState().mode).toBe('online');
    expect(useGameStore.getState().__getInternalForTests()).toEqual(baseline);
  });

  it('privacy mode: setItem throws QuotaExceededError → makeMove succeeds, in-memory accumulates, reload reads emptyStats', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    expect(window.localStorage.getItem(OFFLINE_STATS_KEY)).toBeNull();

    useGameStore.getState().setRoomName('alice');
    useGameStore.getState().startGame('offline');
    useGameStore.setState({
      phase: 'playing',
      mode: 'offline',
      currentPlayer: 'X',
      board: offlineWinBoard(),
    });

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

    setItemSpy.mockRestore();

    expect(loadOfflineStats()).toEqual(emptyStats());
  });
});

describe('lib/store pure-local (online branch POSTs outcomes; offline 100% local)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    resetStore();
  });

  it('named offline win: ZERO fetches; localStorage accumulates', async () => {
    const { calls, restore } = mockFetch([
      { status: 200, body: { stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } } },
    ]);
    useGameStore.getState().setRoomName('alice');
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
    useGameStore.getState().setRoomName('bob');
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
    useGameStore.getState().setRoomName('erin');
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
