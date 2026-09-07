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
  stats: GameStats;
  lastOutcome: 'X' | 'O' | 'draw' | null;
}

export interface GameActions {
  startGame: () => void;
  makeMove: (index: number) => void;
  restart: () => void;
  resetAll: () => void;
  hydrateStats: () => void;
}

export type GameStore = GameState & GameActions;

const initial: GameState = {
  phase: 'idle',
  board: createEmptyBoard(),
  currentPlayer: null,
  winner: null,
  winLine: null,
  stats: emptyStats(),
  lastOutcome: null,
};

async function apiGetStats(): Promise<GameStats> {
  const r = await fetch('/api/stats', { cache: 'no-store' });
  if (!r.ok) throw new Error(`stats GET ${r.status}`);
  return (await r.json()) as GameStats;
}

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

export const useGameStore = create<GameStore>((set, get) => ({
  ...initial,

  hydrateStats: () => {
    void apiGetStats()
      .then((stats) => set({ stats }))
      .catch(() => set({ stats: emptyStats() }));
  },

  startGame: () => {
    void apiGetStats()
      // Network failure still starts the game, just with zero stats —
      // the same shape as the success path so callers need no branch.
      .catch(() => emptyStats())
      .then((stats) => {
        const firstPlayer = randomizeFirstPlayer();
        set({
          phase: 'playing',
          board: createEmptyBoard(),
          currentPlayer: firstPlayer,
          winner: null,
          winLine: null,
          lastOutcome: null,
          stats,
        });
      });
  },

  makeMove: (index: number) => {
    const s = get();
    if (s.phase !== 'playing') return;
    if (s.currentPlayer === null) return;
    if (s.board[index] !== null) return;

    // The guards above make applyMove's throw paths unreachable: occupied
    // cells and out-of-range indices (undefined) both fail the !== null
    // check, so this call cannot throw.
    const board = applyMove(s.board, index, s.currentPlayer);

    const win = checkWinner(board);
    if (win) {
      const newStats = recordOutcome(s.stats, win.player);
      set({
        board,
        phase: 'won',
        winner: win.player,
        winLine: win.line,
        stats: newStats,
        lastOutcome: win.player,
      });
      if (win.player === s.currentPlayer) {
        // Two-layer celebration: short ascending pair to confirm the win,
        // then a longer arpeggio with vibrato to celebrate it. The 360ms
        // delay lines up with the end of the 'win' envelopes (2 × 180ms).
        // playSound('cheer') re-reads getMuted(), so toggling mute mid-
        // celebration still silences the rest.
        playSound('win');
        setTimeout(() => playSound('cheer'), 360);
      } else {
        playSound('lose');
      }
      void apiPutStats(newStats).catch(() => {
        /* stats PUT failure: local UI state is already correct */
      });
      return;
    }

    if (isBoardFull(board)) {
      const newStats = recordOutcome(s.stats, 'draw');
      set({
        board,
        phase: 'drawn',
        winner: null,
        winLine: null,
        stats: newStats,
        lastOutcome: 'draw',
      });
      playSound('draw');
      void apiPutStats(newStats).catch(() => {
        /* stats PUT failure: local UI state is already correct */
      });
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

  resetAll: () => {
    void apiDeleteStats()
      .then((zero) => set({ stats: zero }))
      .catch(() => set({ stats: emptyStats() }));
  },
}));

// Client-side: kick off stats hydration once when the store module loads
// in the browser. Without this, any page that reads `stats` (e.g. /result
// after a hard refresh) sees the emptyStats() initial state until the user
// first clicks "start-game", because `startGame` is the only other caller
// of apiGetStats. The fetch is fire-and-forget; on failure the store
// stays at emptyStats() and the next write path will overwrite anyway.
if (typeof window !== 'undefined') {
  useGameStore.getState().hydrateStats();
}
