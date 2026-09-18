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
    'data-testid': dataTestid,
  }: {
    href: string;
    className?: string;
    onClick?: (event: { preventDefault(): void }) => void;
    children: ReactNode;
    'data-testid'?: string;
  }) => (
    <a
      href={href}
      className={className}
      data-testid={dataTestid}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    >
      {children}
    </a>
  ),
}));

// Mock next/navigation so StartGameButton's useRouter() doesn't blow up
// in jsdom (which has no app router mounted). The router's push() is a
// no-op here — the test cares about the click → startGame(mode) contract,
// not Next.js routing.
const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  routerPush.mockClear();
  useGameStore.setState({
    phase: 'idle',
    mode: 'online',
    board: [
      null, null, null,
      null, null, null,
      null, null, null,
    ],
    currentPlayer: null,
    winner: null,
    winLine: null,
    playerName: null,
  });
  useGameStore.getState().__resetInternalForTests();
});

describe('components/StartGameButton (parameterized CTA)', () => {
  it('renders href, label, variant and the caller testid', () => {
    render(
      <StartGameButton href="/solo" label="单机练习" mode="offline" variant="secondary" testid="start-solo" />,
    );
    // W1: the testid now sits on the Link (<a>) itself — the dialog
    // and intercept logic attach directly to the anchor so probe
    // selectors like [data-testid="start-solo"] land on the link.
    const link = screen.getByTestId('start-solo');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/solo');
    expect(link).toHaveClass('flex-1');
    expect(link).toHaveTextContent('单机练习');
  });

  it('starts an online game on the /play CTA (default mode contract unchanged)', async () => {
    const user = userEvent.setup();
    render(
      <StartGameButton href="/play" label="开始对战" mode="online" variant="primary" testid="start-game" />,
    );
    await user.click(screen.getByTestId('start-game'));
    const s = useGameStore.getState();
    expect(s.mode).toBe('online');
    expect(s.phase).toBe('playing');
  });

  it('starts an offline game on the /solo CTA', async () => {
    const user = userEvent.setup();
    render(
      <StartGameButton href="/solo" label="单机练习" mode="offline" variant="secondary" testid="start-solo" />,
    );
    await user.click(screen.getByTestId('start-solo'));
    const s = useGameStore.getState();
    expect(s.mode).toBe('offline');
    expect(s.phase).toBe('playing');
  });
});
