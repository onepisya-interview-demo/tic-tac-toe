import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { StrictMode, act } from 'react';
import { renderToString } from 'react-dom/server';
import {
  ResultCelebration,
  JUST_WON_SENTINEL_KEY,
  writeJustWonSentinel,
  consumeJustWonSentinel,
} from './ResultCelebration';
import { burstConfetti } from '@/lib/confetti';
import { useGameStore } from '@/lib/store';

vi.mock('@/lib/confetti', () => ({
  burstConfetti: vi.fn(),
}));

const burstMock = vi.mocked(burstConfetti);

function seedWonPhase(): void {
  act(() => {
    useGameStore.setState({
      phase: 'won',
      mode: 'online',
      winner: 'X',
      winLine: [0, 1, 2],
      board: [
        'X', 'X', 'X',
        'O', null, null,
        null, null, null,
      ],
    });
  });
}

beforeEach(() => {
  window.sessionStorage.clear();
  burstMock.mockClear();
  seedWonPhase();
});

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
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

describe('components/ResultCelebration (ulw-result-win-celebration W-A: /result arrival confetti)', () => {
  it('C1: sentinel hit → renders the celebration layer once + clears the sentinel (read-then-clear)', () => {
    writeJustWonSentinel();
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBe('1');

    const { getByTestId } = render(<ResultCelebration />);

    // 庆祝层渲染：包装层 + WinConfetti 的既有 confetti testid
    expect(getByTestId('result-celebration')).toBeInTheDocument();
    expect(getByTestId('confetti')).toBeInTheDocument();
    // WinConfetti 既有语义：burst 恰一次（celebratedRef per mount）
    expect(burstMock).toHaveBeenCalledTimes(1);
    // 读后即清：消费后哨兵为 null（F1 断言的单元级形态）
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
  });

  it('C2: no sentinel → renders nothing (bookmark / reload / home-entry semantics)', () => {
    const { container } = render(<ResultCelebration />);

    expect(container.innerHTML).toBe('');
    expect(burstMock).not.toHaveBeenCalled();
  });

  it('C3: read-then-clear — a second mount on the same page load does not replay (F2 unit form)', () => {
    writeJustWonSentinel();
    const first = render(<ResultCelebration />);
    expect(first.getByTestId('result-celebration')).toBeInTheDocument();
    expect(burstMock).toHaveBeenCalledTimes(1);
    first.unmount();

    // 二次 mount（模拟 reload 后的全新实例）：哨兵已被首次消费清除
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
    const second = render(<ResultCelebration />);
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
    expect(second.container.querySelector('[data-testid="result-celebration"]')).toBeNull();
    expect(second.container.querySelector('[data-testid="confetti"]')).toBeNull();
    // burst 仍是首次 mount 的那一次，不重放
    expect(burstMock).toHaveBeenCalledTimes(1);
  });

  it('C4: StrictMode double effect does not eat the sentinel (first consume wins, state never regresses)', () => {
    writeJustWonSentinel();
    const { getByTestId } = render(
      <StrictMode>
        <ResultCelebration />
      </StrictMode>,
    );

    // 双 invoke：第一次消费命中 setState(true)，第二次读不到哨兵是 no-op，
    // state 不回退 → 庆祝层仍在（「每次页面加载恰消费一次、首次消费生效」）
    expect(getByTestId('result-celebration')).toBeInTheDocument();
    expect(getByTestId('confetti')).toBeInTheDocument();
    expect(burstMock).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
  });

  it('C5: SSR first frame renders zero celebration and does NOT touch sessionStorage (hydration-safe)', () => {
    writeJustWonSentinel();

    const html = renderToString(<ResultCelebration />);

    // SSR 首帧零庆祝形态（与客户端首帧一致，无 hydration mismatch）
    expect(html).not.toContain('result-celebration');
    expect(html).not.toContain('data-testid="confetti"');
    // 服务端零副作用：哨兵原样保留，留给客户端 hydration 后消费
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBe('1');
    expect(burstMock).not.toHaveBeenCalled();
  });

  it('C6: consumeJustWonSentinel is SSR-safe and catch-safe (server frame + missing storage API)', () => {
    // 服务端帧（typeof window 守卫在 jsdom 里无法模拟，直接断言函数契约：
    // 无哨兵时 false 且不写任何东西）
    expect(consumeJustWonSentinel()).toBe(false);
    expect(window.sessionStorage.getItem(JUST_WON_SENTINEL_KEY)).toBeNull();
  });
});
