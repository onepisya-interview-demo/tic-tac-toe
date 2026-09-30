import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// LeaveRoomButton (ulw-room-lifecycle T-N2 A 退出房间):
//   零网络写，本机缓存清理 + 路由回首页的轻确认弹层。
// Coverage (L1..L4) matches the brief; assertion strategy mirrors
// ResetRoomStatsButton.test.tsx with router.push replacing refresh
// (no server round-trip on leave, per plan §T-N2「退出房间」AC).

const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
}));

// useGameStore mock: production calls both `useGameStore(selector)` inside
// render and `useGameStore.getState()` inside event handlers. The mock exposes
// both shapes by attaching getState to the selector function. Everything lives
// inside vi.hoisted so vi.mock's factory closure can resolve the symbols
// regardless of top-of-file hoisting order.
const { setRoomName, resetOfflineStats, useGameStoreMock } = vi.hoisted(() => {
  const setRoomName = vi.fn();
  const resetOfflineStats = vi.fn();
  const state = { setRoomName, resetOfflineStats };
  type Store = typeof state;
  const useGameStoreMock: ((selector: (s: Store) => unknown) => unknown) & {
    getState: () => Store;
  } = ((selector: (s: Store) => unknown) => selector(state)) as never;
  useGameStoreMock.getState = () => state;
  return { setRoomName, resetOfflineStats, useGameStoreMock };
});
vi.mock('@/lib/store', () => ({
  useGameStore: useGameStoreMock,
}));

import { LeaveRoomButton } from './LeaveRoomButton';

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  fetchSpy.mockReset();
  routerPush.mockReset();
});

afterEach(() => {
  cleanup();
  fetchSpy.mockReset();
  routerPush.mockReset();
});

describe('components/LeaveRoomButton (T-N2 退出房间, ulw-room-lifecycle)', () => {
  it('L1: 点按 button 打开 dialog（data-testid="leave-room-dialog"）', async () => {
    const user = userEvent.setup();
    render(<LeaveRoomButton room="alice" />);
    const dlg = screen.getByTestId('leave-room-dialog');
    expect(dlg).not.toHaveAttribute('open');
    await user.click(screen.getByTestId('leave-room-button'));
    expect(dlg).toHaveAttribute('open');
    // 标题与描述渲染确认文本已 visible
    expect(screen.getByTestId('leave-room-title')).toHaveTextContent('退出当前房间？');
    expect(screen.getByTestId('leave-room-desc')).toHaveTextContent('退出');
  });

  it('L2: 取消 → 弹框关 + 零 fetch + zero setRoomName/resetOfflineStats/router.push', async () => {
    const user = userEvent.setup();
    render(<LeaveRoomButton room="alice" />);
    await user.click(screen.getByTestId('leave-room-button'));
    expect(screen.getByTestId('leave-room-dialog')).toHaveAttribute('open');
    await user.click(screen.getByTestId('leave-room-cancel'));
    await waitFor(() =>
      expect(screen.getByTestId('leave-room-dialog')).not.toHaveAttribute('open'),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setRoomName).not.toHaveBeenCalled();
    expect(resetOfflineStats).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('L3: 确认 → 弹框关 + setRoomName(null) 恰 1 次 + resetOfflineStats 恰 1 次 + router.push("/") 恰 1 次 + 零 fetch', async () => {
    const user = userEvent.setup();
    render(<LeaveRoomButton room="alice" />);
    await user.click(screen.getByTestId('leave-room-button'));
    await user.click(screen.getByTestId('leave-room-confirm'));
    await waitFor(() =>
      expect(screen.getByTestId('leave-room-dialog')).not.toHaveAttribute('open'),
    );
    expect(setRoomName).toHaveBeenCalledTimes(1);
    expect(setRoomName).toHaveBeenCalledWith(null);
    expect(resetOfflineStats).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/');
    // 离开零网络写：fetch 全程未触发。
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('L4: ESC（cancel 事件）→ 弹框关 + 零网络 + 零 setRoomName/resetOfflineStats/router.push', async () => {
    const user = userEvent.setup();
    render(<LeaveRoomButton room="alice" />);
    await user.click(screen.getByTestId('leave-room-button'));
    const dlg = screen.getByTestId('leave-room-dialog');
    expect(dlg).toHaveAttribute('open');
    fireEvent(dlg, new Event('cancel'));
    await waitFor(() => expect(dlg).not.toHaveAttribute('open'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setRoomName).not.toHaveBeenCalled();
    expect(resetOfflineStats).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('adversarial: extra-typo 不会触发（仅控制 spec 演示；真组件无 input）', () => {
    // LeaveRoomButton 无 type-to-confirm 输入；该按钮无 typo 攻击面。
    // 该探针占位断言组件渲染输入以外的零声明性副作用：
    // 不应存在 type="text" 输入框，否则设计上误植入 type-to-confirm。
    const { container } = render(<LeaveRoomButton room="alice" />);
    expect(container.querySelector('input[type="text"]')).toBeNull();
  });
});
