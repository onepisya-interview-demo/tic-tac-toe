import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncConfirmDialog } from './SyncConfirmDialog';

// SyncConfirmDialog — W3 (ulw-name-login-one-truth) reframe: the dialog
// now runs the register/login + merge sequence itself, then forwards
// the merged row to the caller. Coverage:
//  - 主/次 CTA 文案保留 (legacy contract)
//  - 主标题/副标题披露 (legacy contract)
//  - n/24 计数器 + label (legacy contract)
//  - 永久锁定 hint 在 name 合法时显形 (R4 §2.2)
//  - 名字非法时主 CTA disabled (legacy contract)
//  - P1-5 新分支 (ulw §5 A12): pending>0 → open=true 时弹框出现;
//    「保留本地」零网络写 + 写 sessionStorage 标记;
//    「合并并清空」成功 → onConfirm(name) 收到 name（merged row 由 dialog 自用 — W4 F1 fix）;
//    fetch 失败 → dialog 不关不触发 onConfirm.
//
// Network stubs (W2 RESTful surface): postSession returns {stats, existed:false};
// postMerge returns a merged row.

const fetchSpy = vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  fetchSpy.mockReset();
  // Default success: 注册 / 合并成功
  fetchSpy.mockImplementation(async (url) => {
    const s = String(url);
    if (s.endsWith('/api/sessions')) {
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

describe('components/SyncConfirmDialog', () => {
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
    await user.type(screen.getByTestId('sync-confirm-name'), '汉字名');
    expect(counter).toHaveTextContent('3 / 24');
  });

  it('主 CTA 在名字非法时 disabled（无 network write）', async () => {
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
    // Lock hint visible when name is valid (R4 §1.3.3)
    expect(screen.getByTestId('sync-confirm-lock-hint')).toHaveTextContent(
      '永久属于你',
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

  it('「合并并清空」成功：onConfirm 收到 trim-name，并按序触发 postSession + postMerge', async () => {
    // W4 F1 fix: the dialog's onConfirm now only forwards the chosen
    // name. The merged row is still returned by runMergeSequence
    // internally for symmetry / future callers, but the contract
    // HomeDialogMount consumes is name-only (the baseline sentinel
    // it writes is always 0, derived from clearSoloStats()).
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
    expect(urls).toContain('/api/sessions');
    expect(urls.some((u) => u.includes('/api/players/carol/stats/merge'))).toBe(true);
  });

  it('onReject 在 onConfirm 抛错时仍能触发（error 留在 dialog 内，不静默关）', async () => {
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async (url) => {
      const s = String(url);
      if (s.endsWith('/api/sessions')) {
        // Login succeeds so the dialog reaches /sync; /sync then 409s.
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
    // The dialog swallows the network error → 409 → surfaces it inline.
    const errorRow = await screen.findByTestId('sync-confirm-error');
    expect(errorRow).toHaveTextContent('需要先登录该账号');
    // onConfirm never fires (the network path failed).
    expect(onConfirm).not.toHaveBeenCalled();
    // Reject still works (user bails out).
    await user.click(screen.getByTestId('sync-confirm-reject'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  // P1-5 (ulw §5 A12): 「合并并清空」POST /sync 失败 → dialog 留开不导航.
  it('postMerge 抛 network-error：dialog 不关，不调用 onConfirm', async () => {
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async (url) => {
      const s = String(url);
      if (s.endsWith('/api/sessions')) {
        return new Response(
          '{"stats":{"totalGames":0,"xWins":0,"oWins":0,"draws":0,"currentStreak":0},"existed":true}',
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      // /sync returns 500 — sync failed after a successful login.
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
    // Dialog stays open and onConfirm is not called.
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByTestId('sync-confirm-dialog')).toBeInTheDocument();
  });
});
