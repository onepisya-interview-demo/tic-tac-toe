'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { postResetRoomStats } from '@/lib/game-net';

/**
 * ResetRoomStatsButton (ulw-online-reset-and-result-fresh W-R D-3):
 *
 * Mounted ONLY in the /result branch where the per-room row exists
 * (stats !== null). The room arrives as a normalized RSC prop — zero
 * localStorage reads on the SSR frame (AGENTS.md §本项目反模式).
 *
 * Click → native <dialog> confirm (same-family pattern as
 * RoomGateDialog: primary/secondary CTA, ESC = 取消 with zero network
 * writes, reduced-motion no-animation path, requestAnimationFrame
 * initial focus on the primary CTA — the F3 fix). Confirm →
 * postResetRoomStats(room) → success closes the dialog then calls
 * router.refresh(): the /result RSC is force-dynamic and re-reads the
 * row at request time, so the zeroed StatsGrid appears without a full
 * page reload. 404 → in-place error copy, the dialog stays open so
 * the user can still cancel; timeout / network / 5xx share one
 * generic in-place error line.
 *
 * All user-visible copy is frozen verbatim in plan §1 D-4 — do not
 * reword (busy state adds only the shared spinner, no extra copy).
 */
export interface ResetRoomStatsButtonProps {
  /** Normalized room name, owned by the /result RSC (searchParams). */
  room: string;
}

export function ResetRoomStatsButton({ room }: ResetRoomStatsButtonProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Open / close + F3 focus pattern (mirrors RoomGateDialog): showModal
  // then focus the primary CTA inside requestAnimationFrame so the
  // focus lands AFTER React settles — Enter confirms by default.
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
  }, [open]);

  // ESC: native <dialog>.close fires 'cancel' then 'close'. Treat
  // 'cancel' as 「取消」— zero network writes.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onCancel = (e: Event): void => {
      e.preventDefault();
      setError(null);
      setOpen(false);
    };
    dlg.addEventListener('cancel', onCancel);
    return () => dlg.removeEventListener('cancel', onCancel);
  }, []);

  function closeDialog(): void {
    setError(null);
    setOpen(false);
  }

  async function handleConfirm(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await postResetRoomStats(room);
      if (!r.ok) {
        setError(
          r.reason === 'http-error' && r.status === 404
            ? '房间不存在，无法清空。'
            : '清空失败，请稍后再试。',
        );
        return;
      }
      closeDialog();
      // force-dynamic RSC re-reads the zeroed row at request time —
      // no full reload, no revalidatePath (AGENTS.md §本项目反模式).
      router.refresh();
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
        data-testid="reset-room-stats"
        aria-label="清空房间战绩"
      >
        清空战绩
      </Button>
      <dialog
        ref={dialogRef}
        onClick={handleBackdropClick}
        aria-labelledby={titleId}
        aria-describedby={descId}
        data-testid="reset-room-dialog"
        className="m-auto bg-bg-elevated text-text-primary border border-border-subtle rounded-lg p-6 max-w-[min(420px,calc(100vw-32px))] backdrop:backdrop-blur-sm motion-reduce:animate-none"
      >
        <h2
          id={titleId}
          className="text-h2 font-display font-medium mb-2"
          data-testid="reset-room-title"
        >
          清空房间战绩？
        </h2>
        <p
          id={descId}
          className="text-small text-text-secondary mb-4"
          data-testid="reset-room-desc"
        >
          该房间的全部战绩将被清零，此操作不可撤销。
        </p>
        {error ? (
          <p
            className="text-small text-text-secondary mb-4"
            data-testid="reset-room-error"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={closeDialog}
            disabled={busy}
            data-testid="reset-room-cancel"
            aria-label="取消清空房间战绩"
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
            data-testid="reset-room-confirm"
            aria-label="清空房间战绩"
            className="inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-[120ms] ease-out disabled:opacity-50 disabled:cursor-not-allowed bg-accent text-bg-base hover:bg-accent-hover px-5 py-2.5 text-base"
          >
            {busy ? (
              <span
                data-testid="reset-room-confirm-loading"
                aria-hidden="true"
                className="button-spinner"
              />
            ) : null}
            清空
          </button>
        </div>
      </dialog>
    </>
  );
}
