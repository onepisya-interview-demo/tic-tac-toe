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
import { clearSoloStats, loadSoloStats, persistSoloStats } from './solo-stats';
import { playSound } from './sound';

export type GamePhase = 'idle' | 'playing' | 'won' | 'drawn';

/**
 * 'ranked' (default) keeps the server-authoritative contract: outcomes
 * POST to /api/stats/outcome and the server owns the accumulation.
 * 'solo' never issues a network write — outcomes accumulate locally and
 * persist to localStorage (lib/solo-stats.ts).
 */
export type GameMode = 'ranked' | 'solo';

export interface GameState {
  phase: GamePhase;
  /** Game mode of the current session; solo games skip all network writes. */
  mode: GameMode;
  board: Board;
  currentPlayer: Player | null;
  winner: Player | null;
  winLine: readonly [number, number, number] | null;
  lastOutcome: 'X' | 'O' | 'draw' | null;
  /**
   * Wall-clock timestamp (Date.now()) of the most recent network write
   * (POST /api/stats/outcome or DELETE /api/stats). Set inside the async
   * makeMove / resetAll after the request settles so subscribers can
   * observe write completion instead of guessing with timers. Stats
   * hydration via setInitialStats also stamps lastWriteAt so a freshly
   * mounted <StatsHydrator> triggers the same downstream effects as an
   * in-game write.
   */
  lastWriteAt: number | null;
}

export interface GameActions {
  /**
   * Start a new game. Defaults to 'ranked'. Starting in 'solo' seeds the
   * internal stats cache from the localStorage baseline (reload
   * semantics) so solo accumulation continues across sessions.
   */
  startGame: (mode?: GameMode) => void;
  /**
   * Apply a move for the current player. Async because the underlying
   * stats outcome POST is awaited so lastWriteAt is set on completion
   * (PlayController subscribes to that to navigate). The function
   * resolves even on POST failure — local UI state stays correct.
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
  /**
   * Clear the solo-mode stats: remove the localStorage key and reset the
   * internal cache to emptyStats(). Deliberately does NOT stamp
   * lastWriteAt — that timestamp means "a network write settled", and
   * solo reset is a purely local operation; stamping it would falsely
   * trigger lastWriteAt subscribers (e.g. ranked navigation).
   */
  resetSoloStats: () => void;
  __resetInternalForTests: () => void;
  /**
   * Read-only handle for the module-level internalStats cache. Tests
   * use it to assert the "write-only on network failure" invariant
   * (the server-authoritative contract demands internalStats stays
   * untouched when the POST outcome / DELETE fails). Mirrors the
   * `__resetInternalForTests` seam; production code never calls it.
   */
  __getInternalForTests: () => GameStats;
}

export type GameStore = GameState & GameActions;

const initial: GameState = {
  phase: 'idle',
  mode: 'ranked',
  board: createEmptyBoard(),
  currentPlayer: null,
  winner: null,
  winLine: null,
  lastOutcome: null,
  lastWriteAt: null,
};

// Internal stats cache (NOT in GameState type). RSC pages hydrate this via
// setInitialStats on mount, and every successful outcome POST / DELETE
// refreshes it from the server response, so it mirrors the last-known
// server row. The server — not this cache — is the authoritative
// accumulator: makeMove only reports who won ('X' | 'O' | 'draw').
let internalStats: GameStats = emptyStats();

/**
 * Tagged result for store-internal network writes. POST/DELETE calls go
 * through withTimeout, so a successful 2xx surfaces as { ok: true, value },
 * while abort (timeout) and non-2xx / thrown network errors collapse into
 * { ok: false, reason }. Callers (`makeMove`, `resetAll`) preserve the
 * same invariant as before — local UI state stays correct regardless of
 * outcome — but the `{ ok, reason }` shape gives reset-button UI a precise
 * signal to show a loading spinner and recover gracefully if Turso HTTP
 * hangs past 8 s (HAR §P2 evidence: DELETE observed 30 733 ms once).
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

/**
 * Server-authoritative outcome recording: the client only names who won
 * ('X' | 'O' | 'draw'); the POST /api/stats/outcome handler reads the
 * current row, applies the pure `recordOutcome` rule, and returns the
 * new full row as { stats: GameStats }. A successful 2xx surfaces as
 * { ok: true, value: { stats } } so the caller can adopt the server's
 * answer as its internal cache; abort (timeout) and non-2xx / thrown
 * network / JSON parse errors collapse into { ok: false, reason }.
 */
async function apiRecordOutcome(
  outcome: 'X' | 'O' | 'draw',
): Promise<StoreFetchResult<{ stats: GameStats }>> {
  try {
    const r = await withTimeout('/api/stats/outcome', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ outcome }),
    });
    if (!r.ok) return { ok: false, reason: 'network-error' };
    const value = (await r.json()) as { stats: GameStats };
    return { ok: true, value };
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

  __getInternalForTests: () => internalStats,

  startGame: (mode?: GameMode) => {
    const resolvedMode: GameMode = mode ?? 'ranked';
    if (resolvedMode === 'solo') {
      // Reload semantics: a solo session resumes from the browser-
      // persisted baseline so accumulation survives page reloads.
      internalStats = loadSoloStats();
    }
    const firstPlayer = randomizeFirstPlayer();
    set({
      phase: 'playing',
      board: createEmptyBoard(),
      currentPlayer: firstPlayer,
      winner: null,
      winLine: null,
      lastOutcome: null,
      mode: resolvedMode,
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
      if (s.mode === 'solo') {
        // Solo: zero network writes. Accumulate locally from the internal
        // cache (seeded from localStorage by startGame('solo')) and persist
        // for the next session. No lastWriteAt stamp — that timestamp
        // means "a network write settled", and solo never writes; this
        // also keeps lastWriteAt subscribers (ranked navigation) silent.
        internalStats = recordOutcome(internalStats, win.player);
        persistSoloStats(internalStats);
        return;
      }
      // Server-authoritative write: the client only names the winner; the
      // server reads the current row, applies recordOutcome, and returns
      // the new full row, which becomes our internal cache. ok:false
      // (aborted or network-error) keeps the same invariant as before —
      // local UI state is already correct, the write is lost, and
      // internalStats is left untouched (no client-side accumulation).
      const r = await apiRecordOutcome(win.player);
      if (r.ok) internalStats = r.value.stats;
      set({ lastWriteAt: Date.now() });
      return;
    }

    if (isBoardFull(board)) {
      set({
        board,
        phase: 'drawn',
        winner: null,
        winLine: null,
        lastOutcome: 'draw',
      });
      playSound('draw');
      if (s.mode === 'solo') {
        // Same solo contract as the win branch: local accumulation,
        // localStorage persistence, zero network, zero lastWriteAt.
        internalStats = recordOutcome(internalStats, 'draw');
        persistSoloStats(internalStats);
        return;
      }
      // Same server-authoritative contract as the win branch above: the
      // server owns the accumulation, the client only reports 'draw'.
      const r = await apiRecordOutcome('draw');
      if (r.ok) internalStats = r.value.stats;
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

  resetSoloStats: () => {
    clearSoloStats();
    internalStats = emptyStats();
    // Deliberately no lastWriteAt stamp: solo reset is local-only with no
    // network write; stamping would falsely signal a server write to
    // subscribers (PlayController navigation).
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
