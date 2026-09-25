'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useGameStore } from '@/lib/store';
import { deleteRoom } from '@/lib/game-net';

/**
 * DeleteRoomButton (ulw-room-lifecycle T-N2 B 删除房间):
 *
 * 双层防护的销户入口：
 *   1) type-to-confirm 输入框：仅当输入 `.trim()` 与房间名（精确
 *      大小写）相等时主 CTA 解禁（对齐 industry 标准销户 UX）。
 *   2) 后端 DELETE /api/rooms/{room} 成功 / 404 → 本地清理
 *      (setRoomName(null) + resetOfflineStats) + router.push('/')；
 *      其他错误（5xx / 网络 / 超时）→ Alert 红条就地提示，弹框
 *      保持打开，零本地清理，零导航（不留半清除态）。
 *
 * 镜像 ResetRoomStatsButton 的 dialog 契约：showModal + ESC +
 * requestAnimationFrame 初始焦点主 CTA；backdrop 点击关弹层。
 *
 * 状态：200/404 都视为「成功」（幂等删除的官方语义）— 404 是已删
 * 终态，不是错误。错误特指网络层错、aborted、5xx。
 */
export interface DeleteRoomButtonProps {
  /** 房间名（来自 /result RSC searchParams；normalized 入参）。 */
  room: string;
}

export function DeleteRoomButton({ room }: DeleteRoomButtonProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const inputId = useId();
  const [open, setOpen] = useState<boolean>(false);
  /** type-to-confirm 输入缓冲（trim 后与 room 比较）。 */
  const [confirmed, setConfirmed] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // show/close + F3 焦点契约：showModal 后下一帧聚焦输入框
  // （首交互即为键入，而非主 CTA，符合 type-to-confirm 预期）。
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      const raf = requestAnimationFrame(() => {
        // 输入框优先聚焦，Enter 提交由主 CTA 承担；用户进入即键入。
        const input = dialogRef.current?.querySelector<HTMLInputElement>(
          `[data-testid="delete-room-input"]`,
        );
        (input ?? primaryRef.current)?.focus();
      });
      return () => cancelAnimationFrame(raf);
    } else if (!open && dlg.open) {
      dlg.close();
    }
    return undefined;
  }, [open]);

  // ESC → cancel 事件 → setOpen(false)，与 ResetRoomStatsButton 同款。
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onCancel = (e: Event): void => {
      e.preventDefault();
      setError(null);
      setConfirmed('');
      setOpen(false);
    };
    dlg.addEventListener('cancel', onCancel);
    return () => dlg.removeEventListener('cancel', onCancel);
  }, []);

  function closeDialog(): void {
    setError(null);
    setConfirmed('');
    setOpen(false);
  }

  function handleBackdropClick(
    e: React.MouseEvent<HTMLDialogElement>,
  ): void {
    if (e.target === dialogRef.current) closeDialog();
  }

  async function handleConfirm(): Promise<void> {
    if (busy) return;
    // 双层防护：即便测试 mock 了 selected state，这里仍有 trim 校验
    // 防止 disabled prop 被绕过（如 devtools 强行点击）。trim 后的
    // 精确大小写匹配。
    if (confirmed.trim() !== room) return;
    setBusy(true);
    setError(null);
    try {
      const r = await deleteRoom(room);
      if (r.ok) {
        // 200 / 404 → 视为「已删」终态；幂等语义。
        const state = useGameStore.getState();
        state.setRoomName(null);
        state.resetOfflineStats();
        setConfirmed('');
        setOpen(false);
        router.push('/');
        return;
      }
      // http-error 5xx / 网络错 / aborted 都进 catch-all 文案：
      //   - http-error: 5xx → 「删除失败，请稍后再试」
      //   - network-error: 断网 / fetch 抛错
      //   - aborted: 8s 超时（status undefined）
      setError('删除失败，请稍后再试');
    } catch {
      // deleteRoom 内部 httpJson 已经吞错转 result — 此处仅为防御
      // 性兜底；理论上不可达。
      setError('删除失败，请稍后再试');
    } finally {
      setBusy(false);
    }
  }

  // 主 CTA disabled：busy 时禁用（防重）+ 校验未过禁用（防误删）。
  const canConfirm: boolean = !busy && confirmed.trim() === room;

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        data-testid="delete-room-button"
        aria-label="删除当前房间"
      >
        删除房间
      </Button>
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid="delete-room-dialog"
        className="m-auto bg-bg-elevated text-text-primary border border-border-subtle rounded-lg p-6 max-w-[min(460px,calc(100vw-32px))] backdrop:backdrop-blur-sm motion-reduce:animate-none"
      >
        <h2
          id={titleId}
          className="text-h2 font-display font-medium mb-2"
          data-testid="delete-room-title"
        >
          删除房间 {room}？
        </h2>
        <p
          id={descId}
          className="text-small text-text-secondary mb-4"
          data-testid="delete-room-desc"
        >
          服务端战绩将一并清除，本机绑定数据同步清零；多设备同房间将看到 404
          错误提示，可在任何时候用同名再次创建新房间（账本全零起步，不可恢复）。
        </p>
        <label htmlFor={inputId} className="block text-small text-text-secondary mb-1">
          输入房间名（{room}）以确认
        </label>
        <input
          id={inputId}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={confirmed}
          onChange={(e) => setConfirmed(e.target.value)}
          disabled={busy}
          data-testid="delete-room-input"
          aria-label="输入房间名以确认删除"
          className="w-full rounded-md border border-border-subtle bg-bg-elevated px-3 py-2 text-base font-mono text-text-primary disabled:opacity-50"
        />
        {error ? (
          <div className="mt-3">
            <Alert data-testid="delete-room-error" role="alert">
              {error}
            </Alert>
          </div>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4">
          <Button
            variant="secondary"
            onClick={closeDialog}
            disabled={busy}
            data-testid="delete-room-cancel"
            aria-label="取消删除房间"
          >
            取消
          </Button>
          <button
            ref={primaryRef}
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            aria-busy={busy || undefined}
            data-loading={busy ? '' : undefined}
            data-testid="delete-room-confirm"
            aria-label="删除房间"
            className="inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-[120ms] ease-out disabled:opacity-50 disabled:cursor-not-allowed bg-danger text-bg-base hover:bg-danger-strong px-5 py-2.5 text-base"
          >
            {busy ? (
              <span
                data-testid="delete-room-confirm-loading"
                aria-hidden="true"
                className="button-spinner"
              />
            ) : null}
            删除
          </button>
        </div>
      </dialog>
    </>
  );
}
