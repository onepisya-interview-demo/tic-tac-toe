'use client';

import { useEffect, useState } from 'react';
import { getMuted, setMuted } from '@/lib/sound';

export function SoundToggle() {
  // Initial state must be identical on server and the first client render —
  // otherwise React throws a hydration mismatch on /, /play, /result when
  // the persisted preference differs from the SSR default. We always start
  // muted; useEffect syncs from localStorage after hydration is complete.
  const [muted, setLocalMuted] = useState<boolean>(true);

  useEffect(() => {
    // One-shot hydration of the persisted preference after mount. This is
    // the documented React pattern for reading from an external source that
    // is unavailable during SSR: render the safe default server-side, then
    // reconcile with the real value once mounted. localStorage has no push
    // updates, so useSyncExternalStore would be over-engineering. React 18
    // bails out of the re-render when getMuted() === true (matches state),
    // so the "cascading render" the lint rule warns about never happens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalMuted(getMuted());
  }, []);

  return (
    <button
      type="button"
      data-testid="sound-toggle"
      aria-pressed={!muted}
      aria-label={muted ? '开启音效' : '关闭音效'}
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setLocalMuted(next);
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border-subtle bg-bg-elevated px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors duration-[120ms] ease-out"
    >
      <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-accent" />
      {muted ? '静音' : '音效开'}
    </button>
  );
}
