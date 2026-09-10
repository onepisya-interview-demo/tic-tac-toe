// Property-based invariants for lib/game.ts (fast-check).
// Lives in a *.property.test.ts file so `pnpm test:property`
// (vitest run lib/**/*.property.test.ts) actually runs it.
// Originally extracted from lib/game.test.ts — same fc.assert + fc.property
// semantics, no test logic changes.

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createEmptyBoard,
  checkWinner,
  getAvailableMoves,
  applyMove,
  otherPlayer,
  emptyStats,
  recordOutcome,
  type Player,
} from './game';

describe('property: game logic invariants', () => {
  it('checkWinner returns null on a fully-empty board', () => {
    fc.assert(fc.property(fc.constant(null), () => {
      expect(checkWinner(createEmptyBoard())).toBeNull();
    }));
  });

  it('applying a move never produces a winner when only one cell is filled', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 8 }), (idx) => {
      const board = applyMove(createEmptyBoard(), idx, 'X');
      expect(checkWinner(board)).toBeNull();
    }));
  });

  it('getAvailableMoves count matches non-null cells', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 8 }), { maxLength: 9 }), (indices) => {
      const unique = Array.from(new Set(indices)).slice(0, 9);
      let board = createEmptyBoard();
      for (const i of unique) {
        try {
          board = applyMove(board, i, 'X');
        } catch {
          break; // ignore collisions
        }
      }
      const filled = board.filter((c) => c !== null).length;
      expect(getAvailableMoves(board)).toHaveLength(9 - filled);
    }), { numRuns: 200 });
  });

  it('otherPlayer is involutive', () => {
    fc.assert(fc.property(fc.constantFrom('X' as Player, 'O' as Player), (p) => {
      expect(otherPlayer(otherPlayer(p))).toBe(p);
    }));
  });

  it('recordOutcome monotonically increments totalGames', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 50 }),
      fc.constantFrom<'X' | 'O' | 'draw'>('X', 'O', 'draw'),
      (start, outcome) => {
        let s = emptyStats();
        for (let i = 0; i < start; i++) s = recordOutcome(s, outcome);
        const next = recordOutcome(s, outcome);
        expect(next.totalGames).toBe(start + 1);
      },
    ));
  });
});
