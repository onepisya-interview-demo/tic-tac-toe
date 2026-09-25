import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// DeleteRoomButton (ulw-room-lifecycle T-N2 B 删除房间):
//   type-to-confirm 输入框 + DELETE /api/rooms/{room}；200/404 走
//   本地清理路径，5xx/network 留住弹框、红条提示、零本地副作用。
// Coverage (D1..D6) maps the brief verbatim.

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

import { DeleteRoomButton } from './DeleteRoomButton';

const fetchSpy = vi.spyOn(globalThis, 'fetch');

function okJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function problemJson(title: string, status: number, typeUrl: string): Response {
  return new Response(JSON.stringify({ type: typeUrl, title, status }), {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

beforeEach(() => {
  fetchSpy.mockReset();
  routerPush.mockReset();
});

afterEach(() => {
  cleanup();
  fetchSpy.mockReset();
  routerPush.mockReset();
});

describe('components/DeleteRoomButton (T-N2 删除房间, ulw-room-lifecycle)', () => {
  it('D1: dialog 默认关，按钮 click 才打开（data-testid="delete-room-dialog"）', async () => {
    const user = userEvent.setup();
    render(<DeleteRoomButton room="alice" />);
    const dlg = screen.getByTestId('delete-room-dialog');
    expect(dlg).not.toHaveAttribute('open');
    await user.click(screen.getByTestId('delete-room-button'));
    expect(dlg).toHaveAttribute('open');
    expect(screen.getByTestId('delete-room-title')).toHaveTextContent('删除房间 alice？');
  });

  it('D2: type-to-confirm 输入精确匹配（trim）→ 主 CTA 解禁', async () => {
    const user = userEvent.setup();
    render(<DeleteRoomButton room="alice" />);
    await user.click(screen.getByTestId('delete-room-button'));
    const input = screen.getByTestId('delete-room-input');
    const cta = screen.getByTestId('delete-room-confirm');
    expect(cta).toBeDisabled();
    // 大小写错 — 仍 disabled（精确大小写）
    await user.type(input, 'Alice');
    expect(cta).toBeDisabled();
    // 含尾部空白 — trim 后等于 'alice'，按契约应启用主 CTA
    await user.clear(input);
    await user.type(input, 'alice ');
    expect(cta).not.toBeDisabled();
    // 含字符错误 — 失败
    await user.clear(input);
    await user.type(input, 'alic');
    expect(cta).toBeDisabled();
    // 正确输入 → 解禁
    await user.clear(input);
    await user.type(input, 'alice');
    expect(cta).not.toBeDisabled();
    // 探针（spec 要求）：typo 状态下 fetch 不被调用（确认按钮 disabled，零网络写）
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('D3: DELETE 200 → setRoomName(null) + resetOfflineStats + router.push + dialog 关', async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValue(okJson({ ok: true }, 200));
    render(<DeleteRoomButton room="alice" />);
    await user.click(screen.getByTestId('delete-room-button'));
    await user.type(screen.getByTestId('delete-room-input'), 'alice');
    await user.click(screen.getByTestId('delete-room-confirm'));
    await waitFor(() =>
      expect(screen.getByTestId('delete-room-dialog')).not.toHaveAttribute('open'),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/rooms/alice');
    expect((init.method ?? '').toUpperCase()).toBe('DELETE');
    expect(setRoomName).toHaveBeenCalledTimes(1);
    expect(setRoomName).toHaveBeenCalledWith(null);
    expect(resetOfflineStats).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/');
  });

  it('D4: DELETE 404 → 走幂等清理路径（setRoomName(null) + resetOfflineStats + router.push）', async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValue(
      problemJson('Room not found', 404, 'https://docs.example.com/probs/room-not-found'),
    );
    render(<DeleteRoomButton room="ghost" />);
    await user.click(screen.getByTestId('delete-room-button'));
    await user.type(screen.getByTestId('delete-room-input'), 'ghost');
    await user.click(screen.getByTestId('delete-room-confirm'));
    await waitFor(() =>
      expect(screen.getByTestId('delete-room-dialog')).not.toHaveAttribute('open'),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(setRoomName).toHaveBeenCalledTimes(1);
    expect(setRoomName).toHaveBeenCalledWith(null);
    expect(resetOfflineStats).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith('/');
  });

  it('D5: DELETE 5xx → Alert 红条 + 弹框保持 + 零 setRoomName/resetOfflineStats/router.push', async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValue(
      problemJson('Internal Server Error', 500, 'https://docs.example.com/probs/internal'),
    );
    render(<DeleteRoomButton room="alice" />);
    await user.click(screen.getByTestId('delete-room-button'));
    await user.type(screen.getByTestId('delete-room-input'), 'alice');
    await user.click(screen.getByTestId('delete-room-confirm'));
    const err = await screen.findByTestId('delete-room-error');
    expect(err).toHaveTextContent('删除失败，请稍后再试');
    // 弹框保持打开
    expect(screen.getByTestId('delete-room-dialog')).toHaveAttribute('open');
    // 零本地副作用：失败路径不得留下半清除态
    expect(setRoomName).not.toHaveBeenCalled();
    expect(resetOfflineStats).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('D5b: DELETE network-error（fetch reject）→ Alert + 弹框保持 + 零本地副作用', async () => {
    const user = userEvent.setup();
    fetchSpy.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    render(<DeleteRoomButton room="alice" />);
    await user.click(screen.getByTestId('delete-room-button'));
    await user.type(screen.getByTestId('delete-room-input'), 'alice');
    await user.click(screen.getByTestId('delete-room-confirm'));
    const err = await screen.findByTestId('delete-room-error');
    expect(err).toHaveTextContent('删除失败，请稍后再试');
    expect(screen.getByTestId('delete-room-dialog')).toHaveAttribute('open');
    expect(setRoomName).not.toHaveBeenCalled();
    expect(resetOfflineStats).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('D6: ESC（cancel 事件）→ 弹框关 + 零 fetch + 零 setRoomName/resetOfflineStats/router.push', async () => {
    const user = userEvent.setup();
    render(<DeleteRoomButton room="alice" />);
    await user.click(screen.getByTestId('delete-room-button'));
    const dlg = screen.getByTestId('delete-room-dialog');
    expect(dlg).toHaveAttribute('open');
    fireEvent(dlg, new Event('cancel'));
    await waitFor(() => expect(dlg).not.toHaveAttribute('open'));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(setRoomName).not.toHaveBeenCalled();
    expect(resetOfflineStats).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('adversarial: 错误大小写输入不会触发 fetch（spec 要求 — disabled 阻断）', async () => {
    const user = userEvent.setup();
    fetchSpy.mockResolvedValue(okJson({ ok: true }, 200));
    render(<DeleteRoomButton room="alice" />);
    await user.click(screen.getByTestId('delete-room-button'));
    // 大小写错 — confirm 仍 disabled
    await user.type(screen.getByTestId('delete-room-input'), 'Alice');
    expect(screen.getByTestId('delete-room-confirm')).toBeDisabled();
    // 即使用 user.click 触发，浏览器对 disabled button 抛错则被 vitest 捕获；
    // 这里强制 query 验证 disabled 状态而非真正点击：点击逻辑由其他 case 覆盖。
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
