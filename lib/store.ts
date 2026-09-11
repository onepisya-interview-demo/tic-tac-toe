'use client';

import { create } from 'zustand';
import {
  applyMove,
  checkWinner,
  createEmptyBoard,
  emptyStats,
  isBoardFull,
  otherPlayer,
  randomizeFirstPlayer,
  recordOutcome,
  type Board,
  type GameStats,
  type Player,
} from './game';
import { playSound } from './sound';

export type GamePhase = 'idle' | 'playing' | 'won' | 'drawn';

export interface GameState {
  phase: GamePhase;
  board: Board;
  currentPlayer: Player | null;
  winner: Player | null;
  winLine: readonly [number, number, number] | null;
  lastOutcome: 'X' | 'O' | 'draw' | null;
  /**
   * Wall-clock timestamp (Date.now()) of the most recent network write
   * (PUT or DELETE to /api/stats). Set inside the async makeMove / resetAll
   * after the request settles so subscribers can observe write completion
   * instead of guessing with timers. Stats hydration via setInitialStats
   * also stamps lastWriteAt so a freshly mounted <StatsHydrator> triggers
   * the same downstream effects as an in-game write.
   */
  lastWriteAt: number | null;
}

export interface GameActions {
  startGame: () => void;
  /**
   * Apply a move for the current player. Async because the underlying
   * stats PUT is awaited so lastWriteAt is set on completion (PlayController
   * subscribes to that to navigate). The function resolves even on PUT
   * failure — local UI state stays correct.
   */
  makeMove: (index: number) => Promise<void>;
  restart: () => void;
  /**
   * Delete server-side stats, reset internal cache, stamp lastWriteAt.
   * Async so callers (ResultActions / ResetStatsButton) can await it
   * before calling router.refresh(), avoiding a race where the refresh
   * re-reads the still-present stats.
   */
  resetAll: () => Promise<void>;
  setInitialStats: (stats: GameStats) => void;
  __resetInternalForTests: () => void;
}

export type GameStore = GameState & GameActions;

const initial: GameState = {
  phase: 'idle',
  board: createEmptyBoard(),
  currentPlayer: null,
  winner: null,
  winLine: null,
  lastOutcome: null,
  lastWriteAt: null,
};

// Internal stats cache (NOT in GameState type). RSC pages hydrate this via
// setInitialStats on mount so makeMove's recordOutcome has the current
// baseline; otherwise the first PUT would overwrite DB with values computed
// from emptyStats() instead of the real on-disk stats.
let internalStats: GameStats = emptyStats();

/**
 * Tagged result for store-internal network writes. PUT/DELETE calls go
 * through withTimeout (commit 3), so a successful 2xx surfaces as
 * { ok: true, value }, while abort (timeout) and non-2xx / thrown
 * network errors collapse into { ok: false, reason }. Callers
 * (`makeMove`, `resetAll`) preserve the same invariant as before —
 * local UI state stays correct regardless of outcome — but the
 * `{ ok, reason }` shape gives reset-button UI a precise signal to
 * show a loading spinner and recover gracefully if Turso HTTP hangs
 * past 8 s (HAR §P2 evidence: DELETE observed 30 733 ms once).
 */
export type StoreFetchResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'aborted' | 'network-error' };

/**
 * Wrap a fetch() call so it rejects (well, returns ok:false) after
 * `ms` milliseconds. Uses AbortController + setTimeout, exactly the
 * pattern HAR §P2 recommends. 8000 ms is the chosen floor: the
 * observed Turso DELETE that took 30 s was an outlier, not a
 * re-occurring latency, but a single stuck PUT that blocks the
 * reset button for half a minute is what we're guarding against.
 * If we later need retry, the { ok, reason } shape gives it a clean
 * seam without changing the public store API.
 */
export const NETWORK_TIMEOUT_MS = 8000;

