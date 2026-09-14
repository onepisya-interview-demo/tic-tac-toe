'use client';

import { useGameStore } from '@/lib/store';
import { ResultBanner } from '@/components/ResultBanner';

/**
 * Inline game-over banner for the /solo page. Solo has no /result route:
 * the shared ResultBanner (Confetti included) mounts right under the
 * board once the phase settles on won/drawn, and unmounts again on
 * restart. The conditional must live client-side (the solo page itself
 * is a Server Component), so this one-purpose wrapper subscribes to the
 * narrow phase selector and reuses ResultBanner untouched.
 */
export function SoloResultInline() {
  const phase = useGameStore((s) => s.phase);
  if (phase !== 'won' && phase !== 'drawn') return null;
  return <ResultBanner />;
}
