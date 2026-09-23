import { useGameStore } from '@/lib/store';
import { createEmptyBoard } from '@/lib/game';

/**
 * Reset `useGameStore` to its full safe-default state.
 *
 * Use from `beforeEach`/`afterEach` in component tests so each test
 * starts from the same default. Mirrors the `initial` constant in
 * `lib/store.ts` and additionally calls `__resetInternalForTests()` to
 * clear the module-level offline-stats cache.
 *
 * Why a single helper: store fields drift (roomName, outcomeError are
 * past cases; GameShell's afterEach currently omits mode/board/
 * winLine/roomName/outcomeError) when hand-rolled reset blocks
 * scattered across components tests fail to track new fields.
 * Centralizing here means future `GameState` fields propagate so long
 * as `lib/store.ts`'s `initial` stays in sync with this function.
 */
export function resetStore(): void {
  useGameStore.setState({
    phase: 'idle',
    mode: 'online',
    board: createEmptyBoard(),
    currentPlayer: null,
    winner: null,
    winLine: null,
    roomName: null,
    outcomeError: null,
  });
  useGameStore.getState().__resetInternalForTests();
}
