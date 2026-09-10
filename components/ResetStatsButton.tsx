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
      onClick={() => {
        resetAll();
        // After DELETE, RSC needs to re-fetch stats so <StatsGrid> shows zeros.
        router.refresh();
      }}
      data-testid="reset-stats"
      aria-label="重置战绩"
    >
      重置战绩
    </Button>
  );
}
