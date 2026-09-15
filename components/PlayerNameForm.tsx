'use client';

import { useEffect, useState } from 'react';
import { isPlayerName } from '@/lib/player-name';
import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

/**
 * Player-name input mounted on the home page's stats card. SSR-safe by
 * construction: the first frame renders the "no name set" default, then
 * a mount effect hydrates from the store (which itself reads localStorage
 * via lib/player-name.ts). Saving writes to the store via setPlayerName
 * — the store mirrors the value into localStorage and broadcasts it to
 * the live SoloStatsPanel on /solo via the same-tab CustomEvent.
 *
 * The form intentionally does NOT surface a "save failed" message: the
 * API whitelist is the authoritative gate (saves the API would reject
 * fail silently here too) and the spec keeps the form a one-field
 * affordance.
 */
export function PlayerNameForm() {
  const playerName = useGameStore((s) => s.playerName);
  const setStoreName = useGameStore((s) => s.setPlayerName);
  const [name, setName] = useState<string>('');
  const [hydrated, setHydrated] = useState<boolean>(false);

  // Hydrate the input from the store on mount. The store mirrors
  // localStorage['ttt.player.name.v1'] so a single source of truth is
  // read here. playerName is null on the SSR first frame (the store is
  // a client module and never persisted a name server-side), so we
  // render an empty input + placeholder until hydration finishes.
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
    // Mirror to a CustomEvent so a same-tab SoloStatsPanel listener can
    // re-fetch from the server even when it was mounted before this
    // form's setState propagated through zustand (defense in depth).
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ttt:player-name-changed'));
    }
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
        <span className="text-small text-text-secondary">玩家名（选填）</span>
      </div>
    );
  }

  const hasSaved = playerName !== null && playerName.length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2"
      data-testid="player-name-section"
    >
      <label
        htmlFor="player-name-input"
        className="text-small text-text-secondary"
      >
        玩家名（选填）
      </label>
      <div className="flex items-center gap-2">
        <input
          id="player-name-input"
          name="player-name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={24}
          placeholder={hasSaved ? playerName! : '1-24 字符'}
          className="flex-1 bg-bg-elevated border border-border-subtle rounded-md px-3 py-2 text-body text-text-primary focus:outline-none focus:border-border-strong"
          data-testid="player-name-input"
          aria-label="玩家名"
        />
        <Button
          type="submit"
          variant="secondary"
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
            data-testid="player-name-clear"
            aria-label="清除玩家名"
          >
            清除
          </Button>
        ) : null}
      </div>
      {hasSaved ? (
        <p
          className="text-small text-text-muted"
          data-testid="player-name-current"
        >
          当前：<span className="text-text-primary font-mono">{playerName}</span>
        </p>
      ) : null}
    </form>
  );
}
