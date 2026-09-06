'use client';

import { useEffect } from 'react';
import { burstConfetti } from '@/lib/confetti';

/**
 * Win-state celebration. Fires a multi-color particle burst across the
 * viewport on mount. canvas-confetti attaches its own fixed-position
 * <canvas> to document.body, so this component intentionally renders
 * nothing of its own and exists only as a mountable trigger. Honors
 * prefers-reduced-motion (no-op in lib/confetti).
 */
export function Confetti() {
  useEffect(() => {
    burstConfetti();
  }, []);
  return null;
}
