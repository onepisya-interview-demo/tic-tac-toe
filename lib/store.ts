'use client';

import { create } from 'zustand';
import {
  applyMove,
  checkWinner,
  createEmptyBoard,
  emptyStats,
  getAvailableMoves,
  isBoardFull,
  otherPlayer,
  randomizeFirstPlayer,
  recordOutcome,
  type Board,
  type GameStats,
  type Player,
} from './game';

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
      })
      .catch(() => {
        const firstPlayer = randomizeFirstPlayer();
        set({
          phase: 'playing',
          board: createEmptyBoard(),
          currentPlayer: firstPlayer,
          winner: null,
          winLine: null,
          lastOutcome: null,
          stats: emptyStats(),
        });
      });
  },

  makeMove: (index: number) => {
    const s = get();
    if (s.phase !== 'playing') return;
    if (s.currentPlayer === null) return;
    if (s.board[index] !== null) return;

    let board = s.board;
    try {
      board = applyMove(board, index, s.currentPlayer);
    } catch {
      return;
    }

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
      void apiPutStats(newStats).catch(() => {
        /* swallow — UI state already updated */
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
      void apiPutStats(newStats).catch(() => {});
      return;
    }

    set({
      board,
      currentPlayer: otherPlayer(s.currentPlayer),
    });
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

export function selectAvailableMoves(state: GameStore): readonly number[] {
  return getAvailableMoves(state.board);
}
