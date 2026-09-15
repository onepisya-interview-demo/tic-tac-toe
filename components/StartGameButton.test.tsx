import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartGameButton } from './StartGameButton';
import { useGameStore } from '@/lib/store';

// Replace next/link with a plain anchor that still forwards the click
// event: this test owns the mode plumbing (onClick → startGame(mode)),
// not Next's router integration. preventDefault keeps jsdom from
// attempting real navigation.
vi.mock('next/link', () => ({
  default: ({
    href,
    className,
    onClick,
    children,
  }: {
    href: string;
    className?: string;
    onClick?: (event: { preventDefault(): void }) => void;
    children: ReactNode;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  useGameStore.setState({
    phase: 'idle',
    mode: 'ranked',
    board: [
      null, null, null,
      null, null, null,
      null, null, null,
    ],
    currentPlayer: null,
    winner: null,
    winLine: null,
    lastWriteAt: null,
  });
  useGameStore.getState().__resetInternalForTests();
});

describe('components/StartGameButton (parameterized CTA)', () => {
  it('renders href, label, variant and the caller testid', () => {
    render(
      <StartGameButton href="/solo" label="单机练习" mode="solo" variant="secondary" testid="start-solo" />,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/solo');
    expect(link).toHaveClass('flex-1');
    const btn = screen.getByTestId('start-solo');
    expect(btn).toHaveTextContent('单机练习');
    expect(btn).toHaveClass('bg-bg-elevated'); // secondary variant token
  });

  it('starts a ranked game on the /play CTA (default mode contract unchanged)', async () => {
    const user = userEvent.setup();
    render(
      <StartGameButton href="/play" label="开始对战" mode="ranked" variant="primary" testid="start-game" />,
    );
    await user.click(screen.getByTestId('start-game'));
    const s = useGameStore.getState();
    expect(s.mode).toBe('ranked');
    expect(s.phase).toBe('playing');
  });

  it('starts a solo game on the /solo CTA', async () => {
    const user = userEvent.setup();
    render(
      <StartGameButton href="/solo" label="单机练习" mode="solo" variant="secondary" testid="start-solo" />,
    );
    await user.click(screen.getByTestId('start-solo'));
    const s = useGameStore.getState();
    expect(s.mode).toBe('solo');
    expect(s.phase).toBe('playing');
  });
});
