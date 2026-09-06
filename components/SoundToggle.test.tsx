import { describe, it, expect, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { SoundToggle } from './SoundToggle';

describe('components/SoundToggle', () => {
  beforeEach(() => {
    window.localStorage.clear();
    cleanup();
  });

  it('first click flips persisted preference from muted to unmuted (regression)', async () => {
    const user = userEvent.setup();
    render(<SoundToggle />);
    const btn = screen.getByTestId('sound-toggle');

    // Initial paint: muted default.
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('aria-label', '开启音效');
    expect(window.localStorage.getItem('ttt.sound.muted')).toBeNull();

    // First click should unmute and persist '0'.
    await user.click(btn);
    expect(window.localStorage.getItem('ttt.sound.muted')).toBe('0');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('aria-label', '关闭音效');

    // Second click should remute and persist '1'.
    await user.click(btn);
    expect(window.localStorage.getItem('ttt.sound.muted')).toBe('1');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('aria-label', '开启音效');
  });

  it('after mount, reads persisted muted=false from localStorage and reflects it', () => {
    window.localStorage.setItem('ttt.sound.muted', '0');
    render(<SoundToggle />);
    const btn = screen.getByTestId('sound-toggle');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('aria-label', '关闭音效');
  });

  it('SSR output is muted regardless of persisted localStorage (regression: hydration mismatch)', () => {
    // Simulate a returning user whose persisted preference is unmuted.
    // On the server there is no window/localStorage, so the SSR output
    // must NOT depend on the client's persisted value — otherwise the
    // first client render diverges from the server and React throws a
    // hydration mismatch (aria-pressed/aria-label/text all flip).
    window.localStorage.setItem('ttt.sound.muted', '0');

    // Patch the SSR window shim so the lazy initializer can't read
    // localStorage even though jsdom provides it — mirroring the real
    // server context where window.localStorage is unavailable.
    const originalGetItem = window.localStorage.getItem;
    window.localStorage.getItem = (() => {
      throw new Error('localStorage is not available during SSR');
    }) as typeof window.localStorage.getItem;

    let html: string;
    try {
      html = renderToString(<SoundToggle />);
    } finally {
      window.localStorage.getItem = originalGetItem;
    }

    expect(html).toContain('aria-label="开启音效"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('静音');
  });
});
