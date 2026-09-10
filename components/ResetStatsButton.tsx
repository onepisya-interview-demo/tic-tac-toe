'use client';

import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

export function ResetStatsButton() {
  const resetAll = useGameStore((s) => s.resetAll);
  return (
    <Button
      variant="ghost"
      onClick={resetAll}
      data-testid="reset-stats"
      aria-label="重置战绩"
    >
      重置战绩
    </Button>
  );
}
