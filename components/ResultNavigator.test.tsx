import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { act } from 'react';
import { ResultNavigator } from './ResultNavigator';
import { useGameStore } from '@/lib/store';

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  routerPush.mockClear();
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

describe('components/ResultNavigator (ulw-result-play-again-loop F2, branches N1-N10)', () => {
  it('N1: mount phase=idle → migration to won pushes exactly once with ?name=', () => {
    useGameStore.setState({ playerName: 'alice' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/result?name=alice');
  });

  it('N2: mount phase=playing → migration to drawn pushes exactly once', () => {
    useGameStore.setState({ playerName: 'bob', phase: 'playing', currentPlayer: 'X' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'drawn' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/result?name=bob');
  });

  it('N3: mount phase=won (stale residue from /result soft-nav) does NOT push (F2 dead-loop fix)', () => {
    // The dead-loop root: /result → click play-again → soft-nav to
    // /online. Zustand module singleton retains phase='won'.
    // ResultNavigator mounts seeing the stale terminal phase and
    // MUST NOT push /result again.
    useGameStore.setState({
      playerName: 'alice',
      phase: 'won',
      winner: 'X',
      winLine: [0, 1, 2],
      board: [
        'X', 'X', 'X',
        'O', null, null,
        null, null, null,
      ],
    });
    render(<ResultNavigator mode="online" />);
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('N4: mount phase=drawn (stale residue from /result soft-nav) does NOT push', () => {
    useGameStore.setState({
      playerName: 'alice',
      phase: 'drawn',
      winner: null,
      winLine: null,
      board: [
        'X', 'O', 'X',
        'X', 'O', 'O',
        'O', 'X', 'X',
      ],
    });
    render(<ResultNavigator mode="online" />);
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('N5: mount phase=won → reset to playing → won again pushes exactly once (second is witnessed)', () => {
    useGameStore.setState({
      playerName: 'alice',
      phase: 'won',
      winner: 'X',
      winLine: [0, 1, 2],
    });
    render(<ResultNavigator mode="online" />);
    // Stale mount: no push yet.
    expect(routerPush).not.toHaveBeenCalled();
    // Restart → idle → startGame → playing (witnessed transition).
    act(() => {
      useGameStore.setState({ phase: 'idle' });
    });
    act(() => {
      useGameStore.setState({ phase: 'playing', currentPlayer: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
    // Witnessed: playing → won fires one push.
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X', winLine: [3, 4, 5] });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/result?name=alice');
  });

  it('N6: mode=offline never pushes (offline keeps in-page flow)', () => {
    useGameStore.setState({ playerName: 'alice', mode: 'offline' });
    render(<ResultNavigator mode="offline" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('N7: playerName=null or empty does not push (defensive guard)', () => {
    useGameStore.setState({ playerName: null });
    const { unmount } = render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
    unmount();
    routerPush.mockClear();
    useGameStore.setState({ playerName: '' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('N8: StrictMode double mount + phase migration pushes exactly once', () => {
    // StrictMode intentionally double-invokes the mount effect. The
    // first run captures prev=null and exits early. The second run
    // sees the phase the first run wrote, so the ref stays in
    // sync. The post-mount transition to 'won' is then witnessed
    // exactly once.
    useGameStore.setState({ playerName: 'alice', phase: 'idle' });
    render(
      <StrictMode>
        <ResultNavigator mode="online" />
      </StrictMode>,
    );
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/result?name=alice');
  });

  it('N9: phase stays won across effect re-runs (e.g. playerName change) does not double-push', () => {
    useGameStore.setState({ playerName: 'alice' });
    const { rerender } = render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    // Re-render the navigator with no phase change → no extra push.
    rerender(<ResultNavigator mode="online" />);
    expect(routerPush).toHaveBeenCalledTimes(1);
    // Change playerName while phase stays won → effect reruns but
    // prev was terminal → still no extra push.
    act(() => {
      useGameStore.setState({ playerName: 'alice-renamed' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
  });

  it('N10: witnessed won → restart(idle) → playing → won again pushes exactly twice', () => {
    useGameStore.setState({ playerName: 'alice' });
    const { rerender } = render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    // Restart chain: idle → playing (witnessed by the navigator, no
    // push — non-terminal). Then won again → push #2.
    act(() => {
      useGameStore.setState({ phase: 'idle' });
    });
    rerender(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'playing', currentPlayer: 'X' });
    });
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'O', winLine: [6, 7, 8] });
    });
    expect(routerPush).toHaveBeenCalledTimes(2);
    expect(routerPush).toHaveBeenLastCalledWith('/result?name=alice');
  });

  it('N+: URL-unsafe characters in the player name are percent-encoded', () => {
    // Edge case kept from the W3 suite: encoding is orthogonal to
    // the F2 migration guard.
    useGameStore.setState({ playerName: '名 字' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledWith('/result?name=%E5%90%8D%20%E5%AD%97');
  });
});
