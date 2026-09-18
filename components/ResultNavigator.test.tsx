import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
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

describe('components/ResultNavigator (W3 phase-driven nav)', () => {
  it('pushes /result?name=<name> on online win', () => {
    useGameStore.setState({ playerName: 'alice' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledWith('/result?name=alice');
  });

  it('pushes /result?name=<name> on online draw', () => {
    useGameStore.setState({ playerName: 'bob' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'drawn' });
    });
    expect(routerPush).toHaveBeenCalledWith('/result?name=bob');
  });

  it('encodes URL-unsafe characters in the name', () => {
    useGameStore.setState({ playerName: '名 字' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledWith('/result?name=%E5%90%8D%20%E5%AD%97');
  });

  it('does not push when mode is offline (offline keeps in-page flow)', () => {
    useGameStore.setState({ playerName: 'alice', mode: 'offline' });
    render(<ResultNavigator mode="offline" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('does not push when playerName is empty (defensive guard)', () => {
    useGameStore.setState({ playerName: null });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('does not double-push when phase stays won across effect re-runs', () => {
    useGameStore.setState({ playerName: 'alice' });
    const { rerender } = render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    // Re-render the navigator with no phase change → no extra push.
    rerender(<ResultNavigator mode="online" />);
    expect(routerPush).toHaveBeenCalledTimes(1);
  });

  it('clears the pushed-phase ref on phase→idle so a new game pushes again', () => {
    useGameStore.setState({ playerName: 'alice' });
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
      useGameStore.setState({ phase: 'drawn' });
    });
    expect(routerPush).toHaveBeenCalledTimes(2);
    expect(routerPush).toHaveBeenLastCalledWith('/result?name=alice');
  });
});
