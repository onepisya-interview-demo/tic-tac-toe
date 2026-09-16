'use client';

import { useEffect, useState } from 'react';
import { isPlayerName, PLAYER_NAME_KEY } from '@/lib/player-name';
import { useGameStore } from '@/lib/store';
import { putSoloName } from '@/lib/solo-net';
import { Button } from '@/components/ui/Button';

const NAME_MAX = 24;
const NAME_MIN = 1;

/**
 * Player-name input mounted on the home page's stats card. SSR-safe by
 * construction: the first frame renders the "no name set" default, then
 * a mount effect hydrates from the store (which itself reads localStorage
 * via lib/player-name.ts). Saving writes to the store via setPlayerName
 * — the store mirrors the value into localStorage and broadcasts it to
 * the live SoloStatsPanel on /solo via the same-tab CustomEvent.
 *
 * Responsive contract (ulw-solo-sync-rebuild.md B-T5 / wave-2 §V4):
 *  - mobile (< sm): input full-width, buttons row also full-width and
 *    stacked (纵排) so the form fits a 375px viewport without horizontal
 *    overflow.
 *  - sm+: input + button row horizontal, save + clear side by side.
 *
 * Label + counter contract (rux.md 决议 1):
 *  - label 「名字（1-24 字符）」 puts the rule in the label, not the
 *    placeholder (which disappears once typing starts).
 *  - right-side n/24 live counter uses aria-live="polite" so SR users
 *    hear the count tick up; no joy on hitting the cap.
 *
 * Save flow (B-T1): fire-and-forget idempotent PUT /api/solo-stats
 * after setStoreName. 8s AbortController timeout via putSoloName's
 * withTimeout; failure (network, 422, aborted) is fail-soft — local
 * save already succeeded, the panel surfaces a retry affordance on
 * next sync.
 */
export function PlayerNameForm() {
  const playerName = useGameStore((s) => s.playerName);
  const setStoreName = useGameStore((s) => s.setPlayerName);
  const [name, setName] = useState<string>('');
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(playerName ?? '');
    setHydrated(true);
  }, [playerName]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmed = name.trim();
    if (!isPlayerName(trimmed)) return;
    setStoreName(trimmed);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ttt:player-name-changed'));
    }
    void putSoloName(trimmed);
  }

  function handleClear(): void {
    setName('');
    setStoreName(null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ttt:player-name-changed'));
    }
  }

  if (!hydrated) {
    return (
      <div className="flex flex-col gap-2" data-testid="player-name-section">
        <span className="text-small text-text-secondary">名字（1-24 字符）</span>
      </div>
    );
  }

  const hasSaved = playerName !== null && playerName.length > 0;
  const trimmed = name.trim();
  const showError = name.length > 0 && !isPlayerName(name);
  const errorReason =
    trimmed.length < NAME_MIN
      ? '名字过短'
      : trimmed.length > NAME_MAX
        ? '名字过长'
        : '含控制字符';

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
          名字（1-24 字符）
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
          onChange={(e) => setName(e.target.value)}
          maxLength={NAME_MAX}
          placeholder={hasSaved ? playerName! : '请输入玩家名'}
          className="w-full sm:flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-body text-text-primary focus:outline-none focus:border-border-strong"
          data-testid="player-name-input"
          aria-label="玩家名"
          aria-invalid={showError}
          aria-describedby={
            showError ? 'player-name-error' : undefined
          }
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="submit"
            variant="secondary"
            className="w-full sm:w-auto"
            data-testid="player-name-save"
            aria-label="保存玩家名"
          >
            保存
          </Button>
          {hasSaved ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleClear}
              className="w-full sm:w-auto"
              data-testid="player-name-clear"
              aria-label="清除玩家名"
            >
              清除
            </Button>
          ) : null}
        </div>
      </div>
      {showError ? (
        <p
          id="player-name-error"
          className="text-small text-text-secondary"
          data-testid="player-name-error"
          role="alert"
        >
          {errorReason}
        </p>
      ) : null}
      {hasSaved ? (
        <p
          className="text-small text-text-muted"
          data-testid="player-name-current"
        >
          当前：<span className="text-text-primary font-mono">{playerName}</span>
          <span className="ml-2 text-text-muted">
            （保存在 localStorage「{PLAYER_NAME_KEY}」）
          </span>
        </p>
      ) : null}
    </form>
  );
}
