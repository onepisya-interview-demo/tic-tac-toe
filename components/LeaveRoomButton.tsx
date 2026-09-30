'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useGameStore } from '@/lib/store';

/**
 * LeaveRoomButton (ulw-room-lifecycle T-N2 A 退出房间):
 *
 * 轻确认弹层，点击主 CTA 后**零网络写**：
 *   - useGameStore.setRoomName(null)  — 清身份
 *   - useGameStore.resetOfflineStats() — 清本机离线战绩
 *   - router.push('/') — 切到无身份首页
 *
 * 与清空战绩（ResetRoomStatsButton）正交：本控件只清客户端身份
 * 与离线缓存，不打服务端账本；其他设备仍可继续使用该房间。模式
 * 镜像 ResetRoomStatsButton：showModal + ESC + 焦点初始落主 CTA
 * （requestAnimationFrame 套住 React commit 后），backdrop 点击关
 * 弹层（dialog backdrop 契约）。
 */
export interface LeaveRoomButtonProps {
  /** 房间名，仅用于描述文案，不参与网络写（零网络）。 */
  room: string;
}

export function LeaveRoomButton({ room }: LeaveRoomButtonProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  // show/close + F3-like 焦点契约：showModal 后下一帧聚焦主 CTA。
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      const raf = requestAnimationFrame(() => {
        primaryRef.current?.focus();
      });
      return () => cancelAnimationFrame(raf);
    } else if (!open && dlg.open) {
      dlg.close();
    }
    return undefined;
  }, [open]);

  // ESC → cancel 事件 → setOpen(false)（与 ResetRoomStatsButton 同款 P3 #6 修复）。
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onCancel = (e: Event): void => {
      e.preventDefault();
      setOpen(false);
    };
    dlg.addEventListener('cancel', onCancel);
    return () => dlg.removeEventListener('cancel', onCancel);
  }, []);

  function closeDialog(): void {
    setOpen(false);
  }

  function handleConfirm(): void {
    if (busy) return;
    setBusy(true);
    try {
      // 退出房间：清身份 + 清本机离线战绩 + 回首页。
      // 零网络写（服务端账本保留以便其他设备继续使用）。
      const state = useGameStore.getState();
      state.setRoomName(null);
      state.resetOfflineStats();
      setOpen(false);
      router.push('/');
    } finally {
      setBusy(false);
    }
  }

  function handleBackdropClick(
    e: React.MouseEvent<HTMLDialogElement>,
  ): void {
    if (e.target === dialogRef.current) closeDialog();
  }

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        data-testid="leave-room-button"
        aria-label="退出当前房间"
      >
        退出房间
      </Button>
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid="leave-room-dialog"
        className="m-auto bg-bg-elevated text-text-primary border border-border-subtle rounded-lg p-6 max-w-[min(420px,calc(100vw-32px))] backdrop:backdrop-blur-sm motion-reduce:animate-none"
      >
        <h2
          id={titleId}
          className="text-h2 font-display font-medium mb-2"
          data-testid="leave-room-title"
        >
          退出当前房间？
        </h2>
        <p
          id={descId}
          className="text-small text-text-secondary mb-4"
          data-testid="leave-room-desc"
        >
          退出房间后，本机「{room}」的离线战绩缓存将被清空；本机不再持有
          房间身份。服务端账本保留，其他设备仍可继续使用该房间。
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={closeDialog}
            disabled={busy}
            data-testid="leave-room-cancel"
            aria-label="取消退出房间"
          >
            取消
          </Button>
          <button
            ref={primaryRef}
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            data-loading={busy ? '' : undefined}
            data-testid="leave-room-confirm"
            aria-label="退出当前房间"
            className="inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-[120ms] ease-out disabled:opacity-50 disabled:cursor-not-allowed bg-accent text-bg-base hover:bg-accent-hover px-5 py-2.5 text-base"
          >
            退出
          </button>
        </div>
      </dialog>
    </>
  );
}
