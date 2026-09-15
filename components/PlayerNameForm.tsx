'use client';

import { useEffect, useState } from 'react';
import { getPlayerName, setPlayerName } from '@/lib/player-name';
import { Button } from '@/components/ui/Button';

/**
 * Player-name input mounted on the home page's stats card. SSR-safe by
 * construction: the first frame renders the "no name set" default, then
 * a mount effect hydrates from localStorage (same pattern as
 * SoundToggle / SoloStatsPanel — never read localStorage in the server
 * frame).
 *
 * Saving writes to localStorage and triggers a custom event so the
 * SoloStatsPanel on /solo can re-pull without a hard navigation. The
 * form intentionally does NOT surface a "save failed" message: the API
 * whitelist is the authoritative gate (saves the API would reject fail
 * silently here too) and the spec keeps the form a one-field affordance.
 */
export function PlayerNameForm() {
  const [name, setName] = useState<string>('');
  const [savedName, setSavedName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    const current = getPlayerName();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSavedName(current);
    setName(current ?? '');
    setHydrated(true);
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const ok = setPlayerName(name);
    if (!ok) return;
    const trimmed = name.trim();
    setSavedName(trimmed);
    // Notify in-page subscribers (SoloStatsPanel) that the name changed
    // — `name` event is the same key they should listen on.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ttt:player-name-changed'));
    }
  }

  function handleClear(): void {
    setName('');
    setSavedName(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('ttt.player.name.v1');
      window.dispatchEvent(new CustomEvent('ttt:player-name-changed'));
    }
  }

  // Before hydration, render nothing extra so SSR output matches the
  // first client frame (the savedName label would otherwise flicker).
  if (!hydrated) {
    return (
      <div className="flex flex-col gap-2" data-testid="player-name-section">
        <span className="text-small text-text-secondary">玩家名（选填）</span>
      </div>
    );
  }

  const hasSaved = savedName !== null && savedName.length > 0;

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
          placeholder={hasSaved ? savedName : '1-24 字符'}
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
          当前：<span className="text-text-primary font-mono">{savedName}</span>
        </p>
      ) : null}
    </form>
  );
}
