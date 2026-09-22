import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ServiceWorkerRegister } from './ServiceWorkerRegister';

// ServiceWorkerRegister (ulw-pwa-precache): a tiny mount-effect that
// gates SW registration on production builds AND the navigator.serviceWorker
// API. Production-only because dev-mode SW intercepts HMR fetches and
// breaks fast refresh; API-only because older browsers ship without it.
// Errors are swallowed via console.warn so a CSP-blocked or unsupported
// registration failure never breaks hydration.
//
// Coverage:
//   R1: production + navigator.serviceWorker → register('/sw.js')
//   R2: non-production → no register (NODE_ENV=development / undefined)
//   R4: missing navigator.serviceWorker → no register
//   R5: register() rejects → swallowed, no hydration escape hatch breaks

describe('components/ServiceWorkerRegister', () => {
  let register: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.fn>;
  let originalNodeEnv: string | undefined;
  let originalNavigator: typeof navigator;

  beforeEach(() => {
    vi.resetModules();
    register = vi.fn(async () => ({ scope: '/' } as unknown as ServiceWorkerRegistration));
    warnSpy = vi.fn();
    originalNodeEnv = process.env.NODE_ENV;
    originalNavigator = globalThis.navigator;
    // jsdom exposes `navigator` but no `serviceWorker`. We patch a fake
    // serviceWorker onto the existing navigator instance.
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      configurable: true,
      value: { register },
    });
    // Silence the "production-only" warn — the test pins behaviour, not logs.
    // Capture console.warn calls; the test pins behaviour, not log text.
    vi.spyOn(console, 'warn').mockImplementation(warnSpy as unknown as typeof console.warn);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    vi.stubEnv('NODE_ENV', originalNodeEnv ?? '');
    vi.restoreAllMocks();
    void originalNavigator;
  });

  it('R1: production + navigator.serviceWorker → register("/sw.js") fires exactly once on mount', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    render(<ServiceWorkerRegister />);
    // useEffect runs after the first paint; microtask flush is enough.
    await Promise.resolve();
    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith('/sw.js');
  });

  it('R2: NODE_ENV=development → no register (fast-refresh safety)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    render(<ServiceWorkerRegister />);
    await Promise.resolve();
    expect(register).not.toHaveBeenCalled();
  });

  it('R3: NODE_ENV=test → no register (vitest is not production)', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    render(<ServiceWorkerRegister />);
    await Promise.resolve();
    expect(register).not.toHaveBeenCalled();
  });

  it('R4: navigator.serviceWorker absent → no register, no throw', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    });
    expect(() => render(<ServiceWorkerRegister />)).not.toThrow();
    await Promise.resolve();
    expect(register).not.toHaveBeenCalled();
  });

  it('R5: register() rejects → console.warn captures the error (no hydration break)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const cspError = new Error('SW register blocked by CSP');
    register.mockRejectedValueOnce(cspError);
    render(<ServiceWorkerRegister />);
    // Let the promise settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(register).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('Service worker registration failed');
  });

  it('R6: returns null (no DOM mount target — SW owns the canvas)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { container } = render(<ServiceWorkerRegister />);
    expect(container.firstChild).toBeNull();
  });
});
