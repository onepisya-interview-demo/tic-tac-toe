'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

/**
 * Which stats store this button clears:
 * - 'server' (default): the home-page contract — await resetAll()
 *   (DELETE /api/stats) then router.refresh(), preserving the B-3b
 *   invariant (commit fd4a66f): the force-dynamic RSC re-reads only
 *   after the DELETE has landed. data-testid stays "reset-stats".
 * - 'local': the solo contract — resetSoloStats() is a synchronous,
 *   purely local store action (clears the localStorage row + internal
 *   cache). No network, no router.refresh (nothing server-side
 *   changed; the panel re-renders via onCleared). data-testid is
 *   "reset-solo-stats", its own QA contract.
 *
 * `onCleared` fires after either branch settles so data owners (e.g.
 * SoloStatsPanel) can re-read their source. The commit 5 loading-prop
 * wiring is server-only: local clear never pends, so no spinner.
 */
type Props = {
  scope?: 'server' | 'local';
  onCleared?: () => void;
  /** Optional className forwarded to the underlying Button — used by the
   *  home page to make the ghost reset button full-width on mobile while
   *  keeping its natural width on desktop (`w-full sm:w-auto`). */
  className?: string;
  /**
   * Optional muted caption rendered BELOW the button when present.
   * The home page passes it to spell out the scope (W2 P2 / D1 裁决 —
   * the server-scope reset only clears the public id=1 row; solo
   * localStorage and the per-name online row are intentionally left
   * alone). Rendered via a Tokenised text-text-muted + text-small span
   * so it matches the design system (no inline hex, no native Tailwind
   * palette).
   */
  caption?: string;
};

export function ResetStatsButton({ scope = 'server', onCleared, className, caption }: Props) {
  const router = useRouter();
  const resetAll = useGameStore((s) => s.resetAll);
  const resetSoloStats = useGameStore((s) => s.resetSoloStats);
  const [pending, setPending] = useState(false);

  const isLocal = scope === 'local';

  const handleClick = async () => {
    if (isLocal) {
      resetSoloStats();
      onCleared?.();
      return;
    }
    setPending(true);
    try {
      await resetAll();
      router.refresh();
      onCleared?.();
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        onClick={handleClick}
        className={className}
        loading={pending}
        data-testid={isLocal ? 'reset-solo-stats' : 'reset-stats'}
        aria-label={isLocal ? '清空单机战绩' : '重置对战战绩'}
      >
        {isLocal ? '清空战绩' : pending ? '重置中…' : '重置对战战绩'}
      </Button>
    {caption ? (
      <span
        className="text-small text-text-muted"
        data-testid="reset-stats-caption"
      >
        {caption}
      </span>
    ) : null}
  </>
  );
}