export async function withTimeout(
  url: string,
  init: RequestInit,
  ms: number = NETWORK_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException('aborted', 'TimeoutError'));
  }, ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function apiPutStats(stats: GameStats): Promise<StoreFetchResult<void>> {
  try {
    const r = await withTimeout('/api/stats', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(stats),
    });
    if (!r.ok) return { ok: false, reason: 'network-error' };
    return { ok: true, value: undefined };
  } catch (err) {
    return { ok: false, reason: err instanceof DOMException && err.name === 'TimeoutError' ? 'aborted' : 'network-error' };
  }
}

async function apiDeleteStats(): Promise<StoreFetchResult<GameStats>> {
  try {
    const r = await withTimeout('/api/stats', { method: 'DELETE' });
    if (!r.ok) return { ok: false, reason: 'network-error' };
    const value = (await r.json()) as GameStats;
    return { ok: true, value };
  } catch (err) {
    return { ok: false, reason: err instanceof DOMException && err.name === 'TimeoutError' ? 'aborted' : 'network-error' };
  }
}

export const useGameStore = create<GameStore>((set) => ({
  ...initial,

  setInitialStats: (stats) => {
    internalStats = stats;
    // Hydration is a write event for downstream subscribers (PlayController
    // uses it to detect when stats are ready, ResultActions uses it to
    // refresh after resetAll → rehydrate).
    set({ lastWriteAt: Date.now() });
  },

  __resetInternalForTests: () => {
    internalStats = emptyStats();
  },

  startGame: () => {
    const firstPlayer = randomizeFirstPlayer();
    set({
      phase: 'playing',
      board: createEmptyBoard(),
      currentPlayer: firstPlayer,
      winner: null,
      winLine: null,
      lastOutcome: null,
    });
  },

  makeMove: async (index: number): Promise<void> => {
    const s = useGameStore.getState();
    if (s.phase !== 'playing') return;
    if (s.currentPlayer === null) return;
    if (s.board[index] !== null) return;

    const board = applyMove(s.board, index, s.currentPlayer);

    const win = checkWinner(board);
    if (win) {
      const newStats = recordOutcome(internalStats, win.player);
      internalStats = newStats;
      set({
        board,
        phase: 'won',
        winner: win.player,
        winLine: win.line,
        lastOutcome: win.player,
      });
      // checkWinner is called only after applyMove(board, index, currentPlayer),
      // so win.player is currentPlayer by construction.
      playSound('win');
      // Two-layer celebration: short ascending pair to confirm the win,
      // then a longer arpeggio with vibrato to celebrate it. The 360ms
      // delay lines up with the end of the 'win' envelopes (2 × 180ms).
      // playSound('cheer') re-reads getMuted(), so toggling mute mid-
      // celebration still silences the rest.
      setTimeout(() => playSound('cheer'), 360);
      // Network write: result is { ok, reason } now; ok:false (aborted
      // or network-error) keeps the same invariant as before — local UI
      // state is already correct, DB write is lost (single-row UPSERT).
      await apiPutStats(newStats);
      set({ lastWriteAt: Date.now() });
      return;
    }

    if (isBoardFull(board)) {
      const newStats = recordOutcome(internalStats, 'draw');
      internalStats = newStats;
      set({
        board,
        phase: 'drawn',
        winner: null,
        winLine: null,
        lastOutcome: 'draw',
      });
      playSound('draw');
      await apiPutStats(newStats);
      set({ lastWriteAt: Date.now() });
      return;
    }

    set({
      board,
      currentPlayer: otherPlayer(s.currentPlayer),
    });
    playSound('move');
  },

  restart: () => {
    set({
      phase: 'idle',
      board: createEmptyBoard(),
      currentPlayer: null,
      winner: null,
      winLine: null,
      lastOutcome: null,
    });
  },

  resetAll: async (): Promise<void> => {
    // Network write: await so callers can refresh() AFTER the server-side
    // row is gone; otherwise a force-dynamic refresh races the DELETE and
    // re-reads the still-present stats. Local cache mirrors server state
    // on both success and failure paths (the { ok, reason } contract lets
    // us fall back to emptyStats() without a try/catch at the call site).
    const result = await apiDeleteStats();
    internalStats = result.ok ? result.value : emptyStats();
    set({ lastWriteAt: Date.now() });
  },
}));
