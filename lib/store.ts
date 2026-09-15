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
import {
  clearPlayerName as clearPlayerNameLocal,
  getPlayerName,
  setPlayerName as setPlayerNameLocal,
} from './player-name';
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
  /**
   * Player name (mirror of `localStorage['ttt.player.name.v1']`).
   * Hydrated on mount by `setPlayerName` (the source of truth) and
   * updated by PlayerNameForm on save / clear. Solo games with a
   * non-null playerName auto-POST outcomes to /api/solo-stats; with
   * null, the original wave-1 "zero network writes" contract holds.
   */
  playerName: string | null;
  /**
   * Solo network-sync state for the most recent solo game:
   * - `pending`: the outcome of the last solo game that has not yet
   *   been confirmed by a successful POST. Lets the panel surface a
   *   manual 「同步」button as a retry affordance without re-POSTing
   *   successful outcomes.
   * - `inflight`: true while the store is mid-POST; the panel's sync
   *   button uses this for its loading/disabled state.
   * - `error`: human-readable reason when the last POST attempt failed
   *   ('aborted' | 'network-error' | 'http-error'); cleared on next
   *   successful POST or on name change.
   */
  soloSync: {
    pending: 'X' | 'O' | 'draw' | null;
    inflight: boolean;
    error: 'aborted' | 'network-error' | 'http-error' | null;
  };
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
  /**
   * Set / clear the player's name. Persists to localStorage and mirrors
   * the value into state so the store's solo branch can branch on it
   * without re-reading localStorage at every move (which would couple
   * the store to a browser API). Called by PlayerNameForm on save and
   * by SoloStatsPanel on mount / name-change event.
   */
  setPlayerName: (name: string | null) => void;
  /**
   * Retry the most recent failed solo POST. No-op when no outcome is
   * pending or no name is set. Sets soloSync.inflight around the call;
   * clears `pending` on success and updates `error` on failure. The
   * panel's 「同步」button calls this with no arguments.
   */
  retrySoloSync: () => Promise<void>;
}

export type GameStore = GameState & GameActions;

const initial: GameState = {
  phase: 'idle',
  mode: 'ranked',
  board: createEmptyBoard(),
  currentPlayer: null,
  winner: null,
  winLine: null,
  lastWriteAt: null,
  playerName: null,
  soloSync: { pending: null, inflight: false, error: null },
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
  | { ok: false; reason: 'aborted' | 'network-error' | 'http-error'; status?: number };

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

/**
 * Server-authoritative solo outcome accumulator: the client only names
 * who won + which player; the POST /api/solo-stats handler reads the
 * per-name row, applies recordOutcome, and returns the new full row as
 * { stats: GameStats }. Mirrors apiRecordOutcome's { ok, value } |
 * { ok, false, reason } contract but adds an http-error reason (the
 * solo route can 422 on a bad name; ranked never 422s on the body
 * shape because the body is just { outcome }). Caller (makeMove's solo
 * branch, retrySoloSync) stamps soloSync.{pending, error} from the
 * result.
 */
async function apiPostSoloOutcome(
  name: string,
  outcome: 'X' | 'O' | 'draw',
): Promise<StoreFetchResult<{ stats: GameStats }>> {
  try {
    const r = await withTimeout('/api/solo-stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, outcome }),
    });
    if (!r.ok) return { ok: false, reason: 'http-error' };
    const value = (await r.json()) as { stats: GameStats };
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
      // Rehydrate the player name from localStorage when the store
      // booted without one (SSR first frame, fresh page navigation).
      // Done here so the solo branch in makeMove can read state.
      // playerName on the first move without a localStorage round-trip
      // in the hot path. SSR-safe via lib/player-name's window guard.
      if (!useGameStore.getState().playerName) {
        const stored = getPlayerName();
        if (stored) {
          // Direct set — mirrors the localStorage value into state so
          // the very next makeMove sees it.
          useGameStore.setState({ playerName: stored });
        }
      }
    }
    const firstPlayer = randomizeFirstPlayer();
    set({
      phase: 'playing',
      board: createEmptyBoard(),
      currentPlayer: firstPlayer,
      winner: null,
      winLine: null,
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
        // Solo: local accumulation from the internal cache (seeded by
        // startGame('solo')) + localStorage persistence. The named-mode
        // auto-POST happens here (not in the panel) so the sync fires
        // regardless of whether the user is on the board view or the
        // stats view — the panel is unmounted on the board view in
        // wave 1 / 2, and we still need the network write to land.
        internalStats = recordOutcome(internalStats, win.player);
        persistSoloStats(internalStats);
        if (s.playerName) {
          set({ soloSync: { pending: win.player, inflight: true, error: null } });
          const r = await apiPostSoloOutcome(s.playerName, win.player);
          if (r.ok) {
            set({
              soloSync: { pending: null, inflight: false, error: null },
              lastWriteAt: Date.now(),
            });
          } else {
            set({ soloSync: { pending: win.player, inflight: false, error: r.reason } });
          }
        }
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
      });
      playSound('draw');
      if (s.mode === 'solo') {
        // Same solo contract as the win branch: local accumulation +
        // localStorage persistence; named-mode auto-POST fires here.
        internalStats = recordOutcome(internalStats, 'draw');
        persistSoloStats(internalStats);
        if (s.playerName) {
          set({ soloSync: { pending: 'draw', inflight: true, error: null } });
          const r = await apiPostSoloOutcome(s.playerName, 'draw');
          if (r.ok) {
            set({
              soloSync: { pending: null, inflight: false, error: null },
              lastWriteAt: Date.now(),
            });
          } else {
            set({ soloSync: { pending: 'draw', inflight: false, error: r.reason } });
          }
        }
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
        });
  },

  resetSoloStats: () => {
    // Defensive guard: resetSoloStats is solo-mode-only. The sole
    // current caller is components/ResetStatsButton (scope='local',
    // rendered only by SoloStatsPanel), so this branch is unreachable
    // in production today. It is added so a future caller that
    // forgets to gate on mode cannot silently wipe the ranked server
    // row mirror in `internalStats` with emptyStats(). Reads mode
    // through getState() to avoid a stale closure if a future caller
    // schedules resetSoloStats asynchronously after a mode switch.
    if (useGameStore.getState().mode !== 'solo') return;
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

  setPlayerName: (name) => {
    // Mirror to localStorage so reloads re-hydrate the same value. Pass
    // null to clear (the panel's clear button uses this). SSR-safe via
    // the inner typeof window guard in lib/player-name.ts; we still
    // update the in-memory state unconditionally so server-rendered
    // RSC trees that call this in a future use case see the latest
    // value without depending on a localStorage round-trip.
    if (name === null) {
      clearPlayerNameLocal();
    } else {
      setPlayerNameLocal(name);
    }
    set({
      playerName: name,
      // Name change clears any stale pending sync — the previous name
      // belongs to a different row on the server, retrying it under a
      // new name would 422. The new name's pending state starts clean.
      soloSync: { pending: null, inflight: false, error: null },
    });
  },

  retrySoloSync: async (): Promise<void> => {
    const s = useGameStore.getState();
    if (!s.playerName || !s.soloSync.pending) return;
    set({ soloSync: { ...s.soloSync, inflight: true, error: null } });
    const r = await apiPostSoloOutcome(s.playerName, s.soloSync.pending);
    if (r.ok) {
      set({
        soloSync: { pending: null, inflight: false, error: null },
        lastWriteAt: Date.now(),
      });
    } else {
      set({ soloSync: { pending: s.soloSync.pending, inflight: false, error: r.reason } });
    }
  },
}));
