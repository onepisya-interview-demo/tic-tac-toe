// Property-based invariants for lib/store.ts's reducer face (fast-check).
// Naming follows the *.property.test.ts template (docs/verification-gauntlet.md
// §2) so `pnpm test:property` (vitest run property) picks this file up
// alongside lib/game.property.test.ts.
//
// Scope: the zustand store's state-transition rules — phase gates, occupied-
// cell no-ops, legal-move accounting, startGame/restart landing states. Move
// invariants run in 'offline' mode so the bookkeeping path stays synchronous
// localStorage (jsdom-backed); the online fetch seam's example-based contract
// stays in tests/store/store.test.ts. Sound is mocked the same way
// store.test.ts mocks it.

import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { useGameStore } from './store';
import { createEmptyBoard, type Board, type Cell } from './game';
import { OFFLINE_STATS_KEY } from './offline-stats';
import { ROOM_NAME_KEY } from './room-name';

vi.mock('./sound', () => ({
  playSound: vi.fn(),
}));

// Any 9-cell configuration — the transition invariants below hold for
// arbitrary boards, not just reachable ones, which is the point of property
// testing the reducer face.
const arbBoard = fc
  .array(fc.constantFrom<Cell>('X', 'O', null), {
    minLength: 9,
    maxLength: 9,
  })
  .map((cells) => cells as unknown as Board);

const arbIndex = fc.integer({ min: 0, max: 8 });

function filledCount(board: Board): number {
  return board.filter((c) => c !== null).length;
}

function snapshot(): Record<string, unknown> {
  const s = useGameStore.getState();
  return {
    phase: s.phase,
    mode: s.mode,
    board: s.board,
    currentPlayer: s.currentPlayer,
    winner: s.winner,
    winLine: s.winLine,
    roomName: s.roomName,
    outcomeError: s.outcomeError,
  };
}

function seedState(overrides: Partial<Parameters<typeof useGameStore.setState>[0]>): void {
  localStorage.removeItem(OFFLINE_STATS_KEY);
  localStorage.removeItem(ROOM_NAME_KEY);
  useGameStore.setState({
    phase: 'playing',
    mode: 'offline',
    board: createEmptyBoard(),
    currentPlayer: 'X',
    winner: null,
    winLine: null,
    roomName: null,
    outcomeError: null,
    ...overrides,
  });
  useGameStore.getState().__resetInternalForTests();
}

describe('property: store reducer invariants', () => {
  it('makeMove on an occupied cell is a full no-op', async () => {
    await fc.assert(
      fc.asyncProperty(arbBoard, arbIndex, async (board, idx) => {
        fc.pre(board[idx] !== null);
        seedState({ board });
        const before = snapshot();
        await useGameStore.getState().makeMove(idx);
        expect(snapshot()).toEqual(before);
      }),
      { numRuns: 100 },
    );
  });

  it('makeMove outside the playing phase is a full no-op', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbBoard,
        arbIndex,
        fc.constantFrom<'idle' | 'won' | 'drawn'>('idle', 'won', 'drawn'),
        async (board, idx, phase) => {
          seedState({ board, phase });
          const before = snapshot();
          await useGameStore.getState().makeMove(idx);
          expect(snapshot()).toEqual(before);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a legal move fills exactly one more cell and only ever lands on playing/won/drawn', async () => {
    await fc.assert(
      fc.asyncProperty(arbBoard, arbIndex, async (board, idx) => {
        fc.pre(board[idx] === null);
        seedState({ board });
        const before = useGameStore.getState();
        await useGameStore.getState().makeMove(idx);
        const after = useGameStore.getState();
        // Exactly one previously-empty cell got filled, nothing else moved.
        expect(filledCount(after.board)).toBe(filledCount(before.board) + 1);
        for (let i = 0; i < 9; i++) {
          if (before.board[i] !== null) expect(after.board[i]).toBe(before.board[i]);
        }
        expect(['playing', 'won', 'drawn']).toContain(after.phase);
        if (after.phase === 'playing') {
          expect(after.currentPlayer).toBe('O'); // otherPlayer('X')
          expect(after.winner).toBeNull();
          expect(after.winLine).toBeNull();
        } else if (after.phase === 'won') {
          expect(after.winner).not.toBeNull();
        } else {
          expect(after.winner).toBeNull();
          expect(after.board.every((c) => c !== null)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it('startGame always lands on the canonical fresh state for the requested mode', async () => {
    await fc.assert(
      fc.asyncProperty(arbBoard, fc.constantFrom<'online' | 'offline'>('online', 'offline'), async (board, mode) => {
        // Seed from an arbitrary dirty state — startGame must still reset.
        seedState({
          board,
          phase: 'won',
          winner: 'O',
          winLine: [0, 1, 2],
          roomName: 'leftover-room',
          outcomeError: { reason: 'http-error', at: 123 },
        });
        useGameStore.getState().startGame(mode === 'offline' ? 'offline' : undefined);
        const s = useGameStore.getState();
        expect(s.phase).toBe('playing');
        expect(s.mode).toBe(mode);
        expect(s.board).toEqual(createEmptyBoard());
        expect(['X', 'O']).toContain(s.currentPlayer);
        expect(s.winner).toBeNull();
        expect(s.winLine).toBeNull();
        expect(s.outcomeError).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it('restart always lands on the canonical idle state (mode preserved)', async () => {
    await fc.assert(
      fc.asyncProperty(arbBoard, fc.constantFrom<'online' | 'offline'>('online', 'offline'), async (board, mode) => {
        seedState({
          board,
          mode,
          phase: 'drawn',
          roomName: 'leftover-room',
          outcomeError: { reason: 'network-error', at: 456 },
        });
        useGameStore.getState().restart();
        const s = useGameStore.getState();
        expect(s.phase).toBe('idle');
        expect(s.mode).toBe(mode);
        expect(s.board).toEqual(createEmptyBoard());
        expect(s.currentPlayer).toBeNull();
        expect(s.winner).toBeNull();
        expect(s.winLine).toBeNull();
        expect(s.outcomeError).toBeNull();
      }),
      { numRuns: 100 },
    );
  });
});
