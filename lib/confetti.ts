// Colorful win-state celebration using canvas-confetti.
// Renders a full-viewport particle burst that streams from both edges and
// converges in the middle. Honors prefers-reduced-motion (no-op).

import confetti from 'canvas-confetti';

// Brand-aware palette: accent green, neutral white, plus warm/cool celebration
// colors. Keep this in sync with app/globals.css tokens where relevant.
const PALETTE = [
  '#34D399', // accent (X)
  '#FAFAFA', // text-primary (O)
  '#6EE7B7', // accent-hover
  '#FFC857', // warm yellow
  '#FF6B6B', // warm red
  '#7DD3FC', // cool blue
  '#F472B6', // pink
];

// Burst configuration: each side fires a short, dense burst with a slight
// delay so the particles cross the viewport mid-air instead of being a wall.
const BURST_DURATION_MS = 1100;
const PARTICLES_PER_FRAME = 4;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function fire(originX: number, angle: number): void {
  confetti({
    particleCount: PARTICLES_PER_FRAME,
    angle,
    spread: 70,
    startVelocity: 45,
    gravity: 0.9,
    ticks: 220,
    scalar: 1.1,
    origin: { x: originX, y: 0.55 },
    colors: PALETTE,
  });
}

/**
 * Trigger a colorful win-state celebration. Safe to call multiple times —
 * each invocation is independent. Returns immediately when the user has
 * asked for reduced motion.
 */
export function burstConfetti(): void {
  if (prefersReducedMotion()) return;

  const start = Date.now();
  const tick = (): void => {
    fire(0, 60);   // bottom-left → upper-right
    fire(1, 120);  // bottom-right → upper-left
    if (Date.now() - start < BURST_DURATION_MS) {
      requestAnimationFrame(tick);
    }
  };
  tick();
}
