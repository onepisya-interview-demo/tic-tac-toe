'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
 * W3 (ulw-name-login-one-truth): the legacy start-game intercept
 * (`pendingSyncCount() > 0 → SyncConfirmDialog → 合并并清空 / 保留本地`)
 * has been retired. Decision D1 moves the dialog surface to the
 * home-return path (home page mount effect — see app/page.tsx), so
 * the start-game buttons now navigate directly with zero overhead.
 *
 * Concretely: removing the intercept kills three contracts that are
 * now gone forever:
 *  - the dead `void fetchSoloStats(name)` that CR flagged as P1-4
 *    (no caller now needs to re-pull the row — the online card on
 *    home owns its own GET).
 *  - the redundant `putSoloName` call inside `runMerge` (PUT 存名 is
 *    gone; `postPlayerSession` in the dialog flow handles 登录).
 *  - the 「合并并清空」 CTA on this button (now lives on the
 *    home-return SyncConfirmDialog).
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
