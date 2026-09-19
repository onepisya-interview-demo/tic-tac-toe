import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

  it('「合并并清空」成功：onConfirm 收到 trim-room，并按序触发 POST /api/rooms + POST /api/rooms/{room}/stats/merge', async () => {
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
    await user.clear(screen.getByTestId('sync-confirm-name'));
    await user.type(screen.getByTestId('sync-confirm-name'), '   carol   ');
    await user.click(screen.getByTestId('sync-confirm-confirm'));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledWith('carol');
    const urls = fetchSpy.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain('/api/rooms');
    expect(urls.some((u) => u.includes('/api/rooms/carol/stats/merge'))).toBe(true);
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
