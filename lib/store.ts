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

async function apiPutStats(stats: GameStats): Promise<void> {
  const r = await fetch('/api/stats', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(stats),
  });
  if (!r.ok) throw new Error(`stats PUT ${r.status}`);
}

async function apiDeleteStats(): Promise<GameStats> {
  const r = await fetch('/api/stats', { method: 'DELETE' });
  if (!r.ok) throw new Error(`stats DELETE ${r.status}`);
  return (await r.json()) as GameStats;
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
      // Network write: await so callers (PlayController via lastWriteAt)
      // can observe completion; force-dynamic pages refresh on next nav.
      // Failure mode is the same as before — local UI state stays correct,
      // DB write is lost (single-row UPSERT, no replay).
      try {
        await apiPutStats(newStats);
      } catch {
        /* local UI state is already correct */
      }
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
      try {
        await apiPutStats(newStats);
      } catch {
        /* local UI state is already correct */
      }
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
    // on both success and failure paths.
    let zero: GameStats;
    try {
      zero = await apiDeleteStats();
    } catch {
      zero = emptyStats();
    }
    internalStats = zero;
    set({ lastWriteAt: Date.now() });
  },
}));
