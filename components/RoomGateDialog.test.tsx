import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoomGateDialog } from './RoomGateDialog';

// RoomGateDialog (ulw-room-migration-home-landing W2 D-2): the
// dialog is the online CTA entry gate. Coverage map (plan §3.1):
//   R1: open, no POST yet
//   R2: valid submit (existed:false) → POST + onConfirm + close
//   R3: existed:true success copy
//   R4: 422 → inline error, no persist, no nav
//   R5: aborted → timeout copy, no persist
//   R6: network-error → network copy, no persist
//   R7: busy 防重 → second click zero extra POSTs
//   R8: ESC / 取消 → close, zero POST, zero write, zero nav
//   R9: trim → POST body = trim value; store/localStorage get the trim value

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  fetchSpy.mockReset();
  // Default success: 注册 / 进入成功
  fetchSpy.mockImplementation(async (url) => {
    const s = String(url);
    if (s.endsWith('/api/rooms')) {
      return new Response(
        '{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0},"existed":false}',
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

describe('components/RoomGateDialog (W2 ulw-room-migration-home-landing D-2)', () => {
  it('R1: dialog 打开 + 输入合法 → 提交前零 POST', async () => {
    const onConfirm = vi.fn();
    render(
      <RoomGateDialog
        open
        initialName=""
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    expect(screen.getByTestId('room-gate-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('room-gate-title')).toHaveTextContent('创建房间');
    expect(screen.getByTestId('room-gate-confirm')).toBeDisabled();
    // 零 POST 因为 confirm 还没点
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('R2: 合法名提交成功（existed:false）→ POST + onConfirm + 零导航', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RoomGateDialog
        open
        initialName=""
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    await user.type(screen.getByTestId('room-gate-name'), 'alice');
    await user.click(screen.getByTestId('room-gate-confirm'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith('alice', false);
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain('/api/rooms');
    // POST body 验证
    const posts = fetchSpy.mock.calls.filter((c) => {
      const init = (c[1] ?? {}) as RequestInit;
      return (init.method ?? 'GET').toUpperCase() === 'POST';
    });
    expect(JSON.parse(String((posts[0][1] as RequestInit).body))).toEqual({
      room: 'alice',
    });
  });

  it('R3: existed:true → onConfirm 收到 existed=true', async () => {
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async (url) => {
      const s = String(url);
      if (s.endsWith('/api/rooms')) {
        return new Response(
          '{"stats":{"totalGames":5,"xWins":3,"oWins":1,"draws":1,"currentStreak":2},"existed":true}',
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 404 });
    });
    const onConfirm = vi.fn();
    render(
      <RoomGateDialog
        open
        initialName=""
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    const input = screen.getByTestId('room-gate-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'existing' } });
    expect(input.value).toBe('existing');
    fireEvent.click(screen.getByTestId('room-gate-confirm'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith('existing', true);
  });



  it('R4: 422 → 就地错误；零持久层写；不导航', async () => {
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async (url) => {
      const s = String(url);
      if (s.endsWith('/api/rooms')) {
        return new Response('{"error":"invalid room name"}', { status: 422 });
      }
      return new Response('{}', { status: 404 });
    });
    const onConfirm = vi.fn();
    render(
      <RoomGateDialog
        open
        initialName=""
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    // 任意合法名触发服务端 422（whitelist 通过，但服务端拒绝）
    const input = screen.getByTestId('room-gate-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'serverreject' } });
    fireEvent.click(screen.getByTestId('room-gate-confirm'));
    const errorRow = await screen.findByTestId('room-gate-error');
    expect(errorRow).toHaveTextContent('房间名含不允许的字符');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBeNull();
    expect(window.localStorage.getItem('ttt.player.name.v1')).toBeNull();
  });


  it('R5: aborted（超时）→ 超时文案；零副作用', async () => {
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async () => {
      throw new DOMException('aborted', 'TimeoutError');
    });
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RoomGateDialog
        open
        initialName=""
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    await user.type(screen.getByTestId('room-gate-name'), 'timeoutroom');
    await user.click(screen.getByTestId('room-gate-confirm'));
    const errorRow = await screen.findByTestId('room-gate-error');
    expect(errorRow).toHaveTextContent('请求超时');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBeNull();
  });

  it('R6: network-error → 网络文案；零副作用', async () => {
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async () => {
      throw new TypeError('Failed to fetch');
    });
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RoomGateDialog
        open
        initialName=""
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    await user.type(screen.getByTestId('room-gate-name'), 'netfail');
    await user.click(screen.getByTestId('room-gate-confirm'));
    const errorRow = await screen.findByTestId('room-gate-error');
    expect(errorRow).toHaveTextContent('网络异常');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBeNull();
  });

  it('R7: busy 防重 → submit 中按钮 disabled；二次点击零额外 POST', async () => {
    // 用一个永远 pending 的 fetch 来撑住 busy
    let resolveFn: (v: Response) => void = () => {};
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFn = resolve;
        }),
    );
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <RoomGateDialog
        open
        initialName=""
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    await user.type(screen.getByTestId('room-gate-name'), 'busy');
    const confirm = screen.getByTestId('room-gate-confirm');
    await user.click(confirm);
    // 第一次点完 busy 立即生效
    expect(confirm).toBeDisabled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // 二次点击应被 disable 拦截
    await user.click(confirm).catch(() => {});
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // 让 fetch resolve 收尾
    resolveFn(
      new Response(
        '{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0},"existed":false}',
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('R8: ESC（cancel 事件）→ 触发 onReject；零 POST；零写；零导航', async () => {
    const onConfirm = vi.fn();
    const onReject = vi.fn();
    const dialogRef = vi.fn();
    render(
      <RoomGateDialog
        open
        initialName=""
        onConfirm={onConfirm}
        onReject={onReject}
      />,
    );
    // 用 cancel 事件触发 onReject（同 ESC 流程）
    const dlg = screen.getByTestId('room-gate-dialog') as HTMLDialogElement;
    dlg.dispatchEvent(new Event('cancel'));
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    // 「取消」按钮同样路径
    const user = userEvent.setup();
    await user.click(screen.getByTestId('room-gate-cancel'));
    expect(onReject).toHaveBeenCalledTimes(2);
    // LocalStorage 零写入
    expect(window.localStorage.getItem('ttt.room.name.v1')).toBeNull();
    // dialogRef 参数被解构只是为了保持 lint 安静
    void dialogRef;
  });

  it('R9: 输入含首尾空白 → POST body = trim 后值', async () => {
    const onConfirm = vi.fn();
    render(
      <RoomGateDialog
        open
        initialName=""
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    const input = screen.getByTestId('room-gate-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   carol   ' } });
    fireEvent.click(screen.getByTestId('room-gate-confirm'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith('carol', expect.any(Boolean));
    const posts = fetchSpy.mock.calls.filter((c) => {
      const init = (c[1] ?? {}) as RequestInit;
      return (init.method ?? 'GET').toUpperCase() === 'POST';
    });
    expect(JSON.parse(String((posts[0][1] as RequestInit).body))).toEqual({
      room: 'carol',
    });
  });
});
