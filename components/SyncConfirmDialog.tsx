'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { isPlayerName } from '@/lib/player-name';
import { postPlayerSession, postSoloSync } from '@/lib/solo-net';
import { loadSoloStats } from '@/lib/solo-stats';
import type { GameStats } from '@/lib/game';

const NAME_MAX = 24;
export const SYNC_DECLINED_KEY = 'ttt.solo.sync-declined.v1';

/**
 * Home-return sync dialog (ulw-name-login-one-truth W3 contract).
 *
 * Decision D1: the dialog now lives on the home page, opened by the
 * home page's mount effect when `pendingSyncCount() > declinedSentinel`
 * (the sentinel is a sessionStorage value written when the user picks
 * "保留本地" — see writeDeclinedPending below). Start-game buttons no
 * longer gate the flow (StartGameButton has zero intercept after W3).
 *
 * Two CTA branches:
 *  - "保留本地"  → onReject fires → caller writes the sentinel → zero
 *    network writes, dialog closes.
 *  - "合并并清空" → onConfirm receives the chosen name + the server's
 *    merged row (post-merge). The dialog internally runs the
 *    register/login + merge sequence so the caller only needs to
 *    clear local + sentinel on success.
 *
 * Frame contract (R4 §2.2):
 *  - 主标题「合并战绩」 + 副标题「将上传本机 N 局；同步后本机清零以防重复」
 *  - 弹框内 name 输入框（label 前置规则 + n/24 计数 + 永久锁定 hint）
 *  - 主 CTA「合并并清空」 / 次 CTA「保留本地」
 *  - 错误就地展示 + ESC = 「保留本地」(零网络写)
 *
 * F3 fix (carried forward from prior wave): showModal() focus defaults
 * to the dialog itself; we explicitly focus the primary CTA so Enter
 * confirms by default and the keyboard affordance is unambiguous.
 */
export interface SyncConfirmDialogProps {
  open: boolean;
  /** Local stats count surfaced in the copy as "本机 N 局". */
  pendingGamesCount: number;
  /**
   * Pre-filled name from store.playerName when the player already
   * registered / logged in. Empty when no name is set yet — the
   * user must type a name inside the dialog to register / log in
   * before the merge can proceed (the home-return flow guarantees
   * the dialog only opens when there ARE pending games, and the
   * sync endpoint rejects absent rows with 409).
   */
  initialName: string;
  /**
   * Fired when the user picks "合并并清空". Receives the chosen name
   * (post-trim, post-validate) and the server's merged row (after
   * the register-or-login + merge sequence succeeded). The caller
   * uses the merged row's totalGames to update the local sentinel
   * so the next home-return has pending = 0 and won't re-open.
   */
  onConfirm?: (name: string) => Promise<void> | void;
  /**
   * Fired AFTER `onConfirm` resolves successfully (currently unused —
   * kept for future "navigate after merge" callers; the dialog
   * closes itself on success).
   */
  onAfterConfirm?: () => void;
  /** Fired when the user picks "保留本地" or hits ESC. Zero network writes. */
  onReject: () => void;
}

export function SyncConfirmDialog({
  open,
  pendingGamesCount,
  initialName,
  onConfirm,
  onAfterConfirm,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setName(initialName);
  }, [open, initialName]);

  // Open / close the native <dialog>. showModal() brings focus trap,
  // ESC handler, and inert background for free.
  //
  // F3 fix (W4 — actual browser focus): the sibling useEffect that
  // calls `setName(initialName)` schedules a re-render in the same
  // commit phase, and that re-render can steal the focus from the
  // primary button we just set it on. Defer the focus to a
  // requestAnimationFrame so it lands after React's re-render has
  // settled, on top of the showModal() focus call (which itself
  // targets the first focusable = the name input).
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

  async function runMergeSequence(): Promise<GameStats> {
    // Two-step sequence: (1) postPlayerSession guarantees the row
    // exists (注册 if fresh, 登录 if existing); (2) postSoloSync
    // merges the local snapshot into the row. The server answers
    // 409 on sync if the row vanished in between; we surface that
    // verbatim so the user knows to retry after re-logging in.
    const session = await postPlayerSession(trimmed);
    if (!session.ok) {
      if (session.reason === 'http-error' && session.status === 422) {
        throw new Error('名字含不允许的字符');
      }
      if (session.reason === 'aborted') {
        throw new Error('登录超时，请稍后重试（战绩仍在本地）');
      }
      throw new Error('登录失败，请稍后重试（战绩仍在本地）');
    }
    const localSnapshot = loadSoloStats();
    const r = await postSoloSync(trimmed, localSnapshot);
    if (!r.ok) {
      throw new Error(
        r.reason === 'http-error' && r.status === 409
          ? '需要先登录该账号才能同步（请重新输入名字）'
          : r.reason === 'http-error'
            ? `同步失败 (HTTP ${r.status ?? '?'})`
            : `同步失败 (${r.reason})`,
      );
    }
    return r.value.stats;
  }

  async function handleConfirm(): Promise<void> {
    if (!canConfirm) return;
    setBusy(true);
    setError(null);
    try {
      // W4 F1 fix: the merged row is no longer forwarded to the
      // caller — HomeDialogMount writes a fixed baseline (0) right
      // after clearSoloStats(). We still await the sequence so the
      // loading / error / disabled-button contract is preserved.
      await runMergeSequence();
      if (onConfirm) await onConfirm(trimmed);
      // Success path: fire the (currently unused) onAfterConfirm
      // hook. Failure path keeps the dialog open via setError() so
      // this hook MUST NOT run on throw.
      onAfterConfirm?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>): void {
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
            disabled={busy}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-body text-text-primary focus:outline-none focus:border-border-strong disabled:opacity-60"
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
        ) : (
          <p
            className="text-small text-text-muted"
            data-testid="sync-confirm-lock-hint"
          >
            这个名字将永久属于你，注册后不可修改。
          </p>
        )}
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

/**
 * Read the most recent "保留本地" rejection value (pending count at
 * the moment the user rejected the dialog). SSR-safe. Used by the
 * home-return effect to decide whether to re-open the dialog.
 */
export function loadDeclinedPending(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.sessionStorage.getItem(SYNC_DECLINED_KEY);
    if (raw === null) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/**
 * Write the declined sentinel. Called from the home page's onReject
 * handler so a same-session re-mount doesn't re-open the dialog
 * with the same pending count (D3 决策: 「保留本地」零网络写 + 同会话
 * pending 无增量不重弹).
 */
export function writeDeclinedPending(pending: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SYNC_DECLINED_KEY, String(pending));
  } catch {
    // Private mode: degrade to in-memory only (sessionStorage throws).
  }
}

/**
 * Clear the declined sentinel after a successful merge. Mirrors
 * `clearSoloStats()` / `persistSyncedServerTotal` symmetry — once
 * the merge succeeds, the next visit has pending = 0 and the dialog
 * wouldn't re-open anyway, but clearing the sentinel makes the
 * next-play loop's behaviour deterministic.
 */
export function clearDeclinedPending(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SYNC_DECLINED_KEY);
  } catch {
    // Nothing to recover.
  }
}
