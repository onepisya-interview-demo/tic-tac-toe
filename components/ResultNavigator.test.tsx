import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { act } from 'react';
import { ResultNavigator } from './ResultNavigator';
import { JUST_WON_SENTINEL_KEY } from './ResultCelebration';
import { useGameStore } from '@/lib/store';
import type { Board } from '@/lib/game';

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
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

  // W-A (ulw-result-win-celebration D-1/D-2): won writes the one-shot
  // sentinel before the push; drawn and every guarded-off path never do.
  it('N11: witnessed won → writes the just-won sentinel before pushing (D-1)', () => {
    useGameStore.setState({ roomName: 'alice' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBe('1');
    expect(routerPush).toHaveBeenCalledTimes(1);
  });

  it('N12: witnessed drawn → pushes but never writes the sentinel (D-2 draws have no celebration)', () => {
    useGameStore.setState({ roomName: 'bob', phase: 'playing', currentPlayer: 'X' });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'drawn' });
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
  });

  it('N13: offline won → no push, no sentinel (guarded-off path stays celebration-free)', () => {
    useGameStore.setState({ roomName: 'alice', mode: 'offline' });
    render(<ResultNavigator mode="offline" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
  });

  it('N14: won with empty roomName → no push, no sentinel (defensive guard covers the write too)', () => {
    useGameStore.setState({ roomName: null });
    render(<ResultNavigator mode="online" />);
    act(() => {
      useGameStore.setState({ phase: 'won', winner: 'X' });
    });
    expect(routerPush).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
  });

  it('N15: stale won on mount (no witnessed transition) → no push, no sentinel rewrite', () => {
    useGameStore.setState({
      roomName: 'alice',
      phase: 'won',
      winner: 'X',
      winLine: [0, 1, 2],
    });
    render(<ResultNavigator mode="online" />);
    expect(routerPush).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
  });
});

// ── W-F ordering (ulw-online-reset-and-result-fresh D-6/D-7) ──
// push 必须等在途记局写落定；哨兵写入随 await 后移（紧邻原子）。
// seam 只能由生产路径播种：具名 online makeMove + 受控 fetch mock。
describe('components/ResultNavigator ordering (W-F: await outcome write before push)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const WIN_BOARD: Board = [
    'X', null, null,
    null, 'X', null,
    null, null, null,
  ];
  const DRAW_BOARD: Board = [
    'X', 'O', 'X',
    'X', 'O', 'O',
    'O', 'X', null,
  ];

  function mockDeferredFetch(): {
    settle: (response: Response) => void;
    fail: (err: unknown) => void;
  } {
    const deferred: {
      settle?: (response: Response) => void;
      fail?: (err: unknown) => void;
    } = {};
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve, reject) => {
          deferred.settle = resolve;
          deferred.fail = reject;
        }),
    );
    // 经 holder 转发：fetch 只在 makeMove 时才被调用，executor 赋值
    // 晚于本函数返回——直接快照 settle/fail 会拿到 undefined。
    return {
      settle: (response) => deferred.settle?.(response),
      fail: (err) => deferred.fail?.(err),
    };
  }

  function seedPlaying(board: Board, room: string): void {
    useGameStore.setState({
      roomName: room,
      mode: 'online',
      phase: 'playing',
      currentPlayer: 'X',
      board,
    });
  }

  it('W-F1: 记局写未落定不 push；落定后恰一次 push，哨兵写入在 await 后', async () => {
    const deferred = mockDeferredFetch();
    seedPlaying(WIN_BOARD, 'alice');
    render(<ResultNavigator mode="online" />);
    await act(async () => {
      void useGameStore.getState().makeMove(8);
    });
    expect(useGameStore.getState().phase).toBe('won');
    // 写未落定：不 push、不写哨兵。
    expect(routerPush).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
    await act(async () => {
      deferred.settle(new Response(
        JSON.stringify({ stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ));
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/result?room=alice');
    // 哨兵在 await 落定后、push 前就位（紧邻原子，D-7）。
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBe('1');
  });

  it('W-F2: 记局写失败（fetch 网络错）也落定——仍 push，哨兵照写', async () => {
    const deferred = mockDeferredFetch();
    seedPlaying(WIN_BOARD, 'alice');
    render(<ResultNavigator mode="online" />);
    await act(async () => {
      void useGameStore.getState().makeMove(8);
    });
    expect(routerPush).not.toHaveBeenCalled();
    await act(async () => {
      deferred.fail(new TypeError('Failed to fetch'));
    });
    // 导航不被写失败卡死（awaitOutcomeWrite 吞错落定）。
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/result?room=alice');
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBe('1');
  });

  it('W-F3: 落定前卸载——落定后不 push、不写哨兵（卸载竞态 guard）', async () => {
    const deferred = mockDeferredFetch();
    seedPlaying(WIN_BOARD, 'alice');
    const { unmount } = render(<ResultNavigator mode="online" />);
    await act(async () => {
      void useGameStore.getState().makeMove(8);
    });
    expect(routerPush).not.toHaveBeenCalled();
    unmount();
    await act(async () => {
      deferred.settle(new Response(
        JSON.stringify({ stats: { totalGames: 1, xWins: 1, oWins: 0, draws: 0, currentStreak: 1 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ));
    });
    // 卸载后不得 push（红线），哨兵同样不得泄漏。
    expect(routerPush).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
  });

  it('W-F4: 平局 + 在途写——落定后 push，哨兵永不写（D-2）', async () => {
    const deferred = mockDeferredFetch();
    seedPlaying(DRAW_BOARD, 'bob');
    render(<ResultNavigator mode="online" />);
    await act(async () => {
      void useGameStore.getState().makeMove(8);
    });
    expect(useGameStore.getState().phase).toBe('drawn');
    expect(routerPush).not.toHaveBeenCalled();
    await act(async () => {
      deferred.settle(new Response(
        JSON.stringify({ stats: { totalGames: 1, xWins: 0, oWins: 0, draws: 1, currentStreak: 0 } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ));
    });
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
  });
});
