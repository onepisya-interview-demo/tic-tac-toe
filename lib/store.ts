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
}

export interface GameActions {
  startGame: () => void;
  makeMove: (index: number) => void;
  restart: () => void;
  resetAll: () => void;
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

  makeMove: (index: number) => {
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
      void apiPutStats(newStats).catch(() => {
        /* stats PUT failure: local UI state is already correct */
      });
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
      .then((zero) => {
        internalStats = zero;
      })
      .catch(() => {
        internalStats = emptyStats();
      });
  },
}));
