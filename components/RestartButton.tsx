'use client';

import { useGameStore } from '@/lib/store';
import { Button } from '@/components/ui/Button';

export function RestartButton() {
  const restart = useGameStore((s) => s.restart);
  return (
    <Button variant="ghost" onClick={restart} data-testid="restart">
      重新开局
    </Button>
  );
}
