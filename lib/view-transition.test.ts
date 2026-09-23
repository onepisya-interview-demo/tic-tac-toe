// BR: 案① 时序契约 — lib/view-transition.ts afterViewTransition 分支矩阵
//
// Source: lib/view-transition.ts (667b9ea) + .omo/plans/ulw-transition-alert-unit-tests-20260923.md §三

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { afterViewTransition } from './view-transition';

// -- helpers ------------------------------------------------------------------

/**
 * Build a synthetic animationend Event whose `animationName` the source reads
 * via `(e as AnimationEvent).animationName` (lib/view-transition.ts:37). jsdom
 * does not ship AnimationEvent; Object.assign-ing the property onto a plain
 * Event is enough because the source only reads `.animationName`, never
 * `e instanceof AnimationEvent`.
 */
function makeAnimationEnd(animationName: string): Event {
  return Object.assign(new Event('animationend'), { animationName });
}

/**
 * Replace window.requestAnimationFrame with a queue that drains one callback
 * per `.flush()` call. The source nests two rAFs on the hasVT=false path
 * (lib/view-transition.ts:45,58), so a sync-fire rAF would collapse both
 * into a single tick and hide the ordering bug a regression might introduce.
 */
function queueRaf(): { flush: () => void; pending: () => number } {
  const queue: FrameRequestCallback[] = [];
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback): number => {
    queue.push(cb);
    return queue.length;
  });
  return {
    flush: () => {
      // Drain ONE callback per flush so a nested rAF scheduled inside the
      // drained callback is observed by the caller via pending() / next
      // flush() — that mirrors the source's two-tick hasVT=false path
      // (lib/view-transition.ts:45 then :58).
      const next = queue.shift();
      if (next) next(0);
    },
    pending: () => queue.length,
  };
}

/**
 * Install document.getAnimations (not present on jsdom Document) then spy on
 * it so we can control what animations the source sees. Returns the spy so
 * tests can assert call counts and restore the original at teardown.
 */
function spyOnGetAnimations(): ReturnType<typeof vi.spyOn> {
  if (!('getAnimations' in document)) {
    Object.defineProperty(document, 'getAnimations', {
      configurable: true,
      writable: true,
      value: () => [],
    });
  }
  return vi.spyOn(document, 'getAnimations' as unknown as 'getAnimations');
}

// -- per-test scaffolding -----------------------------------------------------

let rafApi: ReturnType<typeof queueRaf>;
let addSpy: ReturnType<typeof vi.spyOn>;
let removeSpy: ReturnType<typeof vi.spyOn>;
let timerSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  rafApi = queueRaf();
  addSpy = vi.spyOn(document, 'addEventListener');
  removeSpy = vi.spyOn(document, 'removeEventListener');
  // Source uses window.setTimeout (lib/view-transition.ts:29). vi.useFakeTimers
  // already covers it; the spy is for asserting cleanup (clearTimeout call).
  timerSpy = vi.spyOn(globalThis, 'clearTimeout');
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// -- tests --------------------------------------------------------------------

