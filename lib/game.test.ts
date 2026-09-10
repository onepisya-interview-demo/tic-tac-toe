import { describe, it, expect } from 'vitest';
import {
  createEmptyBoard,
  checkWinner,
  isBoardFull,
  getAvailableMoves,
  applyMove,
  otherPlayer,
  randomizeFirstPlayer,
  emptyStats,
  recordOutcome,
  streakLabel,
  type Board,
  type Cell,
} from './game';

const empty = createEmptyBoard();

describe('createEmptyBoard', () => {
  it('returns 9 null cells', () => {
    expect(empty).toHaveLength(9);
    expect(empty.every((c) => c === null)).toBe(true);
  });

  it('returns a fresh board each call (no shared state)', () => {
    const a = createEmptyBoard();
    const b = createEmptyBoard();
    expect(a).not.toBe(b);
  });
});

describe('applyMove', () => {
  it('places the player at the chosen empty index', () => {
    const next = applyMove(empty, 4, 'X');
    expect(next[4]).toBe('X');
    expect(next.filter((c) => c !== null)).toHaveLength(1);
  });

  it('leaves other cells untouched', () => {
    const next = applyMove(empty, 0, 'X');
    expect(next.slice(1)).toEqual([...empty].slice(1));
  });

  it('throws when cell is already occupied', () => {
    expect(() => applyMove(applyMove(empty, 0, 'X'), 0, 'O')).toThrow(/occupied/);
  });

  it('throws when index is out of range', () => {
    expect(() => applyMove(empty, -1, 'X')).toThrow(/out of range/);
    expect(() => applyMove(empty, 9, 'X')).toThrow(/out of range/);
  });
});

describe('checkWinner', () => {
  it('returns null on an empty board', () => {
    expect(checkWinner(empty)).toBeNull();
  });

  it.each([
    [0, 1, 2, 'X'],
    [3, 4, 5, 'O'],
    [6, 7, 8, 'X'],
    [0, 3, 6, 'O'],
    [1, 4, 7, 'X'],
    [2, 5, 8, 'O'],
    [0, 4, 8, 'X'],
    [2, 4, 6, 'O'],
  ] as const)('detects line %s-%s-%s for %s', (a, b, c, player) => {
    const board: Cell[] = [...empty];
    board[a] = player;
    board[b] = player;
    board[c] = player;
    const result = checkWinner(board as unknown as Board);
    expect(result).not.toBeNull();
    expect(result?.player).toBe(player);
    expect(result?.line).toEqual([a, b, c]);
  });

  it('returns null when no line of three', () => {
    const board: Cell[] = [...empty];
    board[0] = 'X';
    board[1] = 'O';
    board[2] = 'X';
    expect(checkWinner(board as unknown as Board)).toBeNull();
  });
});

describe('isBoardFull', () => {
  it('false on empty board', () => {
    expect(isBoardFull(empty)).toBe(false);
  });

  it('true when every cell is filled', () => {
    const board: Cell[] = ['X','O','X','O','X','O','X','O','X'];
    expect(isBoardFull(board as unknown as Board)).toBe(true);
  });
});

describe('getAvailableMoves', () => {
  it('returns all 9 indices on empty board', () => {
    expect(getAvailableMoves(empty)).toEqual([0,1,2,3,4,5,6,7,8]);
  });

  it('excludes occupied indices', () => {
    const board = applyMove(empty, 4, 'X');
    expect(getAvailableMoves(board)).toEqual([0,1,2,3,5,6,7,8]);
  });

  it('returns empty array on full board', () => {
    const board: Cell[] = ['X','O','X','O','X','O','X','O','X'];
    expect(getAvailableMoves(board as unknown as Board)).toEqual([]);
  });
});

describe('otherPlayer', () => {
  it('swaps X and O', () => {
    expect(otherPlayer('X')).toBe('O');
    expect(otherPlayer('O')).toBe('X');
  });
});

describe('randomizeFirstPlayer', () => {
  it('returns X or O only', () => {
    for (let i = 0; i < 50; i++) {
      const p = randomizeFirstPlayer();
      expect(['X', 'O']).toContain(p);
    }
  });

  it('uses the provided RNG', () => {
    expect(randomizeFirstPlayer(() => 0)).toBe('X');
    expect(randomizeFirstPlayer(() => 0.9999)).toBe('O');
    expect(randomizeFirstPlayer(() => 0.5)).toBe('O');
  });

  it('distributes roughly 50/50 over many calls', () => {
    let x = 0, o = 0;
    for (let i = 0; i < 1000; i++) {
      if (randomizeFirstPlayer() === 'X') x++; else o++;
    }
    expect(Math.abs(x - o)).toBeLessThan(100);
  });
});

describe('recordOutcome', () => {
  it('all-zero on first outcome', () => {
    const next = recordOutcome(emptyStats(), 'X');
    expect(next).toEqual({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 });
  });

  it('records draw and resets streak', () => {
    const next = recordOutcome({ totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 }, 'draw');
    expect(next).toEqual({ totalGames: 2, xWins: 1, oWins: 0, draws: 1, currentStreak: 0 });
  });

  it('switches streak sign on alternating winners', () => {
    let s = emptyStats();
    s = recordOutcome(s, 'X'); // streak = +1
    s = recordOutcome(s, 'O'); // streak = -1 (switch)
    s = recordOutcome(s, 'O'); // streak = -2
    expect(s.currentStreak).toBe(-2);
  });

  it('records an O win with every counter', () => {
    const next = recordOutcome(emptyStats(), 'O');
    expect(next).toEqual({ totalGames: 1, xWins: 0, oWins: 1, draws: 0, currentStreak: -1 });
  });

  it('extends an X streak in both directions across switches', () => {
    const afterLoss = recordOutcome({ totalGames: 1, xWins: 0, oWins: 1, draws: 0, currentStreak: -1 }, 'X');
    expect(afterLoss.currentStreak).toBe(1);
    const extended = recordOutcome({ totalGames: 2, xWins: 1, oWins: 1, draws: 0, currentStreak: 1 }, 'X');
    expect(extended.currentStreak).toBe(2);
    const switched = recordOutcome(extended, 'O');
    expect(switched.currentStreak).toBe(-1);
  });
});

describe('streakLabel', () => {
  it('returns a dash for zero streak', () => {
    expect(streakLabel(0)).toBe('—');
  });

  it('labels positive streaks as X', () => {
    expect(streakLabel(3)).toBe('X 连胜 3');
  });

  it('labels negative streaks as O with absolute count', () => {
    expect(streakLabel(-2)).toBe('O 连胜 2');
  });
});
