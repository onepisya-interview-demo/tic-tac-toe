'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { isPlayerName } from '@/lib/player-name';

const NAME_MAX = 24;

/**
 * SyncConfirmDialog — modal that gates the cross-device merge
 * write (ulw-solo-sync-rebuild.md B-T3 / B-T4).
 *
 * Frame contract (rux.md 决议 3/4/7):
 *  - 主标题「合并战绩」(正框架，不说「清空本机」)
 *  - 副标「将上传本机 N 局；同步后本机清零以防重复」(披露后果)
 *  - 未命名时弹框内含名字输入 (label 前置规则「1-24 字符」 + n/24
 *    live 计数 — rux.md 决议 1)
 *  - 主 CTA「合并并清空」(具体动词, brand-color 实心) / 次 CTA「保留
 *    本地」(outline) — 禁 Confirm/OK 通用词 (rux.md 决议 7)
 *  - ESC 关 (原生 <dialog> 提供) / reduced-motion 瞬时
 *
 * Native <dialog> + showModal() so the browser owns focus trap,
 * inert background, and ESC. No animation library, no portal library —
 * the project explicitly excludes those (AGENTS.md 反模式).
 */
export interface SyncConfirmDialogProps {
  open: boolean;
  /** Local stats count to surface in the copy as "本机 N 局". */
  pendingGamesCount: number;
  /**
   * Pre-filled name when the panel already has one; the input is
   * editable in both branches so the user can change names here
   * without bouncing back to PlayerNameForm. Empty string when no
   * name is set yet.
   */
  initialName: string;
  /**
   * Fired when the user picks "合并并清空". The handler receives
   * the chosen name (post-trim, post-validate) and is expected to
   * run the B-T4 sequence: PUT (if changed) → POST /sync → clear
   * local → adopt server stats → close this dialog. Errors stay
   * inside the dialog so the user can retry or bail.
   */
  onConfirm: (name: string) => Promise<void> | void;
  /** Fired when the user picks "保留本地" or hits ESC. Zero network writes. */
  onReject: () => void;
}

export function SyncConfirmDialog({
  open,
  pendingGamesCount,
  initialName,
  onConfirm,
  onReject,
}: SyncConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const [name, setName] = useState<string>(initialName);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the input in sync when the dialog reopens with a fresh name
  // (PlayerNameForm save fires while the dialog was closed).
  useEffect(() => {
    // Sync the input when the dialog reopens with a fresh name
    // (PlayerNameForm save fires while the dialog was closed).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setName(initialName);
  }, [open, initialName]);

  // Open / close the native <dialog>. showModal() brings focus trap,
  // ESC handler, and inert background for free.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      dlg.showModal();
      // Focus the primary CTA so Enter confirms by default; the
      // browser will already have focused the dialog itself, but
      // the button focus makes the keyboard affordance explicit.
      primaryRef.current?.focus();
    } else if (!open && dlg.open) {
      dlg.close();
    }
  }, [open]);

  // ESC handler: native <dialog>.close fires 'cancel' then 'close'.
  // Treat 'cancel' as "保留本地" per the rux §3 决议 (avoid silent
  // destructive path).
  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onCancel = (e: Event): void => {
      e.preventDefault();
      onReject();
    };
    dlg.addEventListener('cancel', onCancel);
    return () => dlg.removeEventListener('cancel', onCancel);
  }, [onReject]);

  const trimmed = name.trim();
  const nameOk = isPlayerName(trimmed);
  const canConfirm = nameOk && !busy;

  async function handleConfirm(): Promise<void> {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (e) {
      // Surface the failure inside the dialog so the user can retry
      // or bail — never silently close (would hide a stuck sync).
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>): void {
    // Backdrop click counts as "保留本地" (the same contract as ESC).
    if (e.target === dialogRef.current) onReject();
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby={titleId}
      aria-describedby={descId}
      data-testid="sync-confirm-dialog"
      className="bg-bg-elevated text-text-primary border border-border-subtle rounded-lg p-6 max-w-[min(420px,calc(100vw-32px))] backdrop:bg-black/60 motion-reduce:animate-none"
    >
      <h2
        id={titleId}
        className="text-h2 font-display font-medium mb-2"
        data-testid="sync-confirm-title"
      >
        合并战绩
      </h2>
      <p
        id={descId}
        className="text-small text-text-secondary mb-4"
        data-testid="sync-confirm-desc"
      >
        将上传本机 {pendingGamesCount} 局；同步后本机清零以防重复。
      </p>
      <div className="flex flex-col gap-2 mb-4">
        <label
          htmlFor="sync-confirm-name"
          className="text-small text-text-secondary"
        >
          玩家名（1-24 字符）
        </label>
        <div className="flex items-center gap-2">
          <input
            id="sync-confirm-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            className="flex-1 bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-body text-text-primary focus:outline-none focus:border-border-strong"
            data-testid="sync-confirm-name"
            aria-label="玩家名"
            aria-invalid={!nameOk}
          />
          <span
            className="text-small text-text-muted font-mono whitespace-nowrap"
            data-testid="sync-confirm-counter"
            aria-live="polite"
          >
            {trimmed.length} / {NAME_MAX}
          </span>
        </div>
        {!nameOk ? (
          <p
            className="text-small text-text-secondary"
            data-testid="sync-confirm-name-error"
          >
            名字需 1-24 字符，不含控制字符。
          </p>
        ) : null}
      </div>
      {error ? (
        <p
          className="text-small text-text-secondary mb-4"
          data-testid="sync-confirm-error"
          role="alert"
        >
          同步失败：{error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          onClick={onReject}
          disabled={busy}
          data-testid="sync-confirm-reject"
          aria-label="保留本地"
        >
          保留本地
        </Button>
        <button
          ref={primaryRef}
          type="button"
          onClick={handleConfirm}
          disabled={!canConfirm}
          aria-busy={busy || undefined}
          data-loading={busy ? '' : undefined}
          data-testid="sync-confirm-confirm"
          aria-label="合并并清空"
          className="inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-[120ms] ease-out disabled:opacity-50 disabled:cursor-not-allowed bg-accent text-bg-base hover:bg-accent-hover px-5 py-2.5 text-base"
        >
          {busy ? (
            <span
              data-testid="sync-confirm-confirm-loading"
              aria-hidden="true"
              className="button-spinner"
            />
          ) : null}
          {busy ? '同步中…' : '合并并清空'}
        </button>
      </div>
    </dialog>
  );
}
