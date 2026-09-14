'use client';

import Link from 'next/link';
import { useGameStore, type GameMode } from '@/lib/store';
import { Button } from '@/components/ui/Button';

type Props = {
  /** Navigation target: /play for ranked, /solo for solo. */
  href: string;
  /** Visible CTA label. */
  label: string;
  /** Mode handed to startGame() on click; omitted resolves to 'ranked'
   * in the store (the historical /play behavior). */
  mode?: GameMode;
  /** Button variant: primary (main CTA) or secondary (alternate CTA). */
  variant?: 'primary' | 'secondary';
  /** Stable QA testid — the click contract for every probe. */
  testid: string;
};

/**
 * CTA that starts a game in the given mode and navigates to its page.
 * Previously hardcoded to /play + ranked; parameterized so the home
 * page can render both CTAs (开始对战 / 单机练习) from one component.
 * The onClick keeps the arrow-wrapper form (W1): startGame takes an
 * optional mode, so a bare onClick={startGame} would swallow the click
 * event as the mode argument.
 */
export function StartGameButton({ href, label, mode, variant = 'primary', testid }: Props) {
  const startGame = useGameStore((s) => s.startGame);
  return (
    <Link href={href} className="flex-1" onClick={() => startGame(mode)}>
      <Button variant={variant} className="w-full" data-testid={testid}>
        {label}
      </Button>
    </Link>
  );
}
