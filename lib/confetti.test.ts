import { describe, it, expect, vi, beforeEach } from 'vitest';

const confettiMock = vi.fn();
vi.mock('canvas-confetti', () => ({
  default: (...args: unknown[]) => confettiMock(...args),
}));

describe('lib/confetti (canvas-confetti burst)', () => {
  beforeEach(() => {
    confettiMock.mockReset();
    // requestAnimationFrame is a no-op stub: return 0, do NOT invoke the
    // callback synchronously. This stops the burst loop after the first
    // iteration so the test stays bounded. The first iteration still calls
    // confetti twice (left edge + right edge) which is what the burst
    // function does before scheduling another frame.
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 0);
  });

  it('burstConfetti fires two edge bursts in the first frame', async () => {
    const { burstConfetti } = await import('./confetti');
    burstConfetti();
    expect(confettiMock.mock.calls.length).toBe(2);
  });

  it('burstConfetti uses a colorful palette that includes the brand accent and warm colors', async () => {
    const { burstConfetti } = await import('./confetti');
    burstConfetti();
    const colors = confettiMock.mock.calls
      .map((c) => (c[0] as { colors?: string[] } | undefined)?.colors)
      .filter((c): c is string[] => Array.isArray(c));
    expect(colors.length).toBe(2);
    const flat = colors.flat();
    // Brand emerald accent
    expect(flat).toContain('#34D399');
    // A warm celebration color (not just monochrome green).
    const warmCount = flat.filter(
      (c) => /^#[89ab]/.test(c) || /^#[fF]/.test(c),
    ).length;
    expect(warmCount).toBeGreaterThanOrEqual(2);
  });

  it('burstConfetti sprays from both edges (origin.x in {0,1})', async () => {
    const { burstConfetti } = await import('./confetti');
    burstConfetti();
    const origins = confettiMock.mock.calls
      .map((c) => (c[0] as { origin?: { x?: number } } | undefined)?.origin?.x)
      .filter((x): x is number => typeof x === 'number');
    expect(origins).toContain(0);
    expect(origins).toContain(1);
  });

  it('burstConfetti is a no-op when prefers-reduced-motion is set', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (q: string) =>
      ({
        matches: q.includes('reduce'),
        media: q,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList;
    const { burstConfetti } = await import('./confetti');
    burstConfetti();
    expect(confettiMock).not.toHaveBeenCalled();
    window.matchMedia = originalMatchMedia;
  });
});
