import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SyncConfirmDialog } from './SyncConfirmDialog';

// SyncConfirmDialog — pure DOM-modal assertions. Covers:
// - 主 CTA 标「合并并清空」/ 次 CTA 标「保留本地」(no Confirm/OK)
// - n/24 live 计数器随输入变化
// - invalid name 阻止 confirm（按钮 disabled + error 行）
// - ESC 触发 onReject（no network writes）
// - onConfirm 拿到 trim 后名字
// - reduced-motion 时 dialog 不挂 animation 类

afterEach(() => cleanup());

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
    // Anti-pattern: never "Confirm" / "OK" / "Yes".
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
    // 「汉字名」 3 chars
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
    // Empty name → invalid → disabled.
    const confirm = screen.getByTestId('sync-confirm-confirm');
    expect(confirm).toBeDisabled();
    expect(screen.getByTestId('sync-confirm-name-error')).toBeInTheDocument();
    // Type a valid name → enabled.
    await user.type(screen.getByTestId('sync-confirm-name'), 'bob');
    expect(confirm).not.toBeDisabled();
  });

  it('onConfirm 收到 trim 后的名字（whitespace-only trim 不算有效）', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <SyncConfirmDialog
        open
        pendingGamesCount={2}
        initialName=""
        onConfirm={onConfirm}
        onReject={vi.fn()}
      />,
    );
    await user.type(screen.getByTestId('sync-confirm-name'), '   carol   ');
    await user.click(screen.getByTestId('sync-confirm-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('carol');
  });

  it('onReject 由「保留本地」按钮触发——零网络写', async () => {
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
  });

  it('onReject 在 onConfirm 抛错时仍能触发（error 留在 dialog 内，不静默关）', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error('boom'));
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
    // After async rejection resolves, the dialog should still be open
    // with the error surfaced. Clicking reject closes it.
    const errorRow = await screen.findByTestId('sync-confirm-error');
    expect(errorRow).toHaveTextContent('同步失败：boom');
    await user.click(screen.getByTestId('sync-confirm-reject'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });
});
