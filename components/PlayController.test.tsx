import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { act } from 'react';
import { PlayController } from './PlayController';
import { useGameStore } from '@/lib/store';

afterEach(() => {
  cleanup();
  useGameStore.setState({
    phase: 'idle',
    mode: 'online',
    board: [
      null, null, null,
      null, null, null,
      null, null, null,
    ],
    currentPlayer: null,
    winner: null,
    winLine: null,
    playerName: null,
  });
  useGameStore.getState().__resetInternalForTests();
});

/**
 * Helper: render <PlayController mode=…> and synchronously inspect the
 * store after React has flushed mount effects. The component's effect
 * mutates the store directly via `useGameStore.getState()` + the
 * snapshot's `startGame` action, so reading `useGameStore.getState()`
 * immediately after `render(...)` returns is enough — jsdom fires
 * useEffect synchronously on mount.
 */
function mountAndReadStore(mode: 'online' | 'offline' = 'online') {
  render(
    <PlayController mode={mode}>
      <div data-testid="child" />
    </PlayController>,
  );
  return useGameStore.getState();
}

describe('components/PlayController (ulw-result-play-again-loop P1-P9)', () => {
  it('P1: phase=idle + mode matches → startGame(mode) seeds a fresh game', () => {
    useGameStore.setState({ phase: 'idle', mode: 'online' });
    const after = mountAndReadStore('online');
    expect(after.phase).toBe('playing');
    expect(after.mode).toBe('online');
    expect(after.board.every((c) => c === null)).toBe(true);
    expect(after.currentPlayer).not.toBeNull();
  });

  it('P2: phase=playing + mode matches → no restart, no startGame (StartGameButton already primed)', () => {
    useGameStore.setState({
      phase: 'playing',
      mode: 'online',
      currentPlayer: 'X',
    });
    const before = useGameStore.getState().board;
    const after = mountAndReadStore('online');
    expect(after.phase).toBe('playing');
    expect(after.board).toEqual(before);
    expect(after.currentPlayer).toBe('X');
  });

  it('P3: phase=playing + mode mismatch → restart + startGame(new mode)', () => {
    useGameStore.setState({
      phase: 'playing',
      mode: 'offline',
      currentPlayer: 'O',
      winner: null,
    });
    const after = mountAndReadStore('online');
    expect(after.phase).toBe('playing');
    expect(after.mode).toBe('online');
    // restart() clears the board back to empty before startGame, so
    // the post-mount snapshot is guaranteed-empty + new first player.
    expect(after.board.every((c) => c === null)).toBe(true);
    expect(after.currentPlayer).not.toBeNull();
  });

  it('P4: phase=won + mode matches → restart + startGame (F1 new: the dead-loop fix)', () => {
    // Simulate the post-/result residue: store holds a terminal won
    // board + the matching mode — this is the exact state the
    // soft-nav from /result leaves in the singleton.
    useGameStore.setState({
      phase: 'won',
      mode: 'online',
      board: [
        'X', 'X', 'X',
        'O', null, null,
        null, null, null,
      ],
      currentPlayer: 'X',
      winner: 'X',
      winLine: [0, 1, 2],
    });
    const after = mountAndReadStore('online');
    expect(after.phase).toBe('playing');
    expect(after.winner).toBeNull();
    expect(after.winLine).toBeNull();
    expect(after.board.every((c) => c === null)).toBe(true);
    expect(after.currentPlayer).not.toBeNull();
  });

  it('P5: phase=won + mode mismatch → restart + startGame(new mode)', () => {
    useGameStore.setState({
      phase: 'won',
      mode: 'offline',
      board: [
        'O', 'O', 'O',
        'X', null, null,
        null, null, null,
      ],
      winner: 'O',
      winLine: [0, 1, 2],
    });
    const after = mountAndReadStore('online');
    expect(after.phase).toBe('playing');
    expect(after.mode).toBe('online');
    expect(after.winner).toBeNull();
    expect(after.board.every((c) => c === null)).toBe(true);
  });

  it('P6: phase=drawn + mode matches → restart + startGame (drawn is also terminal)', () => {
    useGameStore.setState({
      phase: 'drawn',
      mode: 'online',
      board: [
        'X', 'O', 'X',
        'X', 'O', 'O',
        'O', 'X', 'X',
      ],
      currentPlayer: null,
      winner: null,
      winLine: null,
    });
    const after = mountAndReadStore('online');
    expect(after.phase).toBe('playing');
    expect(after.board.every((c) => c === null)).toBe(true);
    expect(after.currentPlayer).not.toBeNull();
  });

  it('P7: mount-then-mid-game-win → no reset on the won transition (offline in-page result view)', () => {
    // Mount on a fresh idle board; the controller seeds a game.
    useGameStore.setState({ phase: 'idle', mode: 'offline' });
    const afterMount = mountAndReadStore('offline');
    expect(afterMount.phase).toBe('playing');
    // After mount, the controller's didMountRef is true; subsequent
    // phase flips to won must NOT auto-restart (that would clear the
    // board and the in-page result view).
    useGameStore.setState({
      board: [
        'X', 'X', 'X',
        'O', null, null,
        null, null, null,
      ],
      phase: 'won',
      winner: 'X',
      winLine: [0, 1, 2],
    });
    const afterWin = useGameStore.getState();
    expect(afterWin.phase).toBe('won');
    expect(afterWin.board[0]).toBe('X');
    expect(afterWin.winner).toBe('X');
    expect(afterWin.winLine).toEqual([0, 1, 2]);
  });

  it('P8: post-mount restart() → effect reruns → startGame(mode) (RestartButton chain)', () => {
    useGameStore.setState({ phase: 'idle', mode: 'online' });
    mountAndReadStore('online');
    // After mount we are in playing. User clicks RestartButton →
    // store.restart() flips phase to idle. The controller's effect
    // is in the [phase] dep list, so the rerun seeds a new game.
    act(() => {
      useGameStore.getState().restart();
    });
    // Synchronously drain: the effect's setter set phase to playing
    // again.
    expect(useGameStore.getState().phase).toBe('playing');
    expect(useGameStore.getState().board.every((c) => c === null)).toBe(true);
  });

  it('P9: StrictMode double mount + phase=idle → startGame fires exactly once (no double-seed)', () => {
    useGameStore.setState({ phase: 'idle', mode: 'online' });
    let startCalls = 0;
    // Wrap the production action with a counter so we can assert
    // that the StrictMode second mount does NOT call startGame again.
    const original = useGameStore.getState().startGame;
    const spied = (m?: 'online' | 'offline') => {
      startCalls += 1;
      return original(m);
    };
    useGameStore.setState({ startGame: spied });
    try {
      render(
        <StrictMode>
          <PlayController mode="online">
            <div data-testid="child" />
          </PlayController>
        </StrictMode>,
      );
      // The first mount run flips phase to playing + calls
      // startGame once. The StrictMode second run sees phase=playing
      // (already flipped) + didMountRef.current=true, so the
      // condition is false — startGame is NOT called again.
      expect(startCalls).toBe(1);
      expect(useGameStore.getState().phase).toBe('playing');
    } finally {
      useGameStore.setState({ startGame: original });
    }
  });
});
