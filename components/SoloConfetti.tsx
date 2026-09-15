'use client';

import { useGameStore } from '@/lib/store';
import { Confetti } from '@/components/Confetti';

/**
 * Win-state celebration layer for the /solo page. The header status-bar
 * already announces the outcome ("X 获胜" / "平局") inline, so the
 * board area stays uncluttered: this component renders nothing except
 * the burst-confetti canvas when the solo game settles on a win. Drawn
 * games get no extra DOM — the status-bar announcement is enough.
 *
 * Replaces SoloResultInline (which used to render ResultBanner with its
 * headline copy on solo) and resolves the duplicate-winner-text bug
 * where the same 「X 获胜」string appeared in both the status-bar and
 * the inline banner under the board.
 */
export function SoloConfetti() {
  const phase = useGameStore((s) => s.phase);
  if (phase !== 'won') return null;
  return <Confetti />;
}
