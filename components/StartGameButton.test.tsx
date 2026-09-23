import { describe, it, expect, vi, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StartGameButton } from './StartGameButton';
import { useGameStore } from '@/lib/store';

import { resetStore } from '@/tests/helpers/reset-store';
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
// no-op here — the test cares about the click → startGame(mode) + gate
// contract, not Next.js routing.
const routerPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  routerPush.mockClear();
  resetStore();
});

describe('components/StartGameButton (W2 landing CTAs)', () => {
  it('renders href, label, variant and the caller testid', () => {
    render(
      <StartGameButton href="/offline" label="线下房间" mode="offline" variant="secondary" testid="start-offline" />,
    );
    const link = screen.getByTestId('start-offline');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/offline');
    expect(link).toHaveClass('flex-1');
    expect(link).toHaveTextContent('线下房间');
  });

  it('offline CTA passes through without a room (pure-local contract preserved)', async () => {
    const user = userEvent.setup();
    render(
      <StartGameButton href="/offline" label="线下房间" mode="offline" variant="secondary" testid="start-offline" requireName={false} />,
    );
    await user.click(screen.getByTestId('start-offline'));
    expect(routerPush).toHaveBeenCalledWith('/offline');
    const s = useGameStore.getState();
    expect(s.mode).toBe('offline');
    expect(s.phase).toBe('playing');
  });

  it('online CTA starts an online game and navigates when roomName is set', async () => {
    const user = userEvent.setup();
    useGameStore.setState({ roomName: 'alice' });
    render(
      <StartGameButton href="/online" label="在线房间" mode="online" variant="primary" testid="start-online" />,
    );
    await user.click(screen.getByTestId('start-online'));
    expect(routerPush).toHaveBeenCalledWith('/online');
    const s = useGameStore.getState();
    expect(s.mode).toBe('online');
    expect(s.phase).toBe('playing');
  });

  it('online CTA blocks navigation + dispatches ttt:room-required (detail {mode, href}) when roomName is empty', async () => {
    const user = userEvent.setup();
    const dispatchSpy = vi.fn();
    const originalDispatch = window.dispatchEvent;
    window.dispatchEvent = ((event: Event) => {
      dispatchSpy(event);
      return originalDispatch.call(window, event);
    }) as typeof window.dispatchEvent;
    try {
      render(
        <StartGameButton href="/online" label="在线房间" mode="online" variant="primary" testid="start-online" />,
      );
      await user.click(screen.getByTestId('start-online'));
      expect(routerPush).not.toHaveBeenCalled();
      const s = useGameStore.getState();
      expect(s.phase).toBe('idle');
      expect(s.mode).toBe('online');
      const required = dispatchSpy.mock.calls
        .map((c) => c[0] as CustomEvent<{ mode: string; href: string }>)
        .filter((e) => e.type === 'ttt:room-required');
      expect(required).toHaveLength(1);
      expect(required[0].detail).toEqual({ mode: 'online', href: '/online' });
    } finally {
      window.dispatchEvent = originalDispatch;
    }
  });

  it('offline CTA ignores an empty roomName and never requires a name (requireName=false)', async () => {
    const user = userEvent.setup();
    const dispatchSpy = vi.fn();
    const originalDispatch = window.dispatchEvent;
    window.dispatchEvent = ((event: Event) => {
      dispatchSpy(event);
      return originalDispatch.call(window, event);
    }) as typeof window.dispatchEvent;
    try {
      render(
        <StartGameButton href="/offline" label="线下房间" mode="offline" variant="secondary" testid="start-offline" requireName={false} />,
      );
      await user.click(screen.getByTestId('start-offline'));
      expect(routerPush).toHaveBeenCalledWith('/offline');
      const required = dispatchSpy.mock.calls
        .map((c) => c[0] as Event)
        .filter((e) => e.type === 'ttt:room-required');
      expect(required).toHaveLength(0);
    } finally {
      window.dispatchEvent = originalDispatch;
    }
  });
});
