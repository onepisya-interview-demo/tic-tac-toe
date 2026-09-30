'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { isRoomName } from '@/lib/room-name';
import { postRoomSession } from '@/lib/game-net';

const NAME_MAX = 24;

/**
 * RoomGateDialog (ulw-room-migration-home-landing W2 D-2):
 *
 * Replaces the retired PlayerNameForm-based entry gate (PlayerNameForm
 * was removed in this plan's W2 client wave, not W3). The dialog opens
 * when StartGameButton dispatches `ttt:room-required` (detail carries
 * the original { mode, href }) — see components/RoomGateMount for the
 * mount effect that subscribes.
 *
 * Frame contract (plan §2.2):
 *  - 主标题「创建房间」 + 副标题「房间是这台设备上这组人的战绩账本标识」
 *  - 单输入 (room name) + n/24 live 计数 + 1-24 字符 / 无控制字符 hint
 *  - 主 CTA「创建并进入」/ 次 CTA「取消」
 *  - 错误就地展示 + ESC = 「取消」(零网络写)
 *
 * Submit sequence (plan §2.2):
 *  - ok → 此刻才写 localStorage (setRoomName) + store.setRoomName →
 *    startGame(mode) + router.push(href) + 关闭
 *  - existed:true 文案「已进入房间 <room>」/false「房间已创建」
 *  - 422 / aborted / network-error → 就地错误，零持久层写，不导航，输入保留可改可重试
 *  - busy 防重：submit 中按钮 disabled；二次点击零额外 POST
 *
 * F3 fix (carried over from SyncConfirmDialog W4): showModal() focus
 * defaults to the dialog itself; we explicitly focus the primary CTA
 * via requestAnimationFrame so Enter confirms by default and the
 * keyboard affordance is unambiguous. The sibling useEffect that
 * calls `setName(initialName)` schedules a re-render in the same
 * commit phase; deferring the focus call lands it AFTER React has
 * settled, on top of the showModal() call (which itself targets the
 * first focusable = the name input).
 */
export interface RoomGateDialogProps {
  open: boolean;
  /** Pre-filled room name from the store (or empty). Synced to the
   *  input on each open so re-opens preserve any typed-but-not-saved
   *  value (the caller forwards store.roomName when the user has
   *  one). */
  initialName: string;
  /** Fired on successful register-or-enter. Receives the trimmed,
   *  validated room name + the existed flag so the caller can show
   *  the right success toast / persist the name. */
  onConfirm?: (
    room: string,
    existed: boolean,
  ) => Promise<void> | void;
  /** Fired after onConfirm resolves successfully. Future use. */
  onAfterConfirm?: () => void;
  /** Fired when the user picks "取消" or hits ESC. Zero network writes. */
  onReject: () => void;
}

export function RoomGateDialog({
  open,
  initialName,
  onConfirm,
  onAfterConfirm,
  onReject,
}: RoomGateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const [name, setName] = useState<string>(initialName);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the input in sync when the dialog re-opens with a fresh name
  // (RoomGateMount passes store.roomName; when the store has one,
  // pre-fill so the user sees their existing room).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setName(initialName);
  }, [open, initialName]);

  // Open / close + F3 focus pattern (mirrors SyncConfirmDialog).
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

  // ESC handler: native <dialog>.close fires 'cancel' then 'close'.
  // Treat 'cancel' as "取消" (zero network writes).
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
  const nameOk = isRoomName(trimmed);
  const canConfirm = nameOk && !busy;

  async function handleConfirm(): Promise<void> {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      const r = await postRoomSession(trimmed);
      if (!r.ok) {
        if (r.reason === 'http-error' && r.status === 422) {
          throw new Error('房间名含不允许的字符');
        }
        if (r.reason === 'aborted') {
          throw new Error('请求超时，请稍后重试');
        }
        throw new Error('网络异常，请稍后重试');
      }
      // Success: forward to the caller (RoomGateMount). The caller is
      // the single owner of the localStorage write + store mirror +
      // startGame + router.push — the dialog stays decoupled from
      // navigation so future call sites (settings page, deep link)
      // can reuse it without dragging the route along.
      if (onConfirm) await onConfirm(trimmed, r.value.existed);
      // onAfterConfirm fires only on success (mirrors SyncConfirmDialog
      // contract).
      onAfterConfirm?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleBackdropClick(
    e: React.MouseEvent<HTMLDialogElement>,
  ): void {
    if (e.target === dialogRef.current) onReject();
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      aria-labelledby={titleId}
      aria-describedby={descId}
      data-testid="room-gate-dialog"
      className="m-auto bg-bg-elevated text-text-primary border border-border-subtle rounded-lg p-6 max-w-[min(420px,calc(100vw-32px))] backdrop:backdrop-blur-sm motion-reduce:animate-none"
    >
      <h2
        id={titleId}
        className="text-h2 font-display font-medium mb-2"
        data-testid="room-gate-title"
      >
        创建房间
      </h2>
      <p
        id={descId}
        className="text-small text-text-secondary mb-4"
        data-testid="room-gate-desc"
      >
        房间是这台设备上这组人的战绩账本标识。
      </p>
      <div className="flex flex-col gap-2 mb-4">
        <label
          htmlFor="room-gate-name"
          className="text-small text-text-secondary"
        >
          房间名（1-24 字符）
        </label>
        <div className="flex items-center gap-2">
          <input
            id="room-gate-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={NAME_MAX}
            disabled={busy}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-body text-text-primary focus:outline-none focus:border-border-strong disabled:opacity-60"
            data-testid="room-gate-name"
            aria-label="房间名"
            aria-invalid={!nameOk}
          />
          <span
            className="text-small text-text-muted font-mono whitespace-nowrap"
            data-testid="room-gate-counter"
            aria-live="polite"
          >
            {trimmed.length} / {NAME_MAX}
          </span>
        </div>
        {!nameOk ? (
          <p
            className="text-small text-text-secondary"
            data-testid="room-gate-name-error"
          >
            房间名需 1-24 字符，不含控制字符。
          </p>
        ) : (
          <p
            className="text-small text-text-muted"
            data-testid="room-gate-hint"
          >
            将创建/进入房间【{trimmed}】——名字将永久属于这个房间，创建后不可修改。
          </p>
        )}
      </div>
      {error ? (
        <div className="mb-4">
          <Alert data-testid="room-gate-error">创建失败：{error}</Alert>
        </div>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          onClick={onReject}
          disabled={busy}
          data-testid="room-gate-cancel"
          aria-label="取消创建房间"
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
          data-testid="room-gate-confirm"
          aria-label="创建并进入"
          className="inline-flex items-center justify-center gap-2 font-medium rounded-md transition-colors duration-[120ms] ease-out disabled:opacity-50 disabled:cursor-not-allowed bg-accent text-bg-base hover:bg-accent-hover px-5 py-2.5 text-base"
        >
          {busy ? (
            <span
              data-testid="room-gate-confirm-loading"
              aria-hidden="true"
              className="button-spinner"
            />
          ) : null}
          {busy ? '创建中…' : '创建并进入'}
        </button>
      </div>
    </dialog>
  );
}
