'use client';

import { Confetti } from '@/components/Confetti';
import { useGameStore } from '@/lib/store';

export function ResultBanner() {
  const phase = useGameStore((s) => s.phase);
  const winner = useGameStore((s) => s.winner);
  const lastOutcome = useGameStore((s) => s.lastOutcome);

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

  return (
    <>
      <div className="relative">
        <p
          className={'text-h1 font-display font-medium ' + headlineClass}
          data-testid="result-headline"
          aria-live="assertive"
          aria-atomic="true"
        >
          {headline}
        </p>
        {phase === 'won' ? <Confetti /> : null}
      </div>
      {lastOutcome ? (
        <p className="text-small text-text-muted">
          结果：{lastOutcome === 'draw' ? '平局' : `${lastOutcome} 胜`}
        </p>
      ) : null}
    </>
  );
}
