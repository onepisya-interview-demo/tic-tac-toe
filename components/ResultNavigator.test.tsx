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
    roomName: null,
  });
  useGameStore.getState().__resetInternalForTests();
});

describe('components/ResultNavigator (W2 ulw-room-migration-home-landing: ?room=)', () => {
  it('N1: mount phase=idle → migration to won pushes exactly once with ?room=', () => {
    useGameStore.setState({ roomName: 'alice' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/result?room=alice');
  });

  it('N2: mount phase=playing → migration to drawn pushes exactly once', () => {
    useGameStore.setState({ roomName: 'bob', phase: 'playing', currentPlayer: 'X' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'drawn' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/result?room=bob');
  });

  it('N3: mount phase=won (stale residue from /result soft-nav) does NOT push (F2 dead-loop fix)', () => {
    useGameStore.setState({
      roomName: 'alice',
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
      roomName: 'alice',
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
      roomName: 'alice',
      phase: 'won',
      winner: 'X',
      winLine: [0, 1, 2],
    });
    render(<ResultNavigator mode="online" />);
    expect(routerPush).not.toHaveBeenCalled();
    act(() => {
      useGameStore.setState({ phase: 'idle' });
    });
    act(() => {
      useGameStore.setState({ phase: 'playing', currentPlayer: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X', winLine: [3, 4, 5] });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/result?room=alice');
  });

  it('N6: mode=offline never pushes (offline keeps in-page flow)', () => {
    useGameStore.setState({ roomName: 'alice', mode: 'offline' });
    render(<ResultNavigator mode="offline" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('N7: roomName=null or empty does not push (defensive guard)', () => {
    useGameStore.setState({ roomName: null });
    const { unmount } = render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
    unmount();
    routerPush.mockClear();
    useGameStore.setState({ roomName: '' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('N8: StrictMode double mount + phase migration pushes exactly once', () => {
    useGameStore.setState({ roomName: 'alice', phase: 'idle' });
    render(
      <StrictMode>
        <ResultNavigator mode="online" />
      </StrictMode>,
    );
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/result?room=alice');
  });

  it('N9: phase stays won across effect re-runs (e.g. roomName change) does not double-push', () => {
    useGameStore.setState({ roomName: 'alice' });
    const { rerender } = render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    rerender(<ResultNavigator mode="online" />);
    expect(routerPush).toHaveBeenCalledTimes(1);
    act(() => {
      useGameStore.setState({ roomName: 'alice-renamed' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
  });

  it('N10: witnessed won → restart(idle) → playing → won again pushes exactly twice', () => {
    useGameStore.setState({ roomName: 'alice' });
    const { rerender } = render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
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
    expect(routerPush).toHaveBeenLastCalledWith('/result?room=alice');
  });

  it('N+: URL-unsafe characters in the room name are percent-encoded', () => {
    useGameStore.setState({ roomName: '房 间' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledWith('/result?room=%E6%88%BF%20%E9%97%B4');
  });
});
