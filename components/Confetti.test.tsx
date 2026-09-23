import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Confetti } from './Confetti';
import { burstConfetti } from '@/lib/confetti';

vi.mock('@/lib/confetti', () => ({
  burstConfetti: vi.fn(),
}));

const burstMock = vi.mocked(burstConfetti);

beforeEach(() => {
  burstMock.mockClear();
});

afterEach(() => {
  cleanup();
});

describe('components/Confetti', () => {
  it('calls burstConfetti exactly once on mount (the win-state celebration trigger)', () => {
    render(<Confetti />);
    expect(burstMock).toHaveBeenCalledTimes(1);
  });

  it('renders a stable aria-hidden span mount layer (canvas-confetti owns the visual canvas)', () => {
    const { container } = render(<Confetti />);
    const layer = container.querySelector('[data-testid="confetti"]');
    expect(layer).not.toBeNull();
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    // Pointer-events must stay disabled so the celebration never intercepts
    // board / status-bar clicks underneath.
    expect(layer?.className).toContain('pointer-events-none');
    expect(layer?.className).toContain('fixed');
    expect(layer?.className).toContain('inset-0');
  });
});
