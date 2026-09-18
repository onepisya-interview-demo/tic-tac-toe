'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGameStore, type GameMode } from '@/lib/store';
import { Button } from '@/components/ui/Button';

type Props = {
  /** Navigation target: /play for online, /solo for offline. */
  href: string;
  /** Visible CTA label. */
  label: string;
  /** Mode handed to startGame() on click; omitted resolves to 'online'. */
  mode?: GameMode;
  /** Button variant: primary (main CTA) or secondary (alternate CTA). */
  variant?: 'primary' | 'secondary';
  /** Stable QA testid — the click contract for every probe. */
  testid: string;
};

/**
 * W1 (ulw-one-game-two-versions) rename:
 *
 * - mode: `'ranked'|'solo'` → `'online'|'offline'`.
 * - href + label still point at the current /play + /solo routes; W3
 *   rewires /play → /online and W4 rewires /solo → /offline per the
 *   plan §1.
 *
 * Click handler stays: preventDefault → startGame(mode) → router.push.
 * No intercept logic — the home-return sync dialog lives on
 * `components/HomeDialogMount.tsx` (mount effect on app/page.tsx).
 */
export function StartGameButton({ href, label, mode, variant = 'primary', testid }: Props) {
  const router = useRouter();
  const startGame = useGameStore((s) => s.startGame);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>): void {
    e.preventDefault();
    startGame(mode);
    router.push(href);
  }

  return (
    <Link href={href} className="flex-1" onClick={handleClick} data-testid={testid}>
      <Button variant={variant} className="w-full">
        {label}
      </Button>
    </Link>
  );
}
