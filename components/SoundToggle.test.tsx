import { describe, it, expect, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('reads persisted muted=false on first paint and starts unmuted', () => {
    window.localStorage.setItem('ttt.sound.muted', '0');
    render(<SoundToggle />);
    const btn = screen.getByTestId('sound-toggle');
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    expect(btn).toHaveAttribute('aria-label', '关闭音效');
  });
});
