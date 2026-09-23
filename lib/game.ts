// Pure game-logic functions for tic-tac-toe.
// No React, no DOM, no I/O — fully testable.

export type Cell = 'X' | 'O' | null;
export type Board = readonly [
  Cell, Cell, Cell,
  Cell, Cell, Cell,
  Cell, Cell, Cell,
];
export type Player = 'X' | 'O';
export type WinLine = readonly [number, number, number];

/** Create a fresh empty board. */
export function createEmptyBoard(): Board {
  return [null, null, null, null, null, null, null, null, null] as Board;
}

/** All 8 possible winning lines on a 3x3 board (rows, columns, diagonals). */
const WIN_LINES: readonly WinLine[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],            // diagonals
];

/** Find the winning line if any; returns null when no winner. */
export function checkWinner(board: Board): { player: Player; line: WinLine } | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const va = board[a];
    if (va !== null && va === board[b] && va === board[c]) {
      return { player: va, line };
    }
  }
  return null;
}

/** Is every cell filled? */
export function isBoardFull(board: Board): boolean {
  return board.every((c) => c !== null);
}

/** All indices currently empty on the board. */
export function getAvailableMoves(board: Board): readonly number[] {
  const moves: number[] = [];
  for (let i = 0; i < board.length; i++) {
    if (board[i] === null) moves.push(i);
  }
  return moves;
}

/** Apply a move; throws on an occupied or out-of-range cell. */
export function applyMove(board: Board, index: number, player: Player): Board {
  if (index < 0 || index > 8) {
    throw new Error(`move index out of range: ${index}`);
  }
  if (board[index] !== null) {
    throw new Error(`cell ${index} already occupied by ${board[index]}`);
  }
  const next = [...board] as Cell[];
  next[index] = player;
  return next as unknown as Board;
}

/** Other player (X -> O, O -> X). */
export function otherPlayer(player: Player): Player {
  return player === 'X' ? 'O' : 'X';
}

/** Pick first player uniformly at random using the provided RNG. */
export function randomizeFirstPlayer(rng: () => number = Math.random): Player {
  return rng() < 0.5 ? 'X' : 'O';
}

/** Initial (zero) stats shape. */
export interface GameStats {
  totalGames: number;
  xWins: number;
  oWins: number;
  draws: number;
  currentStreak: number; // +N for X streak, -N for O streak, 0 = no streak
}

export function emptyStats(): GameStats {
  return {
    totalGames: 0,
    xWins: 0,
    oWins: 0,
    draws: 0,
    currentStreak: 0,
  };
}

/**
 * Canonical key set for the GameStats contract, sorted alphabetically.
 * Single source of truth for the JSON-shape whitelist used by both the
 * browser-side `localStorage` load (lib/offline-stats.ts) and the HTTP
 * transport-side merge body validator (app/api/rooms/{room}/stats/merge).
 * Adding or removing a GameStats field requires updating this constant
 * AND the GameStats interface in the same commit — the validator
 * rejects any parsed value whose key set does not match exactly.
 */
export const GAME_STATS_KEYS =
  'currentStreak,draws,oWins,totalGames,xWins';

/**
 * Type guard for values parsed from JSON (localStorage round-trip or
 * HTTP request body). Accepts an object iff it has exactly the five
 * GameStats keys with finite-number values and nothing else — the
 * strict key-set check closes the contract gap left by the per-field
 * type checks alone (otherwise `__proto__`, `constructor`, or any
 * polluted prototype chain member would slip through as a "number").
 *
 * Pure function: no DOM, no I/O, fully testable. Consumed by
 * `lib/offline-stats.ts:loadOfflineStats` (browser persistence path)
 * and `app/api/rooms/{room}/stats/merge/route.ts:isMergeBody` (HTTP
 * transport boundary).
 */
export function isGameStats(value: unknown): value is GameStats {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.totalGames === 'number' && Number.isFinite(s.totalGames) &&
    typeof s.xWins === 'number' && Number.isFinite(s.xWins) &&
    typeof s.oWins === 'number' && Number.isFinite(s.oWins) &&
    typeof s.draws === 'number' && Number.isFinite(s.draws) &&
    typeof s.currentStreak === 'number' && Number.isFinite(s.currentStreak) &&
    Object.keys(s).sort().join(',') === GAME_STATS_KEYS
  );
}

/** Human label for the signed streak counter: "+N for X, -N for O, 0 = dash". */
export function streakLabel(currentStreak: number): string {
  if (currentStreak === 0) return '—';
  return currentStreak > 0
    ? `X 连胜 ${currentStreak}`
    : `O 连胜 ${Math.abs(currentStreak)}`;
}

/** Update stats given a finished game outcome. */
export function recordOutcome(
  stats: GameStats,
  outcome: 'X' | 'O' | 'draw',
): GameStats {
  return {
    totalGames: stats.totalGames + 1,
    xWins: stats.xWins + (outcome === 'X' ? 1 : 0),
    oWins: stats.oWins + (outcome === 'O' ? 1 : 0),
    draws: stats.draws + (outcome === 'draw' ? 1 : 0),
    currentStreak:
      outcome === 'draw'
        ? 0
        : outcome === 'X'
          ? stats.currentStreak >= 0
            ? stats.currentStreak + 1
            : 1
          : stats.currentStreak <= 0
            ? stats.currentStreak - 1
            : -1,
  };
}
