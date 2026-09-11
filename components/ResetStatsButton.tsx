'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

/**
 * Reset-stats CTA used on the home page header. Awaiting resetAll() before
 * router.refresh() avoids the B-3b race (commit fd4a66f) where force-dynamic
 * RSC re-reads the still-present row before the DELETE has landed.
 *
 * commit 5 wires the loading prop introduced in commit 4 so the button
 * shows a spinner + disables interaction during the network write.
 * The Tagged Result from commit 3 means resetAll always resolves
 * (either ok or with a 'reason'), so we don't have to wrap the await
 * in try/catch — pending always settles.
 */
export function ResetStatsButton() {
  const router = useRouter();
  const resetAll = useGameStore((s) => s.resetAll);
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        setPending(true);
        try {
          await resetAll();
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      loading={pending}
      data-testid="reset-stats"
      aria-label="重置战绩"
    >
      {pending ? '重置中…' : '重置战绩'}
    </Button>
  );
}
