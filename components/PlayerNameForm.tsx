'use client';

import { useEffect, useState } from 'react';
import { isPlayerName } from '@/lib/player-name';
import { useGameStore } from '@/lib/store';
import { postPlayerSession } from '@/lib/solo-net';
import { Button } from '@/components/ui/Button';

const NAME_MAX = 24;

/**
 * Player-name identity region on the home page
 * (ulw-name-login-one-truth W3 + ulw-ux-refresh-pass W4 折叠 contract).
 *
 * Identity semantics: typing a name is BOTH registration and login
 * (R4 §1.2 "表单字段不变, CTA 文案保持中性"). On submit we POST
 * {name} to /api/player-session; the server returns { stats, existed }
 * so we can surface the right success copy:
 *   - existed:false → 「注册成功，已开始为你记录战绩」 (注册)
 *   - existed:true  → 「已为你登录，欢迎回来 <name>」 (登录)
 *
 * Storage order on success ONLY:
 *   localStorage['ttt.player.name.v1'] + store.playerName. Nothing is
 *   written on failure (422 / network error / aborted); the failure
 *   message stays inline under the input so the user can correct and
 *   retry without losing their typed value.
 *
 * W4 折叠 contract (.omo/plans/ulw-ux-refresh-pass.md §3 W4):
 *   - hasSaved + !editing → 只读态: 名字 + 「编辑」按钮; input/登录/清除/
 *     计数器/反馈块全部隐藏 (player-name-readonly + player-name-edit).
 *   - hasSaved + editing → 既有 input + 登录 + 清除 + 取消 (新增 ghost
 *     「取消」回折叠态, 不写任何持久层).
 *   - !hasSaved → 直接显示 input + 保存 (W3 行为不变).
 *   - 反向 hydration (store 空 + localStorage 有值 → setStoreName) 保留.
 *   - submit 成功 → 自动退出编辑态回折叠态; 清除 → 回到 !hasSaved 分支.
 *
 * Online response never enters localStorage / store.solo — the only
 * server-derived state we keep is the success message text, displayed
 * in this component (ulw A2 red-line: 线上永不进本地).
 *
 * Label + counter contract (R4 §2.1):
 *  - label 「名字（1-24 字符，注册后不可修改）」 — the rule belongs
 *    in the label, not the placeholder, so it stays visible during typing.
 *  - placeholder 暗示: 已存名 → 回显当前名; 未存名 → 输入即注册，再来=登录.
 *  - 永久锁定 hint 在首次触摸后显形 (R4 §1.3.3).
 *  - n/24 live 计数 aria-live="polite".
 *  - 422 等服务端失败就地展示在 input 下方 (R4 §1.4 结论: onBlur
 *    防抖 300-500ms 反馈是行业惯例; W3 scope 走 submit 兜底路径,
 *    onBlur 防抖待 W4+R4 §3 合并实现).
 */
type Feedback =
  | { kind: 'idle' }
  | { kind: 'success'; existed: boolean }
  | { kind: 'error'; message: string };