describe('lib/view-transition (afterViewTransition branch matrix)', () => {
  it('runs callback synchronously when document is undefined (SSR no-op)', () => {
    // SSR contract: lib/view-transition.ts:24-27 — typeof document ===
    // 'undefined' must short-circuit and call the callback immediately,
    // without touching window / setTimeout / rAF.
    vi.stubGlobal('document', undefined);
    const cb = vi.fn();
    afterViewTransition(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    // No timers, no listeners (we never reached the timer/listener branches).
    expect(timerSpy).not.toHaveBeenCalled();
    expect(addSpy).not.toHaveBeenCalled();
  });

  it('fires callback when matching animationend arrives (page-fade-in)', () => {
    // Contract: lib/view-transition.ts:36-43 — onEnd only calls finish()
    // when e.animationName is one of the two whitelisted names. We dispatch
    // 'page-fade-in' after the first rAF flush (which installs the listener).
    const getAnims = spyOnGetAnimations();
    getAnims.mockReturnValue([
      { animationName: 'page-fade-in' } as unknown as Animation,
    ]);
    const cb = vi.fn();
    afterViewTransition(cb);
    // First (and only) rAF installs the listener + probes animations.
    expect(rafApi.pending()).toBe(1);
    expect(cb).not.toHaveBeenCalled();
    rafApi.flush();
    expect(cb).not.toHaveBeenCalled();
    // Dispatch the matching animationend on document; capture-phase listener
    // should observe it and trigger finish().
    document.dispatchEvent(makeAnimationEnd('page-fade-in'));
    expect(cb).toHaveBeenCalledTimes(1);
    getAnims.mockRestore();
  });

  it('falls back to 600ms safety when animationend never fires', () => {
    // Contract: lib/view-transition.ts:29,44 — setTimeout(finish, 600)
    // ensures the dialog never waits forever when the animationend event is
    // suppressed (e.g. reduced-motion, missing VT pseudo-element event).
    const getAnims = spyOnGetAnimations();
    getAnims.mockReturnValue([
      { animationName: 'page-fade-in' } as unknown as Animation,
    ]);
    const cb = vi.fn();
    afterViewTransition(cb);
    rafApi.flush();
    expect(cb).not.toHaveBeenCalled();
    // Advance fake clock past the 600ms safety; callback must fire exactly once.
    vi.advanceTimersByTime(600);
    expect(cb).toHaveBeenCalledTimes(1);
    getAnims.mockRestore();
  });

  it('fires after double rAF when no VT animation is registered', () => {
    // Contract: lib/view-transition.ts:55-61 — if getAnimations() returns
    // no whitelisted animation (instant nav / no VT support / jsdom), the
    // source schedules one extra rAF before finish().
    const getAnims = spyOnGetAnimations();
    getAnims.mockReturnValue([]);
    const cb = vi.fn();
    afterViewTransition(cb);
    // Flush the first rAF: installs listener + sees hasVT=false + enqueues
    // a second rAF. Callback must not have fired yet.
    expect(rafApi.pending()).toBe(1);
    rafApi.flush();
    expect(cb).not.toHaveBeenCalled();
    expect(rafApi.pending()).toBe(1);
    // Flush the second rAF: now finish() runs and the callback fires.
    rafApi.flush();
    expect(cb).toHaveBeenCalledTimes(1);
    getAnims.mockRestore();
  });

  it('guards against duplicate callback across multiple triggers', () => {
    // Contract: lib/view-transition.ts:30-35 — the `done` flag and cleanup
    // (removeEventListener + clearTimeout) guard against double-firing when
    // both the matching animationend AND the safety timer want to resolve.
    const getAnims = spyOnGetAnimations();
    getAnims.mockReturnValue([
      { animationName: 'view-swap-in' } as unknown as Animation,
    ]);
    const cb = vi.fn();
    afterViewTransition(cb);
    rafApi.flush();
    // Resolve via animationend first.
    document.dispatchEvent(makeAnimationEnd('view-swap-in'));
    expect(cb).toHaveBeenCalledTimes(1);
    // Safety timer still pending on the fake clock; advancing past it must
    // NOT fire the callback a second time.
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
    getAnims.mockRestore();
  });

  it('cleans up listeners and timer after firing', () => {
    // Contract: lib/view-transition.ts:31-32,45 — finish() must call
    // removeEventListener('animationend', ...) and clearTimeout on the
    // safety timer, so the page never accumulates ghost handlers.
    const getAnims = spyOnGetAnimations();
    getAnims.mockReturnValue([
      { animationName: 'page-fade-in' } as unknown as Animation,
    ]);
    const cb = vi.fn();
    afterViewTransition(cb);
    rafApi.flush();
    document.dispatchEvent(makeAnimationEnd('page-fade-in'));
    expect(cb).toHaveBeenCalledTimes(1);
    // The listener reference is the inner `onEnd` closure; checking call
    // args' first slot (event name) is enough to prove cleanup ran on the
    // correct channel.
    expect(removeSpy).toHaveBeenCalled();
    const callArgs = removeSpy.mock.calls[0];
    expect(callArgs[0]).toBe('animationend');
    expect(typeof callArgs[1]).toBe('function');
    expect(timerSpy).toHaveBeenCalled();
    // Subsequent animationend events must be ignored (listener removed).
    document.dispatchEvent(makeAnimationEnd('page-fade-in'));
    expect(cb).toHaveBeenCalledTimes(1);
    // Advancing the fake clock past 600ms after firing must not re-fire.
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
    getAnims.mockRestore();
  });

  it('ignores animationend with non-matching animationName', () => {
    // Contract: lib/view-transition.ts:36-43 — onEnd ignores any
    // animationName outside the {page-fade-in, view-swap-in} whitelist, so
    // unrelated component animations (cell-pop, fade-in-out, etc.) cannot
    // prematurely trigger the dialog.
    const getAnims = spyOnGetAnimations();
    getAnims.mockReturnValue([
      { animationName: 'page-fade-in' } as unknown as Animation,
    ]);
    const cb = vi.fn();
    afterViewTransition(cb);
    rafApi.flush();
    document.dispatchEvent(makeAnimationEnd('cell-pop'));
    expect(cb).not.toHaveBeenCalled();
    // Only the safety timer should eventually fire the callback.
    vi.advanceTimersByTime(600);
    expect(cb).toHaveBeenCalledTimes(1);
    getAnims.mockRestore();
  });
});
