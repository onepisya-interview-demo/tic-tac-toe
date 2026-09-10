'use client';

import { useGameStore } from '@/lib/store';
import { StatusBar } from '@/components/ui/StatusBar';

export function StatusBarClient() {
  const phase = useGameStore((s) => s.phase);
  const currentPlayer = useGameStore((s) => s.currentPlayer);
  const winner = useGameStore((s) => s.winner);
  return <StatusBar phase={phase} currentPlayer={currentPlayer} winner={winner} />;
}
