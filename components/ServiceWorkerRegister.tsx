'use client';

import { useEffect } from 'react';

/**
 * Register /sw.js on production builds only. Dev mode intentionally skips
 * registration because an active service worker breaks Next.js fast refresh
 * (the worker intercepts HMR fetches and serves stale bundles). When we
 * eventually add real caching we should keep this guard and re-evaluate
 * the dev-mode implication rather than dropping it — losing fast refresh
 * in exchange for caching dev assets is a bad trade.
 *
 * Errors are logged via console.warn (not thrown) so a CSP-blocked or
 * unsupported-browser registration failure never breaks hydration. The
 * only user-visible effect of a failed registration is no offline /
 * install support — the game itself still works.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
      return;
    }
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => {
        console.warn('Service worker registration failed:', err);
      });
  }, []);

  return null;
}

export default ServiceWorkerRegister;
