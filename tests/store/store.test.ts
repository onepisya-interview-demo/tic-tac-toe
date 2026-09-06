import { describe, it, expect, vi, afterEach } from 'vitest';
import { useGameStore, selectAvailableMoves } from '@/lib/store';
import { createEmptyBoard, emptyStats, type Board } from '@/lib/game';

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

  it('hydrateStats fetches and stores remote stats', async () => {
    const remote = {
      totalGames: 4,
      xWins: 2,
      oWins: 1,
      draws: 1,
      currentStreak: 2,
    };
    const { restore } = mockFetch([{ status: 200, body: remote }]);
    useGameStore.getState().hydrateStats();
    await new Promise((r) => setTimeout(r, 10));
    expect(useGameStore.getState().stats).toEqual(remote);
    restore();
  });

  it('hydrateStats falls back to zero stats on network error', async () => {
    const { restore } = mockFetch([{ status: 500 }]);
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
    expect(calls.some((c) => c.init?.method === 'PUT')).toBe(true);
    restore();
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
    expect(s.stats.draws).toBe(1);
    expect(s.stats.totalGames).toBe(1);
    restore();
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
    useGameStore.getState().resetAll();
    await new Promise((r) => setTimeout(r, 10));
    expect(useGameStore.getState().stats).toEqual(zero);
    expect(calls.some((c) => c.init?.method === 'DELETE')).toBe(true);
    restore();
  });

  it('resetAll falls back to empty stats on network error', async () => {
    const { restore } = mockFetch([{ status: 500 }]);
    useGameStore.getState().resetAll();
    await new Promise((r) => setTimeout(r, 10));
    expect(useGameStore.getState().stats).toEqual(emptyStats());
    restore();
  });

  it('selectAvailableMoves returns indices of empty cells', () => {
    const board: Board = [
      'X', null, 'O',
      null, null, null,
      null, null, null,
    ];
    useGameStore.setState({ board: board as unknown as Board });
    const moves = selectAvailableMoves(useGameStore.getState());
    expect(moves).toEqual([1, 3, 4, 5, 6, 7, 8]);
  });
});
