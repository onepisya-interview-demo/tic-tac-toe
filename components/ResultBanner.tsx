'use client';

import { Confetti } from '@/components/Confetti';
import { useGameStore } from '@/lib/store';

/**
 * Outcome banner for /result and /solo. On /result the headline is the
 * page's only h1 (the redundant 「本局结束」 heading was dropped during
 * the mobile one-line UX pass — the headline already says who won or
 * that the game drew, so the page needs no second heading above it).
 * On /solo the GameShell already owns the h1 ("单机练习"), so the
 * banner renders as a plain paragraph and the inline headline stays a
 * status-style announcement rather than a heading.
 *
 * `headingLevel` is opt-in: default `'p'` for solo / inline use;
 * pass `1` from /result to elevate the headline to h1. The testid,
 * aria-live="assertive", and aria-atomic contract are preserved across
 * both modes — only the underlying tag changes.
 */
export function ResultBanner({ headingLevel = 'p' as 'p' | 1 }: { headingLevel?: 'p' | 1 } = {}) {
  const phase = useGameStore((s) => s.phase);
  const winner = useGameStore((s) => s.winner);

  let headline: string;
  let headlineClass = 'text-text-primary';
  if (phase === 'won' && winner) {
    headline = `${winner} 获胜`;
    headlineClass = winner === 'X' ? 'text-player-x' : 'text-player-o';
  } else if (phase === 'drawn') {
    headline = '平局';
    headlineClass = 'text-text-secondary';
  } else {
    headline = '—';
    headlineClass = 'text-text-muted';
  }

  const className = 'text-h1 font-display font-medium ' + headlineClass;

  return (
    <div className="relative">
      {headingLevel === 1 ? (
        <h1
          className={className}
          data-testid="result-headline"
          aria-live="assertive"
          aria-atomic="true"
        >
          {headline}
        </h1>
      ) : (
        <p
          className={className}
          data-testid="result-headline"
          aria-live="assertive"
          aria-atomic="true"
        >
          {headline}
        </p>
      )}
      {phase === 'won' ? <Confetti /> : null}
    </div>
  );
}
