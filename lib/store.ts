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
import {
  clearOfflineStats,
  loadOfflineStats,
  persistOfflineStats,
} from './offline-stats';
import { postOutcome } from './game-net';
import {
  clearPlayerName as clearPlayerNameLocal,
  getPlayerName,
  setPlayerName as setPlayerNameLocal,
} from './player-name';
import { playSound } from './sound';

export type GamePhase = 'idle' | 'playing' | 'won' | 'drawn';

/**
 * 'online' — 实时上服版本（W3 起 /online 路由：需 name 入口拦截，完局
 *   通过 lib/game-net.ts → service `recordOutcomeForName` 服务端权威
 *   累加）。本波（W1）只留清晰的 TODO 注释，不发任何请求。
 * 'offline' — 离线单机版本（W4 起 /offline 路由：完全离线、本地账本、
 *   **无名不记**、W3 合并弹框是唯一网络写）。
 *
 * 差异仅记账路径：online 走 service，offline 走 localStorage
 * (`lib/offline-stats.ts`)。两者都遵守「无名不记」守卫：无名时根本不发
 * 请求、不写本地账本（A4 前置）。
 */
export type GameMode = 'online' | 'offline';

export interface GameState {
  phase: GamePhase;
  /** Game mode of the current session. */
  mode: GameMode;
  board: Board;
  currentPlayer: Player | null;
  winner: Player | null;
  winLine: readonly [number, number, number] | null;
  /**
   * Player name (mirror of `localStorage['ttt.player.name.v1']`).
   * Hydrated on mount by `setPlayerName` (the source of truth) and
   * updated by PlayerNameForm on save / clear.
   *
   * **无名不记守卫**: online / offline 两条分支在 `makeMove` 内首句
   * 即判断 `playerName` 是否为空；为空时**不发任何请求、不写
   * localStorage、不累加 internalStats**，本步走完后 phase 仍正常
   * 推进（用户体验：显示胜平，但战绩 0 增长；用户去填名字后下一局
   * 开始计数）。这与 AC A4 「online 入口拦截 / offline 无名不记」
   * 完全对应。
   */
  playerName: string | null;
}

export interface GameActions {
  /**
   * Start a new game. Defaults to 'online'. Starting in 'offline' seeds
   * the internal stats cache from the localStorage baseline (reload
   * semantics) so offline accumulation continues across sessions.
   */
  startGame: (mode?: GameMode) => void;
  /**
   * Apply a move for the current player. Synchronous from the UI
   * perspective — bookkeeping (network write for online, localStorage
   * persistence for offline) happens inside the action but is fire-and-
   * forget for offline (no return promise needed) and stays as a TODO
   * seam for online (W2 wires the actual fetch).
   */
  makeMove: (index: number) => Promise<void>;
  restart: () => void;
  /**
   * Clear the offline-mode stats: remove the localStorage key and reset
   * the internal cache to emptyStats().
   */
  resetOfflineStats: () => void;
  __resetInternalForTests: () => void;
  /**
   * Read-only handle for the module-level internalStats cache. Tests
   * use it to assert offline accumulation.
   */
  __getInternalForTests: () => GameStats;
  /**
   * Set / clear the player's name. Persists to localStorage and mirrors
   * the value into state so the store can branch on it without re-reading
   * localStorage at every move. SSR-safe via lib/player-name.ts's window
   * guard.
   */
  setPlayerName: (name: string | null) => void;
}

export type GameStore = GameState & GameActions;

const initial: GameState = {
  phase: 'idle',
  mode: 'online',
  board: createEmptyBoard(),
  currentPlayer: null,
  winner: null,
  winLine: null,
  playerName: null,
};

// Internal stats cache (NOT in GameState type). For offline mode,
// mirrors the last-known localStorage row; online mode (W2+) will mirror
// the server-side per-name row via fetch response. W1 ships the offline
// path; online path is a TODO seam inside `makeMove`.
let internalStats: GameStats = emptyStats();

/**
 * Tagged result for store-internal network writes (kept for W2 — when
 * `recordOutcomeForName` lands, the network helper will use this same
 * { ok, reason } shape as lib/game-net.ts). W1 ships the helper but the
 * `makeMove` online branch is a TODO.
 */
export type StoreFetchResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'aborted' | 'network-error' | 'http-error' | 'not-found'; status?: number };

