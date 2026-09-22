import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetRoomStatsButton } from './ResetRoomStatsButton';

// ResetRoomStatsButton (ulw-online-reset-and-result-fresh W-R D-3/D-4):
// the confirm dialog guards a destructive server-side clear. Coverage:
//   R1: 确认流成功 → POST /stats/reset（无 body）+ 弹框关 + refresh 恰 1
//   R2: 取消 → 弹框关，零网络，零 refresh
//   R3: 404 → 就地错误「房间不存在，无法清空。」+ 弹框保持 + 零 refresh
//   R4: ESC（cancel 事件）→ 弹框关，零网络
//
// jsdom lacks showModal/close; vitest.setup.ts shims both, so the
// native-dialog open/close assertions run against the [open] attribute
// (same approach as RoomGateDialog.test.tsx).

const routerRefresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: routerRefresh }),
}));

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  fetchSpy.mockReset();
  routerRefresh.mockReset();
});

afterEach(() => {
  cleanup();
  fetchSpy.mockReset();
});

describe('components/ResetRoomStatsButton (W-R ulw-online-reset-and-result-fresh)', () => {
  it('R1: 确认流成功 → POST /stats/reset 无 body + 弹框关 + refresh 恰 1 次', async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValue(
      new Response(
        '{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0}}',
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    render(<ResetRoomStatsButton room="alice" />);
    await user.click(screen.getByTestId('reset-room-stats'));
    const dlg = screen.getByTestId('reset-room-dialog');
    expect(dlg).toHaveAttribute('open');
    expect(screen.getByTestId('reset-room-title')).toHaveTextContent('清空房间战绩？');
    expect(screen.getByTestId('reset-room-desc')).toHaveTextContent(
      '该房间的全部战绩将被清零，此操作不可撤销。',
    );
    await user.click(screen.getByTestId('reset-room-confirm'));
    await waitFor(() => expect(routerRefresh).toHaveBeenCalledTimes(1));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/rooms/alice/stats/reset');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    // 成功即关弹框（refresh 前后都不得残留 modal）。
    await waitFor(() => expect(dlg).not.toHaveAttribute('open'));
  });

  it('R2: 取消 → 弹框关 + 零网络 + 零 refresh', async () => {
    const user = userEvent.setup();
    render(<ResetRoomStatsButton room="alice" />);
    await user.click(screen.getByTestId('reset-room-stats'));
    expect(screen.getByTestId('reset-room-dialog')).toHaveAttribute('open');
    await user.click(screen.getByTestId('reset-room-cancel'));
    expect(screen.getByTestId('reset-room-dialog')).not.toHaveAttribute('open');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it('R3: 404 → 就地错误「房间不存在，无法清空。」+ 弹框保持 + 零 refresh', async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValue(
      new Response(
        '{"type":"https://docs.example.com/probs/stats-not-found","title":"Room stats not found","status":404}',
        { status: 404, headers: { 'content-type': 'application/problem+json' } },
      ),
    );
    render(<ResetRoomStatsButton room="ghost" />);
    await user.click(screen.getByTestId('reset-room-stats'));
    await user.click(screen.getByTestId('reset-room-confirm'));
    const err = await screen.findByTestId('reset-room-error');
    expect(err).toHaveTextContent('房间不存在，无法清空。');
    // 弹框保持打开，用户仍可取消；服务端零副作用 → 不刷新。
    expect(screen.getByTestId('reset-room-dialog')).toHaveAttribute('open');
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it('R4: ESC（cancel 事件）→ 弹框关 + 零网络', async () => {
    const user = userEvent.setup();
    render(<ResetRoomStatsButton room="alice" />);
    await user.click(screen.getByTestId('reset-room-stats'));
    const dlg = screen.getByTestId('reset-room-dialog');
    expect(dlg).toHaveAttribute('open');
    fireEvent(dlg, new Event('cancel'));
    await waitFor(() => expect(dlg).not.toHaveAttribute('open'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it('R5: aborted (8s 超时) → 独立文案「清空请求超时，请稍后重试」+ 弹框保持', async () => {
    // 案② d: 超时与一般网络错需独立文案, user 区分「断网」「超时」。
    // 旧实现里所有非 404 都被合并进「清空失败，请稍后再试。」, 不可区分。
    // mock 让 fetch 直接 reject aborted (代表 abort signal 已 fired) —
    // 不依赖 lib/game-net withTimeout 的 8s 计时器, 跑得快。
    const user = userEvent.setup();
    fetchSpy.mockImplementation(async () => {
      throw new DOMException('aborted', 'TimeoutError');
    });
    render(<ResetRoomStatsButton room="alice" />);
    await user.click(screen.getByTestId('reset-room-stats'));
    await user.click(screen.getByTestId('reset-room-confirm'));
    const err = await screen.findByTestId('reset-room-error');
    expect(err).toHaveTextContent('清空请求超时，请稍后重试');
    // 弹框保持打开 — user 可重试或取消。
    expect(screen.getByTestId('reset-room-dialog')).toHaveAttribute('open');
    expect(routerRefresh).not.toHaveBeenCalled();
  });

  it('R6: 5xx http-error → 通用兜底「清空失败，请稍后再试。」', async () => {
    // 案② d 兜底文案, 与 404 / aborted 三分支互不重叠。
    const user = userEvent.setup();
    fetchSpy.mockResolvedValue(
      new Response(
        '{"type":"https://docs.example.com/probs/internal","title":"Internal","status":500}',
        { status: 500, headers: { 'content-type': 'application/problem+json' } },
      ),
    );
    render(<ResetRoomStatsButton room="alice" />);
    await user.click(screen.getByTestId('reset-room-stats'));
    await user.click(screen.getByTestId('reset-room-confirm'));
    const err = await screen.findByTestId('reset-room-error');
    expect(err).toHaveTextContent('清空失败，请稍后再试。');
  });
});
