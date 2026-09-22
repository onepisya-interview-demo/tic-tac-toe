'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/** sessionStorage key holding the immediately-previous in-app route. */
export const NAV_PREV_KEY = 'ttt.nav.prev.v1';

/** Read-and-clear the previous-route marker (consume-on-read). */
export function consumeNavPrev(): string | null {
  if (typeof window === 'undefined') return null;
  const prev = window.sessionStorage.getItem(NAV_PREV_KEY);
  window.sessionStorage.removeItem(NAV_PREV_KEY);
  return prev;
}

// React warns on useLayoutEffect during the SSR pass; the tracker renders
// null server-side and only needs the pre-passive ordering in the browser.
const usePrePassiveEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Root-layout route tracker (BR-1, docs/business-rules.md).
 *
 * Persists the immediately-previous in-app route to sessionStorage on every
 * navigation so route-scoped consumers can distinguish「软导航到达」from
 * 「直接进入 / 硬刷新」. A component mounted only on '/' unmounts when the
 * user leaves, so it cannot track its own source route — this tracker
 * survives every navigation because it lives in the root layout.
 *
 * usePrePassiveEffect guarantees the write lands before any passive effect
 * of a page-level consumer reads it within the same navigation commit.
 * Consume-on-read in the consumer makes hard reloads inert: the marker
 * survives navigation but not a deliberate re-entry (BR-1 反面场景).
 */
export function NavPrevTracker() {
  const pathname = usePathname();
  const prevRef = useRef<string | null>(null);

  usePrePassiveEffect(() => {
    if (prevRef.current !== null && prevRef.current !== pathname) {
      window.sessionStorage.setItem(NAV_PREV_KEY, prevRef.current);
    }
    prevRef.current = pathname;
  }, [pathname]);

  return null;
}
