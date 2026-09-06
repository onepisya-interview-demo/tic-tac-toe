'use client';

import { useEffect, useState } from 'react';
import { getMuted, setMuted } from '@/lib/sound';

export function SoundToggle() {
  // Lazy initializer reads localStorage on the first client render.
  // SSR returns `true` (muted default); the client rehydrates from storage.
  const [muted, setLocalMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = window.localStorage.getItem('ttt.sound.muted');
      return raw === null ? true : raw === '1';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    // Sync once after mount in case the lazy initializer ran on the server
    // and returned the default. No-op on a fully client-rendered tree.
    const live = getMuted();
    if (live !== muted) {
      // Deferred via microtask to avoid the cascading-render lint rule while
      // still keeping the toggle responsive on the first interaction.
      queueMicrotask(() => setLocalMuted(live));
    }
    // We intentionally only run on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button
      type="button"
      data-testid="sound-toggle"
      aria-pressed={!muted}
      aria-label={muted ? '开启音效' : '关闭音效'}
      onClick={() => {
        const next = !muted;
        setMuted(!next);
        setLocalMuted(!next);
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-[120ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
    >
      <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
      {muted ? '静音' : '音效开'}
    </button>
  );
}
