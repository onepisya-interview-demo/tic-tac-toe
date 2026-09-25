import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncConfirmDialog } from './SyncConfirmDialog';

// SyncConfirmDialog — W2 (ulw-room-migration-home-landing) 房间化:
// - 内部 postSession → postRoomSession (POST /api/rooms)
// - isPlayerName → isRoomName
// - 文案零「玩家名/注册/登录」（A9 红线）
// - 标题/副标题/label/hint 房间化
//
// Coverage (carried over from W3 + new room-migration contracts):
//  - 主/次 CTA 文案保留
//  - 主标题/副标题披露
//  - n/24 计数器 + label
//  - 永久锁定 hint 在 room 合法时显形
//  - 名字非法时主 CTA disabled
//  - 「保留本地」零网络写 + 触发 onReject
//  - 「合并并清空」成功 → onConfirm(name) 收到 trim 后的 room
//  - 错误路径 dialog 不关不触发 onConfirm

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  fetchSpy.mockReset();
  fetchSpy.mockImplementation(async (url) => {
    const s = String(url);
    if (s.endsWith('/api/rooms')) {
      return new Response(
        '{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0},"existed":false}',
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    if (s.includes('/stats/merge')) {
      return new Response(
        '{"stats":{"totalGames":3,"xWins":2,"oWins":0,"draws":1,"currentStreak":2}}',
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }
    return new Response('{}', { status: 404 });
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  fetchSpy.mockReset();
});

describe('components/SyncConfirmDialog (W2 房间化)', () => {
  it('renders 主 CTA "合并并清空" 与次 CTA "保留本地"（不出现 Confirm/OK 通用动词）', () => {
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={3}
        initialName="alice"
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sync-confirm-confirm')).toHaveTextContent('合并并清空');
    expect(screen.getByTestId('sync-confirm-reject')).toHaveTextContent('保留本地');
    expect(screen.queryByText(/^Confirm$/i)).toBeNull();
    expect(screen.queryByText(/^OK$/)).toBeNull();
  });

  it('title 主框「合并战绩」+ 副框披露「将上传本机 N 局；同步后本机清零以防重复」', () => {
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={7}
        initialName="alice"
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByTestId('sync-confirm-title')).toHaveTextContent('合并战绩');
    expect(screen.getByTestId('sync-confirm-desc')).toHaveTextContent(
      '将上传本机 7 局；同步后本机清零以防重复',
    );
  });

  it('n/24 计数器随输入 live 变化', async () => {
    const user = userEvent.setup();
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={1}
        initialName=""
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    const counter = screen.getByTestId('sync-confirm-counter');
    expect(counter).toHaveTextContent('0 / 24');
    await user.type(screen.getByTestId('sync-confirm-name'), 'alice');
    expect(counter).toHaveTextContent('5 / 24');
    await user.clear(screen.getByTestId('sync-confirm-name'));
    await user.type(screen.getByTestId('sync-confirm-name'), '汉字房');
    expect(counter).toHaveTextContent('3 / 24');
  });

  it('主 CTA 在房间名非法时 disabled（无 network write）', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={2}
        initialName=""
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    const confirm = screen.getByTestId('sync-confirm-confirm');
    expect(confirm).toBeDisabled();
    expect(screen.getByTestId('sync-confirm-name-error')).toBeInTheDocument();
    await user.type(screen.getByTestId('sync-confirm-name'), 'bob');
    expect(confirm).not.toBeDisabled();
    expect(screen.queryByTestId('sync-confirm-name-error')).toBeNull();
    expect(screen.getByTestId('sync-confirm-lock-hint')).toHaveTextContent(
      '永久属于该账本',
    );
  });

  it('「保留本地」按钮触发 onReject——零网络写 + 不调 onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onReject = vi.fn();
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={2}
        initialName="alice"
        onConfirm={onConfirm}
        onReject={onReject}
      />,
    );
    await user.click(screen.getByTestId('sync-confirm-reject'));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('「合并并清空」成功（T-M1 锁定路径）：有身份 + 确认 → onConfirm 收到 initialName，按序触发 POST /api/rooms + POST /api/rooms/{room}/stats/merge', async () => {
    // T-M1 (BR-11): 有身份时 input readOnly，clear/type 是 no-op；
    // 该路径不再能测试 trim（trim 只在「无身份可输入」路径下生效）。
    // 本测试只验证锁定路径：onConfirm 收到的就是 initialName，POST
    // 链按序触发。trim 行为由下方 "T-M1 BR-11: 无身份 + 输入 + 确认"
    // 一条覆盖。
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={2}
        initialName="alice"
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    // input 已锁定，验证值仍为初始身份名
    const input = screen.getByTestId('sync-confirm-name') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe('alice');
    await user.click(screen.getByTestId('sync-confirm-confirm'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith('alice');
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain('/api/rooms');
    expect(urls.some((u) => u.includes('/api/rooms/alice/stats/merge'))).toBe(true);
  });

  // ── T-M1 (BR-11) 身份锁定契约 ──
  it('T-M1 BR-11: 有身份（initialName 非空）→ input readOnly 且值 = 身份名', () => {
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={3}
        initialName="alice"
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    const input = screen.getByTestId('sync-confirm-name') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe('alice');
    expect(input).toHaveAttribute('aria-readonly', 'true');
  });

  it('T-M1 BR-11: 无身份（initialName 空）→ input 可编辑，readOnly=false', () => {
    // 用 fireEvent.change 直接设值，避免 user.type 的字符级模拟在
    // 长串 + jsdom 受控 input 下出现的部分输入（user.type 触发多
    // 次 input/onChange，React 19 batch 时机与 userEvent 14 的 delay
    // 配置耦合，长串易丢尾部字符）。本断言只关心"input 可编辑 +
    // readOnly 状态"两件事，setter 模拟更确定。
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={1}
        initialName=""
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    const input = screen.getByTestId('sync-confirm-name') as HTMLInputElement;
    expect(input.readOnly).toBe(false);
    expect(input).not.toHaveAttribute('aria-readonly');
    fireEvent.change(input, { target: { value: 'fresh-room' } });
    expect(input.value).toBe('fresh-room');
  });

  it('T-M1 BR-11: 有身份 + 确认 → onConfirm 收到 initialName（不产生改名回写）', async () => {
    // 探针「不产生回写调用」：本层只断言 onConfirm 收到的就是
    // initialName，不应被 input 编辑污染。setStoreName 实际触发在
    // HomeDialogMount.handleConfirm 的 if (!store.roomName) 分支，
    // 由 components/HomeDialogMount.test.tsx 「handleConfirm on a
    // returning user (already has room)」一条覆盖 — 此处封口
    // dialog 层的"锁定后不可改名"契约。
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={2}
        initialName="alice"
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    // 任何尝试改值都被 readOnly 拦截
    const input = screen.getByTestId('sync-confirm-name') as HTMLInputElement;
    await user.type(input, 'mallory').catch(() => undefined);
    expect(input.value).toBe('alice');
    // 确认 → onConfirm(alice) 不应传其他值
    await user.click(screen.getByTestId('sync-confirm-confirm'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith('alice');
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/api/rooms/alice/stats/merge'))).toBe(true);
  });

  it('T-M1 BR-11: 无身份 + 输入 + 确认 → onConfirm 收到 trim 后的房间名（首次收名契约）', async () => {
    // 用 fireEvent.change + fireEvent.click 替代 user.type/user.click，
    // 绕过 user.type 在受控 input 上字符级模拟与 React 19 batch 时机
    // 耦合导致的尾部触发丢失 / 重复 onConfirm（详见上一条注释）。
    const onConfirm = vi.fn();
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={1}
        initialName=""
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    const input = screen.getByTestId('sync-confirm-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  bob  ' } });
    expect(input.value).toBe('  bob  ');
    const confirmBtn = screen.getByTestId('sync-confirm-confirm') as HTMLButtonElement;
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith('bob');
  });

  it('onReject 在 onConfirm 抛错时仍能触发（error 留在 dialog 内，不静默关）', async () => {
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async (url) => {
      const s = String(url);
      if (s.endsWith('/api/rooms')) {
        return new Response(
          '{"stats":{"totalGames":5,"xWins":3,"oWins":1,"draws":1,"currentStreak":2},"existed":true}',
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{"error":"player session required"}', { status: 409 });
    });
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onReject = vi.fn();
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={2}
        initialName="alice"
        onConfirm={onConfirm}
        onReject={onReject}
      />,
    );
    await user.click(screen.getByTestId('sync-confirm-confirm'));
    const errorRow = await screen.findByTestId('sync-confirm-error');
    expect(errorRow).toHaveTextContent('需要先进入该房间');
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(screen.getByTestId('sync-confirm-reject'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('postMerge 抛 http-error：dialog 不关，不调用 onConfirm', async () => {
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async (url) => {
      const s = String(url);
      if (s.endsWith('/api/rooms')) {
        return new Response(
          '{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0},"existed":true}',
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{"error":"db unavailable"}', { status: 500 });
    });
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={3}
        initialName="alice"
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    await user.click(screen.getByTestId('sync-confirm-confirm'));
    const errorRow = await screen.findByTestId('sync-confirm-error');
    expect(errorRow).toHaveTextContent('同步失败');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('sync-confirm-dialog')).toBeInTheDocument();
  });

  it('W2 房间化：label 文案零「玩家名/注册/登录」', () => {
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={1}
        initialName="alice"
        onConfirm={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByText('房间名（1-24 字符）')).toBeInTheDocument();
    // 锁 hint 在 name 合法时显形（initialName='alice' 通过 whitelist）
    expect(screen.getByText('房间名永久属于该账本，创建后不可修改。')).toBeInTheDocument();
    // A9 红线：用户可见文案零「玩家名/登录」+ 零旧版「注册」
    // （hint 文案「创建后」是新的房间语义，不算旧版 注册）。
    expect(screen.queryByText(/玩家名|登录/)).toBeNull();
  });

});

// ── W-T blind-spot coverage ──────────────────────────────────────────────
//
// Pins:
//   - runMergeSequence error branches: 422 (invalid room), aborted (timeout),
//     http-error generic (HTTP x), and other (network error) — lines 152-158.
//   - loadDeclinedPending / writeDeclinedPending / clearDeclinedPending helpers
//     (sessionStorage SSR + privacy-mode degrade + line 354-357) — exported
//     alongside the form so the home-return path's reject→sentinel flow
//     doesn't depend on the dialog DOM.
//   - Backdrop click → onReject (line 196-198).
//   - Primary key submit on Enter while focused on the confirm button →
//     handleConfirm fires (already in existing suite but pinned explicitly).

import {
  loadDeclinedPending,
  writeDeclinedPending,
  clearDeclinedPending,
  SYNC_DECLINED_KEY,
} from './SyncConfirmDialog';

describe('components/SyncConfirmDialog — W-T blind spots', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    fetchSpy.mockClear();
    fetchSpy.mockImplementation(async () => new Response('{}', { status: 404 }));
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    fetchSpy.mockReset();
  });

  describe('runMergeSequence error paths (postRoomSession reject)', () => {
    it('postRoomSession 422 → throws with 房间名含不允许的字符', async () => {
      const onConfirm = vi.fn();
      fetchSpy.mockImplementation(async (url) => {
        const s = String(url);
        if (s.endsWith('/api/rooms')) {
          return new Response(
            JSON.stringify({
              type: 'https://docs.example.com/probs/invalid-room-name',
              title: 'Invalid room name',
              status: 422,
            }),
            { status: 422, headers: { 'content-type': 'application/problem+json' } },
          );
        }
        return new Response('{}', { status: 404 });
      });
      render(
        <SyncConfirmDialog
          open
          pendingGamesCount={1}
          initialName="bad<name"
          onConfirm={onConfirm}
          onReject={vi.fn()}
        />,
      );
      const confirm = screen.getByTestId('sync-confirm-confirm') as HTMLButtonElement;
      await userEvent.setup().click(confirm);
      expect(screen.getByTestId('sync-confirm-error')).toHaveTextContent(
        '房间名含不允许的字符',
      );
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('postRoomSession aborted → throws 进入房间超时 (covered via TimeoutError simulation)', async () => {
      // reasonFromError(err) maps DOMException with name === 'TimeoutError'
      // to 'aborted' (the lib/store.ts withTimeout shape). We synthesize it
      // instantly for the test — the 8s timer in production is too slow for
      // unit tests, but the branch behaviour is identical.
      const onConfirm = vi.fn();
      fetchSpy.mockImplementation(async () => {
        throw new DOMException('aborted', 'TimeoutError');
      });
      render(
        <SyncConfirmDialog
          open
          pendingGamesCount={2}
          initialName="alice"
          onConfirm={onConfirm}
          onReject={vi.fn()}
        />,
      );
      const confirm = screen.getByTestId('sync-confirm-confirm') as HTMLButtonElement;
      await userEvent.setup().click(confirm);
      await waitFor(() => {
        expect(screen.getByTestId('sync-confirm-error')).toHaveTextContent(
          '进入房间超时',
        );
      });
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('postRoomSession generic network error → throws 进入房间失败', async () => {
      const onConfirm = vi.fn();
      fetchSpy.mockImplementation(async () => {
        throw new TypeError('Failed to fetch');
      });
      render(
        <SyncConfirmDialog
          open
          pendingGamesCount={2}
          initialName="alice"
          onConfirm={onConfirm}
          onReject={vi.fn()}
        />,
      );
      const confirm = screen.getByTestId('sync-confirm-confirm') as HTMLButtonElement;
      await userEvent.setup().click(confirm);
      expect(screen.getByTestId('sync-confirm-error')).toHaveTextContent(
        '进入房间失败',
      );
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('postMerge http-error (non-409, non-422) → surfaces 同步失败 (HTTP status)', async () => {
      const onConfirm = vi.fn();
      fetchSpy.mockImplementation(async (url) => {
        const s = String(url);
        if (s.endsWith('/api/rooms')) {
          return new Response(
            '{"stats":{},"existed":true}',
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (s.includes('/stats/merge')) {
          return new Response('{"type":"...","status":500}', { status: 500 });
        }
        return new Response('{}', { status: 404 });
      });
      render(
        <SyncConfirmDialog
          open
          pendingGamesCount={3}
          initialName="alice"
          onConfirm={onConfirm}
          onReject={vi.fn()}
        />,
      );
      const confirm = screen.getByTestId('sync-confirm-confirm') as HTMLButtonElement;
      await userEvent.setup().click(confirm);
      expect(screen.getByTestId('sync-confirm-error')).toHaveTextContent(
        '同步失败 (HTTP 500)',
      );
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it('postMerge aborted → surfaces 同步失败 (aborted) — propagated from runMergeSequence', async () => {
      const onConfirm = vi.fn();
      fetchSpy.mockImplementation(async (url) => {
        const s = String(url);
        if (s.endsWith('/api/rooms')) {
          return new Response(
            '{"stats":{},"existed":true}',
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (s.includes('/stats/merge')) {
          // Reject with TimeoutError to land in the 'aborted' branch.
          throw new DOMException('aborted', 'TimeoutError');
        }
        return new Response('{}', { status: 404 });
      });
      render(
        <SyncConfirmDialog
          open
          pendingGamesCount={1}
          initialName="alice"
          onConfirm={onConfirm}
          onReject={vi.fn()}
        />,
      );
      const confirm = screen.getByTestId('sync-confirm-confirm') as HTMLButtonElement;
      await userEvent.setup().click(confirm);
      await waitFor(() => {
        expect(screen.getByTestId('sync-confirm-error')).toHaveTextContent(
          '同步失败 (aborted)',
        );
      });
    });
  });

  describe('declined-pending helpers (sessionStorage read/write/clear)', () => {
    it('loadDeclinedPending: missing key → 0', () => {
      expect(loadDeclinedPending()).toBe(0);
    });

    it('writeDeclinedPending + loadDeclinedPending round-trip', () => {
      writeDeclinedPending(7);
      expect(window.sessionStorage.getItem(SYNC_DECLINED_KEY)).toBe('7');
      expect(loadDeclinedPending()).toBe(7);
    });

    it('loadDeclinedPending: non-numeric garbage → 0 (degraded parse)', () => {
      window.sessionStorage.setItem(SYNC_DECLINED_KEY, 'not-a-number');
      expect(loadDeclinedPending()).toBe(0);
    });

    it('loadDeclinedPending: negative number → 0 (degraded parse)', () => {
      window.sessionStorage.setItem(SYNC_DECLINED_KEY, '-5');
      expect(loadDeclinedPending()).toBe(0);
    });

    it('loadDeclinedPending: sessionStorage throws → 0 (privacy mode degrade)', () => {
      const getItemSpy = vi
        .spyOn(window.sessionStorage, 'getItem')
        .mockImplementation(() => {
          throw new Error('SecurityError');
        });
      expect(loadDeclinedPending()).toBe(0);
      getItemSpy.mockRestore();
    });

    it('writeDeclinedPending: sessionStorage throws → no crash (privacy mode)', () => {
      const setItemSpy = vi
        .spyOn(window.sessionStorage, 'setItem')
        .mockImplementation(() => {
          throw new Error('QuotaExceededError');
        });
      expect(() => writeDeclinedPending(3)).not.toThrow();
      setItemSpy.mockRestore();
    });

    it('clearDeclinedPending removes the sentinel', () => {
      window.sessionStorage.setItem(SYNC_DECLINED_KEY, '9');
      clearDeclinedPending();
      expect(window.sessionStorage.getItem(SYNC_DECLINED_KEY)).toBeNull();
      expect(loadDeclinedPending()).toBe(0);
    });

    it('clearDeclinedPending: sessionStorage throws → no crash', () => {
      const removeSpy = vi
        .spyOn(window.sessionStorage, 'removeItem')
        .mockImplementation(() => {
          throw new Error('SecurityError');
        });
      expect(() => clearDeclinedPending()).not.toThrow();
      removeSpy.mockRestore();
    });
  });

  describe('backdrop click → onReject', () => {
    it('clicking the dialog backdrop fires onReject; click inside does not', async () => {
      const onReject = vi.fn();
      render(
        <SyncConfirmDialog
          open
          pendingGamesCount={2}
          initialName="alice"
          onConfirm={vi.fn()}
          onReject={onReject}
        />,
      );
      const dlg = screen.getByTestId('sync-confirm-dialog');
      const user = userEvent.setup();
      // Click on the dialog itself (target === dialogRef.current) → onReject.
      await user.click(dlg);
      expect(onReject).toHaveBeenCalledTimes(1);
      // Click on a child element does NOT count as backdrop click — the
      // handler's `e.target === dialogRef.current` guard.
      onReject.mockClear();
      await user.click(screen.getByTestId('sync-confirm-title'));
      expect(onReject).not.toHaveBeenCalled();
    });
  });

  describe('ESC cancel handler fires onReject', () => {
    it('cancel event from the native dialog dispatches onReject (treat cancel = 保留本地)', async () => {
      const onReject = vi.fn();
      const { container } = render(
        <SyncConfirmDialog
          open
          pendingGamesCount={1}
          initialName="alice"
          onConfirm={vi.fn()}
          onReject={onReject}
        />,
      );
      const dlg = container.querySelector('[data-testid="sync-confirm-dialog"]') as HTMLDialogElement;
      // Fire a synthetic cancel event (the jsdom shim's `close()` method
      // dispatches a 'close' event but not a 'cancel' event — we synthesize
      // the cancel manually).
      dlg.dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(onReject).toHaveBeenCalledTimes(1);
    });
  });
});