export function PlayerNameForm() {
  const playerName = useGameStore((s) => s.playerName);
  const setStoreName = useGameStore((s) => s.setPlayerName);
  const [name, setName] = useState<string>('');
  const [touched, setTouched] = useState<boolean>(false);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<Feedback>({ kind: 'idle' });
  // W4 (ulw-ux-refresh-pass) 折叠态: hasSaved=true 时只读, 点编辑展开;
  // !hasSaved 时 editing 永远 true (input 直接显形).
  const [editing, setEditing] = useState<boolean>(false);

  // Two-stage hydration:
  //  1. SSR / first paint: render the label so the layout is stable.
  //  2. After mount: read playerName from the store. If the store is
  //     empty BUT localStorage already has a name (typical of a
  //     /solo → / soft-navigation round-trip where the store never
  //     re-hydrated), mirror it back into the store so OnlineStatsCard
  //     can fire its fetch on the home-return path. This is the
  //     W3 contract that the online card renders as soon as the
  //     user lands on / with a name in localStorage.
  useEffect(() => {
    if (playerName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(playerName);
    } else if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('ttt.player.name.v1');
        if (stored && stored.length > 0 && stored.length <= 24) {
          setStoreName(stored);
          setName(stored);
        }
      } catch {
        // private mode — skip
      }
    }
    setHydrated(true);
  }, [playerName, setStoreName]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    setTouched(true);
    setFeedback({ kind: 'idle' });
    if (!isPlayerName(trimmed)) {
      setFeedback({
        kind: 'error',
        message: '请输入 1-24 个字符，避免不可见字符。',
      });
      return;
    }
    setBusy(true);
    try {
      const r = await postPlayerSession(trimmed);
      if (!r.ok) {
        if (r.reason === 'http-error' && r.status === 422) {
          setFeedback({
            kind: 'error',
            message: '保存失败：名字含不允许的字符。',
          });
        } else if (r.reason === 'aborted') {
          setFeedback({
            kind: 'error',
            message: '保存失败：网络超时，请稍后重试（战绩仍在本地）。',
          });
        } else {
          setFeedback({
            kind: 'error',
            message: '保存失败：网络异常，请稍后重试（战绩仍在本地）。',
          });
        }
        return;
      }
      // Success: write only AFTER server confirmation. Order is
      // localStorage first (so a reload re-hydrates true) then store
      // (so any subscribed UI sees the new identity in the same tick).
      setStoreName(trimmed);
      setFeedback({ kind: 'success', existed: r.value.existed });
      // W4 折叠: 提交成功后回到折叠态 (仅显示 readonly+编辑), 反馈由
      // 只读态旁的下一帧 status pill 替代 (此处直接清掉 feedback 以免
      // 与折叠态布局冲突).
      setEditing(false);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ttt:player-name-changed'));
      }
    } finally {
      setBusy(false);
    }
  }

  function handleClear(): void {
    setName('');
    setStoreName(null);
    setTouched(false);
    setFeedback({ kind: 'idle' });
    setEditing(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ttt:player-name-changed'));
    }
  }

  // W4 取消: 编辑态不写任何持久层, 回折叠态, 清掉草稿与反馈.
  function handleCancel(): void {
    setEditing(false);
    setName(playerName ?? '');
    setTouched(false);
    setFeedback({ kind: 'idle' });
  }

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-2" data-testid="player-name-section">
        <span className="text-small text-text-secondary">
          名字（1-24 字符，注册后不可修改）
        </span>
      </div>
    );
  }

  // W4 折叠判定: hasSaved + 非编辑 = 只读态. !hasSaved 永远展开.
  const hasSaved = playerName !== null && playerName.length > 0;
  const folded = hasSaved && !editing;
  const trimmed = name.trim();
  const showFormatError =
    touched && name.length > 0 && !isPlayerName(name);
  const showLockHint = touched && name.length > 0 && isPlayerName(name) && !hasSaved;

  if (folded) {
    return (
      <div
        className="flex flex-col gap-2"
        data-testid="player-name-section"
      >
        <div className="flex flex-row flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="text-small text-text-secondary"
              aria-label="当前玩家名"
            >
              当前：
            </span>
            <span
              className="rounded-md border border-border-subtle bg-bg-elevated px-3 py-1.5 text-body text-text-primary font-mono"
              data-testid="player-name-readonly"
            >
              {playerName}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditing(true);
              setName(playerName ?? '');
              setTouched(false);
              setFeedback({ kind: 'idle' });
            }}
            className="w-full sm:w-auto"
            data-testid="player-name-edit"
            aria-label="编辑玩家名"
          >
            编辑
          </Button>
        </div>
        {feedback.kind === 'success' ? (
          <p
            className="text-small text-text-primary"
            data-testid="player-name-feedback"
            data-feedback-kind={feedback.existed ? 'login' : 'register'}
            role="status"
            aria-live="polite"
          >
            {feedback.existed
              ? `已为你登录，欢迎回来 ${trimmed}。`
              : '注册成功，已开始为你记录战绩。'}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2"
      data-testid="player-name-section"
    >
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="player-name-input"
          className="text-small text-text-secondary"
        >
          名字（1-24 字符，注册后不可修改）
        </label>
        <span
          className="text-small text-text-muted font-mono whitespace-nowrap"
          data-testid="player-name-counter"
          aria-live="polite"
        >
          {trimmed.length} / {NAME_MAX}
        </span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          id="player-name-input"
          name="player-name-input"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (feedback.kind === 'success' || feedback.kind === 'error') {
              setFeedback({ kind: 'idle' });
            }
          }}
          onBlur={() => setTouched(true)}
          maxLength={NAME_MAX}
          placeholder={
            hasSaved
              ? playerName!
              : '输入你的名字（首次注册，再来=登录）'
          }
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={busy}
          className="w-full sm:flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-body text-text-primary focus:outline-none focus:border-border-strong disabled:opacity-60"
          data-testid="player-name-input"
          aria-label="玩家名"
          aria-invalid={showFormatError}
          aria-describedby={
            showFormatError
              ? 'player-name-error'
              : feedback.kind === 'error'
                ? 'player-name-feedback'
                : undefined
          }
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            variant="secondary"
            disabled={busy}
            className="w-full sm:w-auto"
            data-testid="player-name-save"
            aria-label={hasSaved ? '登录并保存玩家名' : '保存玩家名'}
          >
            {busy ? '保存中…' : hasSaved ? '登录' : '保存'}
          </Button>
          {hasSaved ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                disabled={busy}
                className="w-full sm:w-auto"
                data-testid="player-name-clear"
                aria-label="清除玩家名"
              >
                清除
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                disabled={busy}
                className="w-full sm:w-auto"
                data-testid="player-name-cancel"
                aria-label="取消编辑玩家名"
              >
                取消
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {showFormatError ? (
        <p
          id="player-name-error"
          className="text-small text-text-secondary"
          data-testid="player-name-error"
          role="alert"
        >
          请输入 1-24 个字符，避免不可见字符。
        </p>
      ) : null}
      {showLockHint ? (
        <p
          className="text-small text-text-muted"
          data-testid="player-name-hint"
        >
          这个名字将永久属于你，注册后不可修改。
        </p>
      ) : null}
      {feedback.kind === 'success' ? (
        <p
          className="text-small text-text-primary"
          data-testid="player-name-feedback"
          data-feedback-kind={feedback.existed ? 'login' : 'register'}
          role="status"
          aria-live="polite"
        >
          {feedback.existed
            ? `已为你登录，欢迎回来 ${trimmed}。`
            : '注册成功，已开始为你记录战绩。'}
        </p>
      ) : null}
      {feedback.kind === 'error' ? (
        <p
          id="player-name-feedback"
          className="text-small text-text-secondary"
          data-testid="player-name-feedback"
          data-feedback-kind="error"
          role="alert"
        >
          {feedback.message}
        </p>
      ) : null}
    </form>
  );
}