/**
 * Wrap a fetch() call so it rejects (well, returns ok:false) after
 * `ms` milliseconds. Uses AbortController + setTimeout — the pattern
 * the game-net / store helpers already use. 8000 ms is the chosen
 * floor: a single stuck request that blocks the UI for half a minute
 * is what we're guarding against. W2 will route the online branch's
 * POST outcomes call through this helper.
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
 * TODO (W2): wire online-mode outcome recording through this seam.
 * W1 keeps the function signature stable so the W2 implementation
 * drops in without touching the call site:
 *
 *   const r = await apiRecordOutcome('X');
 *   if (r.ok) internalStats = r.value.stats;
 *
 * Server-authoritative contract: client only names the winner; service
 * `recordOutcomeForName(name, outcome)` (lib/db.ts) reads the per-name
 * row, applies `recordOutcome`, upserts, returns the new full row.
 */
async function apiRecordOutcome(
  // W2 online branch seam. lib/game-net.ts:postOutcome →
  // POST /api/players/{name}/stats/outcomes → recordOutcomeForName.
  // The 404 from the server maps to `reason: 'not-found'` so callers
  // can branch on the row-vanished case without inspecting status
  // codes (the row-existence contract is enforced server-side; we
  // just translate the signal). Other failures keep the same reason
  // strings the rest of lib/store.ts's network layer uses
  // ('aborted' / 'network-error' / 'http-error').
  name: string,
  outcome: 'X' | 'O' | 'draw',
): Promise<StoreFetchResult<{ stats: GameStats }>> {
  const r = await postOutcome(name, outcome);
  if (!r.ok) {
    if (r.reason === 'http-error' && r.status === 404) {
      return { ok: false, reason: 'not-found' };
    }
    return { ok: false, reason: r.reason };
  }
  return { ok: true, value: r.value };
}

export const useGameStore = create<GameStore>((set) => ({
  ...initial,

  __resetInternalForTests: () => {
    internalStats = emptyStats();
  },

  __getInternalForTests: () => internalStats,

  startGame: (mode?: GameMode) => {
    const resolvedMode: GameMode = mode ?? 'online';
    if (resolvedMode === 'offline') {
      // Reload semantics: an offline session resumes from the browser-
      // persisted baseline so accumulation survives page reloads.
      internalStats = loadOfflineStats();
      // Rehydrate the player name from localStorage when the store
      // booted without one (SSR first frame, fresh page navigation).
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

    // **无名不记守卫 (AC A4 前置)**: 不论 online 还是 offline, 没有
    // playerName 时直接跳过 bookkeeping。本步的 phase / board 仍正常
    // 推进——用户体验: 显示胜平, 但战绩 0 增长。
    const isAnonymous = s.playerName === null || s.playerName === '';

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
      setTimeout(() => playSound('cheer'), 360);
      if (isAnonymous) {
        // 无名不记: 既不发请求 (online) 也不写 localStorage (offline)。
        return;
      }
      if (s.mode === 'offline') {
        // Offline: 100% 本地累加 + localStorage 持久化。零网络写。
        internalStats = recordOutcome(internalStats, win.player);
        persistOfflineStats(internalStats);
        return;
      }
      // Online: W2 — wire to lib/game-net.ts:postOutcome →
      // POST /api/players/{name}/stats/outcomes → lib/db.ts:recordOutcomeForName.
      // The helper returns the server-authoritative row on success;
      // internalStats mirrors it so the next /result render + the
      // online card refetch stay in sync (the home-return path reads
      // internalStats only on /online /result, never for the local
      // /offline display — A2 red-line preserved).
      const r = await apiRecordOutcome(s.playerName as string, win.player);
      if (r.ok) internalStats = r.value.stats;
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
      if (isAnonymous) {
        return;
      }
      if (s.mode === 'offline') {
        internalStats = recordOutcome(internalStats, 'draw');
        persistOfflineStats(internalStats);
        return;
      }
      // Online: W2 — same seam as the win branch.
      const r = await apiRecordOutcome(s.playerName as string, 'draw');
      if (r.ok) internalStats = r.value.stats;
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

  resetOfflineStats: () => {
    // Defensive guard: resetOfflineStats is offline-mode-only. The sole
    // current caller is components/ResetStatsButton (scope='local',
    // rendered only by OfflineStatsPanel → app/solo/page.tsx), so this
    // branch is unreachable in production today. It is added so a
    // future caller that forgets to gate on mode cannot silently wipe
    // the online internal cache (which will become a server-row
    // mirror in W2) with emptyStats().
    if (useGameStore.getState().mode !== 'offline') return;
    clearOfflineStats();
    internalStats = emptyStats();
  },

  setPlayerName: (name) => {
    // Mirror to localStorage so reloads re-hydrate the same value. Pass
    // null to clear (the panel's clear button uses this). SSR-safe via
    // the inner typeof window guard in lib/player-name.ts.
    if (name === null) {
      clearPlayerNameLocal();
    } else {
      setPlayerNameLocal(name);
    }
    set({ playerName: name });
  },
}));
