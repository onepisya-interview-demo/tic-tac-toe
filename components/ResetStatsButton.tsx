'use client';

import { useRouter } from 'next/navigation';
import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

export function ResetStatsButton() {
  const router = useRouter();
  const resetAll = useGameStore((s) => s.resetAll);
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        // Await the DELETE before refreshing so the next RSC fetch sees
        // zeros (force-dynamic means no ISR fallback to invalidate).
        await resetAll();
        router.refresh();
      }}
      data-testid="reset-stats"
      aria-label="重置战绩"
    >
      重置战绩
    </Button>
  );
}
